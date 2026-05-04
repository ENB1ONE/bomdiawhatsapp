const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');

const clients = {};
const qrCodes = {};
const isReadyStatus = {};

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
                '--mute-audio'
            ]
        }
    });

    clients[username] = client;

    client.on('qr', (qr) => {
        console.log(`[${username}] QR RECEIVED`);
        qrCodes[username] = qr;
        isReadyStatus[username] = false;
    });

    client.on('ready', () => {
        console.log(`[${username}] WhatsApp Client is ready!`);
        isReadyStatus[username] = true;
        qrCodes[username] = null;
    });

    client.on('authenticated', () => {
        console.log(`[${username}] WhatsApp Authenticated`);
    });

    client.on('auth_failure', (msg) => {
        console.error(`[${username}] WhatsApp Auth failure`, msg);
        isReadyStatus[username] = false;
        if (fs.existsSync(dataPath)) {
            console.log(`[${username}] Removendo cache corrompido...`);
            fs.rmSync(dataPath, { recursive: true, force: true });
        }
    });

    client.on('disconnected', (reason) => {
        console.log(`[${username}] WhatsApp Disconnected: ${reason}`);
        isReadyStatus[username] = false;
        
        if (reason === 'LOGOUT' || reason === 'NAVIGATION') {
            console.log(`[${username}] Sessão inválida ou deslogada. Limpando credenciais...`);
            if (fs.existsSync(dataPath)) {
                try {
                    fs.rmSync(dataPath, { recursive: true, force: true });
                } catch(e) {
                    console.error(`[${username}] Erro ao apagar pasta de sessão:`, e);
                }
            }
        }

        setTimeout(async () => {
            console.log(`[${username}] Derrubando processo para reiniciar de forma limpa...`);
            try { 
                if (clients[username]) await clients[username].destroy(); 
            } catch (e) {} 
            delete clients[username];
            
            // Só reinicia se o usuário ainda constar no sistema (não foi deletado do app)
            const dbPath = path.join(process.cwd(), 'database.json');
            let userExists = true;
            if (fs.existsSync(dbPath)) {
                const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
                if (!db.users || !db.users.find(u => u.username === username)) userExists = false;
            }
            if (userExists) {
                initWhatsAppForUser(username);
            }
        }, 5000);
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

    if (mediaBuffer) {
        let mime = 'image/jpeg';
        if (filename.toLowerCase().endsWith('.png')) mime = 'image/png';
        else if (filename.toLowerCase().endsWith('.mp4')) mime = 'video/mp4';
        else if (filename.toLowerCase().endsWith('.gif')) mime = 'image/gif';

        const media = new MessageMedia(mime, mediaBuffer.toString('base64'), filename);
        return await client.sendMessage(chatId, media, { caption: text });
    } else {
        return await client.sendMessage(chatId, text);
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
    if (reason && reason.toString().includes('auth timeout')) {
        console.error('Falha crítica de Auth Timeout global detectada. Reiniciando todo o contêiner...');
        process.exit(1);
    }
});
