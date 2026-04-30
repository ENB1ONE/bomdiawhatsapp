const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

let client;
let qrCodeData = null;
let isReady = false;

function initWhatsApp(onQR) {
    // Limpeza de travas do Chromium para evitar erro de "Profile in use"
    const sessionPath = path.join(process.cwd(), '.wwebjs_auth/session');
    if (fs.existsSync(sessionPath)) {
        const files = fs.readdirSync(sessionPath);
        for (const file of files) {
            if (file.startsWith('Singleton')) {
                try {
                    fs.unlinkSync(path.join(sessionPath, file));
                    console.log(`Antiga trava do Chromium (${file}) removida com sucesso.`);
                } catch (err) {
                    console.error(`Erro ao remover trava ${file}:`, err);
                }
            }
        }
    }

    client = new Client({
        authStrategy: new LocalAuth({
            dataPath: './.wwebjs_auth'
        }),
        authTimeoutMs: 60000,
        puppeteer: {
            headless: 'new',
            executablePath: '/usr/bin/chromium',
            // protocolTimeout removido pois mascarava travamentos reais do navegador
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--disable-extensions',
                '--disable-features=IsolateOrigins,site-per-process',
                '--disable-site-isolation-trials'
            ]
        }
    });

    client.on('qr', (qr) => {
        console.log('QR RECEIVED', qr);
        qrCodeData = qr;
        isReady = false;
        if (onQR) onQR(qr);
        qrcode.generate(qr, { small: true });
    });

    client.on('ready', () => {
        console.log('WhatsApp Client is ready!');
        isReady = true;
        qrCodeData = null;
    });

    client.on('authenticated', () => {
        console.log('WhatsApp Authenticated');
    });

    client.on('auth_failure', (msg) => {
        console.error('WhatsApp Auth failure', msg);
        isReady = false;
        const sessionPath = path.join(process.cwd(), '.wwebjs_auth');
        if (fs.existsSync(sessionPath)) {
            console.log('Removendo cache de sessão corrompido para forçar novo QR Code...');
            fs.rmSync(sessionPath, { recursive: true, force: true });
        }
    });

    client.on('disconnected', (reason) => {
        console.log('WhatsApp Disconnected', reason);
        isReady = false;
        setTimeout(async () => {
            console.log('Derrubando o processo para o Docker reiniciar de forma limpa...');
            try { await client.destroy(); } catch (e) {}
            process.exit(1);
        }, 3000);
    });

    console.log("Iniciando WhatsApp Client...");
    
    // Função de inicialização com tentativa de retry
    const startClient = async (retries = 3) => {
        try {
            await client.initialize();
        } catch (err) {
            console.error(`Erro ao inicializar WhatsApp (Tentativas restantes: ${retries}):`, err.message);
            if (retries > 0) {
                console.log("Aguardando 10 segundos antes de tentar novamente...");
                setTimeout(() => startClient(retries - 1), 10000);
            } else {
                console.error("Falha fatal após múltiplas tentativas.");
            }
        }
    };

    startClient();
}

async function sendMessage(to, text, mediaBuffer = null, filename = 'image.png') {
    if (!isReady) throw new Error("WhatsApp client not ready");

    // Resolve o ID correto do WhatsApp (trata números com ou sem o 9 extra, e resolve o erro de LID)
    let chatId = to.includes('@c.us') ? to : `${to}@c.us`;
    
    try {
        const numberDetails = await client.getNumberId(to);
        if (numberDetails) {
            chatId = numberDetails._serialized;
        }
    } catch (e) {
        console.warn(`Aviso: Não foi possível validar o número ${to}, tentando envio direto.`);
    }

    if (mediaBuffer) {
        const media = new MessageMedia('image/png', mediaBuffer.toString('base64'), filename);
        return await client.sendMessage(chatId, media, { caption: text });
    } else {
        return await client.sendMessage(chatId, text);
    }
}

function getStatus() {
    return {
        isReady,
        qrCodeData
    };
}

module.exports = { initWhatsApp, sendMessage, getStatus };

// Intercepta falhas de timeout de autenticação que o whatsapp-web.js lança fora dos eventos padrões
process.on('unhandledRejection', (reason, promise) => {
    if (reason && reason.toString().includes('auth timeout')) {
        console.error('Falha crítica de Auth Timeout detectada!');
        const sessionPath = path.join(process.cwd(), '.wwebjs_auth');
        if (fs.existsSync(sessionPath)) {
            console.log('Deletando .wwebjs_auth corrompido...');
            fs.rmSync(sessionPath, { recursive: true, force: true });
        }
        console.log('Reiniciando processo...');
        process.exit(1);
    }
});
