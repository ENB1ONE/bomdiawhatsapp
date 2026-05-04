const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');

const clients = {};
const qrCodes = {};
const isReadyStatus = {};

function logToServer(username, status, summary, details = {}) {
    const dbPath = path.join(process.cwd(), 'database.json');
    if (!fs.existsSync(dbPath)) return;
    try {
        const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        const user = db.users.find(u => u.username === username);
        if (user) {
            if (!user.logs) user.logs = [];
            user.logs.unshift({
                id: Date.now(),
                timestamp: new Date().toISOString(),
                type: 'server',
                status: status,
                details: { summary, ...details }
            });
            if (user.logs.length > 100) user.logs = user.logs.slice(0, 100);
            fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
        }
    } catch(e) {
        console.error(`[${username}] Erro ao salvar log de servidor no BD:`, e.message);
    }
}

// Função auxiliar para inicializar um único cliente
function initWhatsAppForUser(username, retries = 3) {
    if (clients[username]) {
        console.log(`[${username}] Cliente já inicializado ou em processo.`);
        return;
    }

    console.log(`[${username}] Iniciando WhatsApp Client...`);
    qrCodes[username] = null;
    isReadyStatus[username] = false;

    // Caminho da sessão específico por usuário
    const dataPath = `./.wwebjs_auth/session-${username}`;

    // Limpeza de travas do Chromium para evitar erro de "Profile in use"
    const baseSessionPath = path.join(process.cwd(), `.wwebjs_auth/session-${username}`);
    function removeSingletonLocks(dirPath) {
        if (!fs.existsSync(dirPath)) return;
        let items = [];
        try { items = fs.readdirSync(dirPath); } catch (e) { return; }
        
        for (const item of items) {
            const itemPath = path.join(dirPath, item);
            let isDir = false;
            try {
                // lstatSync evita erro ENOENT em links simbólicos quebrados
                isDir = fs.lstatSync(itemPath).isDirectory();
            } catch (e) {
                // Se o arquivo sumiu ou é um symlink quebrado, tenta apenas deletar se for Singleton
                if (item.startsWith('Singleton')) {
                    try { fs.unlinkSync(itemPath); } catch (err) {}
                }
                continue;
            }
            
            if (isDir) {
                removeSingletonLocks(itemPath);
            } else if (item.startsWith('Singleton')) {
                try {
                    fs.unlinkSync(itemPath);
                    console.log(`[${username}] Antiga trava do Chromium removida: ${item}`);
                } catch (err) {}
            }
        }
    }
    removeSingletonLocks(baseSessionPath);

    const client = new Client({
        authStrategy: new LocalAuth({
            clientId: username,
            dataPath: dataPath
        }),
        authTimeoutMs: 60000,
        puppeteer: {
            headless: 'new',
            executablePath: '/usr/bin/chromium',
            protocolTimeout: 0,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-gpu',
                '--disable-extensions',
                '--disable-software-rasterizer',
                '--disable-background-networking',
                '--disable-features=IsolateOrigins,site-per-process',
                '--disable-site-isolation-trials',
                '--mute-audio',
                '--blink-settings=imagesEnabled=false',
                '--disable-remote-fonts',
                '--disable-webgl',
                '--disable-3d-apis',
                '--disable-sync',
                '--disable-client-side-phishing-detection',
                '--disable-component-update',
                '--disable-default-apps',
                '--disable-ipc-flooding-protection'
            ]
        }
    });

    clients[username] = client;
    
    const optimizePage = async (page) => {
        if (!page || page.isOptimized) return;
        try {
            page.isOptimized = true;
            await page.setRequestInterception(true);
            page.on('request', (req) => {
                const rt = req.resourceType();
                if (['image', 'media'].includes(rt)) {
                    if (req.url().startsWith('blob:')) {
                        req.continue(); // Permite blob URLs internos (usados para gerar thumbnail ao enviar imagens)
                    } else {
                        req.abort();
                    }
                } else if (req.url().includes('/pp?e=') || req.url().includes('/status')) {
                    req.abort(); // Bloqueia fotos de perfil e mídias de status
                } else {
                    req.continue();
                }
            });
            console.log(`[${username}] Otimização extrema ativada: Mídias bloqueadas.`);
        } catch(e) {}
    };

    client.on('loading_screen', (percent, message) => {
        if (client.pupPage) optimizePage(client.pupPage);
    });

    client.on('qr', (qr) => {
        console.log(`[${username}] QR RECEIVED`);
        qrCodes[username] = qr;
        isReadyStatus[username] = false;
        if (client.pupPage) optimizePage(client.pupPage);
    });

    client.on('ready', () => {
        console.log(`[${username}] WhatsApp Client is ready!`);
        isReadyStatus[username] = true;
        qrCodes[username] = null;
        logToServer(username, 'success', 'Sessão iniciada e pronta para envio.');
        if (client.pupPage) optimizePage(client.pupPage);
    });

    client.on('authenticated', () => {
        console.log(`[${username}] WhatsApp Authenticated`);
    });

    client.on('auth_failure', async (msg) => {
        console.error(`[${username}] WhatsApp Auth failure`, msg);
        isReadyStatus[username] = false;
        logToServer(username, 'error', 'Falha de Autenticação (Sessão corrompida)', { error: msg });
        
        try { if (clients[username]) await clients[username].destroy(); } catch (e) {}
        
        if (fs.existsSync(dataPath)) {
            console.log(`[${username}] Removendo cache corrompido...`);
            try { fs.rmSync(dataPath, { recursive: true, force: true }); } catch(e) {}
        }
    });

    client.on('disconnected', async (reason) => {
        console.log(`[${username}] WhatsApp Disconnected: ${reason}`);
        isReadyStatus[username] = false;
        
        if (reason === 'LOGOUT' || reason === 'NAVIGATION') {
            console.log(`[${username}] Sessão inválida ou deslogada. Limpando credenciais...`);
            logToServer(username, 'warning', `Desconectado do Celular: ${reason}`, { reason });
            
            console.log(`[${username}] Derrubando processo Chromium antes de limpar...`);
            try { if (clients[username]) await clients[username].destroy(); } catch (e) {}
            
            if (fs.existsSync(dataPath)) {
                try {
                    fs.rmSync(dataPath, { recursive: true, force: true });
                } catch(e) {
                    console.error(`[${username}] Erro ao apagar pasta de sessão:`, e);
                }
            }
        } else {
            logToServer(username, 'warning', `Queda de Conexão: ${reason}`, { reason });
            try { if (clients[username]) await clients[username].destroy(); } catch (e) {}
        }

        delete clients[username];
        
        // Só reinicia se o usuário ainda constar no sistema (não foi deletado do app)
        const dbPath = path.join(process.cwd(), 'database.json');
        let userExists = true;
        if (fs.existsSync(dbPath)) {
            try {
                const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
                if (!db.users || !db.users.find(u => u.username === username)) userExists = false;
            } catch(e) {}
        }
        
        if (userExists) {
            console.log(`[${username}] Agendando reinício limpo em 5 segundos...`);
            setTimeout(() => initWhatsAppForUser(username), 5000);
        } else {
            console.log(`[${username}] Usuário não existe mais no banco. Sessão totalmente encerrada.`);
        }
    });

    const startClient = async () => {
        try {
            await client.initialize();
        } catch (err) {
            console.error(`[${username}] Erro ao inicializar (Tentativas: ${retries}):`, err.message);
            try { await client.destroy(); } catch(e) {}
            delete clients[username];
            
            if (retries > 0) {
                setTimeout(() => initWhatsAppForUser(username, retries - 1), 10000);
            } else {
                console.error(`[${username}] Falha fatal. Limpando cliente da memória.`);
            }
        }
    };

    startClient();
}

async function initializeAllClientsSequentially(users) {
    if (!users || users.length === 0) return;

    const sortedUsers = [...users].sort((a, b) => {
        if (a.role === 'admin' && b.role !== 'admin') return -1;
        if (a.role !== 'admin' && b.role === 'admin') return 1;
        return 0;
    });

    console.log(`Iniciando a fila de navegadores (${sortedUsers.length} usuários encontrados)...`);

    for (const user of sortedUsers) {
        console.log(`-> Na fila: ${user.username}`);
        initWhatsAppForUser(user.username);
        await new Promise(resolve => setTimeout(resolve, 15000));
    }
}

async function sendMessage(username, to, text, mediaBuffer = null, filename = 'image.png') {
    const client = clients[username];
    if (!client || !isReadyStatus[username]) throw new Error(`[${username}] WhatsApp client not ready`);

    let chatId = to;
    if (!to.includes('@c.us') && !to.includes('@g.us')) {
        chatId = `${to}@c.us`;
    }
    
    if (!chatId.includes('@g.us')) {
        // Ignora o getNumberId que estava causando timeout ("Runtime.callFunctionOn timed out").
        // O WhatsApp Web aceita o envio direto se o número for válido.
        chatId = to.replace('@c.us', '') + '@c.us';
    }

    try {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout ao enviar mensagem (45s)')), 45000));
        let sendPromise;

        if (mediaBuffer) {
            let mime = 'image/jpeg';
            if (filename.toLowerCase().endsWith('.png')) mime = 'image/png';
            else if (filename.toLowerCase().endsWith('.mp4')) mime = 'video/mp4';
            else if (filename.toLowerCase().endsWith('.gif')) mime = 'image/gif';

            const media = new MessageMedia(mime, mediaBuffer.toString('base64'), filename);
            sendPromise = client.sendMessage(chatId, media, { caption: text || '' });
        } else {
            if (!text || text.trim() === '') throw new Error('Texto vazio e sem mídia anexa.');
            sendPromise = client.sendMessage(chatId, text);
        }

        return await Promise.race([sendPromise, timeoutPromise]);
    } catch (error) {
        const errStr = error.message ? error.message : String(error);
        if (errStr.includes('Execution context was destroyed') || errStr.includes('Target closed')) {
            console.error(`[${username}] CRASH NO CHROMIUM detectado no envio. Forçando reinicialização do cliente...`);
            logToServer(username, 'error', 'Crash do WhatsApp Web detectado no envio. Reiniciando...', { error: errStr });
            destroyClient(username);
            setTimeout(() => initWhatsAppForUser(username), 5000);
        }
        throw error;
    }
}

function getStatus(username) {
    return {
        isReady: isReadyStatus[username] || false,
        qrCodeData: qrCodes[username] || null
    };
}

function getClient(username) {
    return clients[username];
}

async function destroyClient(username) {
    console.log(`[${username}] Destruindo sessão do usuário removido...`);
    if (clients[username]) {
        try {
            await clients[username].destroy();
        } catch (e) {}
        delete clients[username];
    }
    delete qrCodes[username];
    delete isReadyStatus[username];
    
    const dataPath = `./.wwebjs_auth/session-${username}`;
    if (fs.existsSync(dataPath)) {
        try {
            fs.rmSync(dataPath, { recursive: true, force: true });
        } catch (e) {
            console.error(`[${username}] Erro ao apagar pasta de sessão após exclusão de usuário:`, e);
        }
    }
}

module.exports = { 
    initWhatsAppForUser, 
    initializeAllClientsSequentially, 
    sendMessage, 
    getStatus, 
    getClient,
    destroyClient
};

// Intercepta falhas de timeout que o whatsapp-web.js lança globalmente
process.on('unhandledRejection', (reason, promise) => {
    const reasonStr = reason ? reason.toString() : '';
    if (reasonStr.includes('auth timeout')) {
        console.error('Falha crítica de Auth Timeout global detectada. Reiniciando todo o contêiner...');
        process.exit(1);
    } else if (reasonStr.includes('Target closed') || reasonStr.includes('Protocol error')) {
        console.error('Ignorando erro de protocolo do Puppeteer em background (comum após logout):', reasonStr);
    } else {
        console.error('Unhandled Rejection:', reason);
    }
});
