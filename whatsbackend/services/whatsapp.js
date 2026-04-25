const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

let client;
let qrCodeData = null;
let isReady = false;

function initWhatsApp(onQR) {
    client = new Client({
        authStrategy: new LocalAuth({
            dataPath: './.wwebjs_auth'
        }),
        webVersionCache: {
            type: 'remote',
            remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
        },
        puppeteer: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--single-process' // Ajuda em ambientes com pouca CPU
            ]
        }
    });

    client.on('qr', (qr) => {
        console.log('QR RECEIVED', qr);
        qrCodeData = qr;
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
    });

    client.on('disconnected', (reason) => {
        console.log('WhatsApp Disconnected', reason);
        isReady = false;
        // Re-initialize after a delay
        setTimeout(() => client.initialize(), 5000);
    });

    client.initialize();
}

async function sendMessage(to, text, mediaBuffer = null, filename = 'image.png') {
    if (!isReady) throw new Error("WhatsApp client not ready");

    // Format number: should be 5511999999999@c.us
    const chatId = to.includes('@c.us') ? to : `${to}@c.us`;

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
