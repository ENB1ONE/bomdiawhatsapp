const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');

const clients = {};
const qrCodes = {};
const isReadyStatus = {};

// Função auxiliar para inicializar um único cliente
function initWhatsAppForUser(username) {
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
        const items = fs.readdirSync(dirPath);
        for (const item of items) {
            const itemPath = path.join(dirPath, item);
            if (fs.statSync(itemPath).isDirectory()) {
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
            } catch (e) {} // Ignorar TargetCloseError durante o destroy
            delete clients[username];
            initWhatsAppForUser(username);
        }, 5000);
    });

    const startClient = async (retries = 3) => {
        try {
            await client.initialize();
        } catch (err) {
            console.error(`[${username}] Erro ao inicializar (Tentativas: ${retries}):`, err.message);
            if (retries > 0) {
                setTimeout(() => startClient(retries - 1), 10000);
            } else {
                console.error(`[${username}] Falha fatal. Destruindo cliente.`);
                delete clients[username];
            }
        }
    };

    startClient();
}

async function initializeAllClientsSequentially(users) {
    if (!users || users.length === 0) return;

    // Prioriza admins
    const sortedUsers = [...users].sort((a, b) => {
        if (a.role === 'admin' && b.role !== 'admin') return -1;
        if (a.role !== 'admin' && b.role === 'admin') return 1;
        return 0;
    });

    console.log(`Iniciando a fila de navegadores (${sortedUsers.length} usuários encontrados)...`);

    for (const user of sortedUsers) {
        console.log(`-> Na fila: ${user.username}`);
        initWhatsAppForUser(user.username);
        // Aguarda 15 segundos entre inicializações para não estourar a CPU
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
        try {
            const cleanNumber = to.replace('@c.us', '');
            const numberDetails = await client.getNumberId(cleanNumber);
            if (numberDetails) {
                chatId = numberDetails._serialized;
            } else {
                console.warn(`[${username}] Aviso: Número ${cleanNumber} não parece ter WhatsApp ativo.`);
            }
        } catch (e) {
            console.warn(`[${username}] Aviso: Falha ao validar número ${to} (${e.message}). Tentando envio direto...`);
        }
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

module.exports = { 
    initWhatsAppForUser, 
    initializeAllClientsSequentially, 
    sendMessage, 
    getStatus, 
    getClient 
};

// Intercepta falhas de timeout que o whatsapp-web.js lança globalmente
process.on('unhandledRejection', (reason, promise) => {
    if (reason && reason.toString().includes('auth timeout')) {
        console.error('Falha crítica de Auth Timeout global detectada. Reiniciando todo o contêiner...');
        process.exit(1);
    }
});
