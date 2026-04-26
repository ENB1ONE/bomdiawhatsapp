require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { initWhatsApp, sendMessage, getStatus } = require('./services/whatsapp');
const { generateImage } = require('./services/gemini');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());

const DB_PATH = path.join(__dirname, 'database.json');

if (!fs.existsSync(DB_PATH)) {
    const initialData = {
        contacts: [],
        logs: [],
        settings: {
            morningPrompt: "Uma bela imagem de bom dia, ensolarada, estilo fotorealista",
            nightPrompt: "Uma imagem tranquila de boa noite, com lua cheia, estilo relaxante",
            morningTime: "08:00",
            nightTime: "20:00"
        }
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2));
}

// Helper to read/write DB
function getDB() {
    const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    if (!db.logs) db.logs = []; // Migration
    return db;
}

function saveDB(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function addLog(type, status, details) {
    const db = getDB();
    db.logs.unshift({
        id: Date.now(),
        timestamp: new Date().toISOString(),
        type, // 'morning' or 'night'
        status, // 'success' or 'error'
        details
    });
    // Keep only last 50 logs
    if (db.logs.length > 50) db.logs = db.logs.slice(0, 50);
    saveDB(db);
}

// API Endpoints
app.get('/status', (req, res) => {
    res.json(getStatus());
});

app.get('/contacts', (req, res) => {
    res.json(getDB().contacts);
});

app.post('/contacts', (req, res) => {
    const { phone, name } = req.body;
    const db = getDB();
    db.contacts.push({ phone, name });
    saveDB(db);
    res.json({ success: true });
});

app.delete('/contacts/:phone', (req, res) => {
    const { phone } = req.params;
    const db = getDB();
    db.contacts = db.contacts.filter(c => c.phone !== phone);
    saveDB(db);
    res.json({ success: true });
});

app.get('/settings', (req, res) => {
    res.json(getDB().settings);
});

app.post('/settings', (req, res) => {
    const db = getDB();
    db.settings = { ...db.settings, ...req.body };
    saveDB(db);
    res.json({ success: true });
});

app.get('/logs', (req, res) => {
    res.json(getDB().logs);
});

// Logic to run automation
async function runAutomation(type) {
    console.log(`Running ${type} automation...`);
    const db = getDB();
    const { morningPrompt, nightPrompt } = db.settings;
    const prompt = type === 'morning' ? morningPrompt : nightPrompt;
    const greeting = type === 'morning' ? "Bom dia! ☀️" : "Boa noite! 🌙";

    try {
        let aiContent = { image: null, caption: greeting };
        try {
            aiContent = await generateImage(prompt, type);
        } catch (iaError) {
            console.error("IA falhou, seguindo com texto padrão:", iaError.message);
        }
        
        const finalImage = aiContent.image;
        const finalGreeting = aiContent.caption || greeting;
        
        let successes = [];
        let failures = [];

        for (const contact of db.contacts) {
            try {
                console.log(`Sending to ${contact.name} (${contact.phone})`);
                await sendMessage(contact.phone, finalGreeting, finalImage);
                successes.push({ name: contact.name, phone: contact.phone });
            } catch (err) {
                console.error(`Failed to send to ${contact.phone}:`, err);
                failures.push({ name: contact.name, phone: contact.phone, error: err.message || err.toString() });
            }
        }

        const finalStatus = failures.length === 0 ? 'success' : (successes.length === 0 ? 'error' : 'warning');
        
        addLog(type, finalStatus, {
            summary: `Enviado para ${successes.length} contatos. Falhas: ${failures.length}`,
            successes,
            failures
        });
    } catch (err) {
        console.error("Critical automation error:", err);
        addLog(type, 'error', {
            summary: "Erro crítico na automação",
            error: err.message || err.toString()
        });
    }
}

// Manual Trigger
app.post('/test-now', async (req, res) => {
    const { type } = req.body; // 'morning' or 'night'
    runAutomation(type || 'morning');
    res.json({ success: true, message: "Automation started manually" });
});

// Scheduling
// Morning: 08:00
cron.schedule('0 8 * * *', () => {
    runAutomation('morning');
});

// Night: 20:00
cron.schedule('0 20 * * *', () => {
    runAutomation('night');
});

// Initialize WhatsApp
initWhatsApp();

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
