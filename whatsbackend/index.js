require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { initWhatsApp, sendMessage, getStatus } = require('./services/whatsapp');
const { generateImage } = require('./services/gemini');

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json());

const AUTH_USER = "enb1one";
const AUTH_PASS = "enb1palms@28";

// Middleware de Autenticação
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: "Acesso negado. Autenticação necessária." });
    }

    const auth = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
    const user = auth[0];
    const pass = auth[1];

    if (user === AUTH_USER && pass === AUTH_PASS) {
        next();
    } else {
        res.status(401).json({ error: "Credenciais inválidas." });
    }
};

// Rota de Login (pública para o front validar)
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (username === AUTH_USER && password === AUTH_PASS) {
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, error: "Usuário ou senha incorretos" });
    }
});

// Proteger todas as rotas abaixo com o middleware
app.use(authMiddleware);

const DB_PATH = path.join(__dirname, 'database.json');

if (!fs.existsSync(DB_PATH)) {
    const initialData = {
        contacts: [],
        logs: [],
        settings: {
            morningPrompt: "Aja como uma tia ou avó carinhosa, otimista e de muita fé. Gere uma mensagem de 'Bom Dia' calorosa para o WhatsApp com palavras de encorajamento, saúde e esperança (use emojis). Além do texto, crie a descrição detalhada (em inglês) de uma imagem matinal vibrante, iluminada e realista que traga paz. A imagem DEVE conter o texto 'Bom Dia' de forma legível e centralizada.",
            nightPrompt: "Aja como uma tia ou avó carinhosa e de muita fé. Gere uma mensagem de 'Boa Noite' serena para o WhatsApp com palavras de gratidão pelo dia, proteção e descanso (use emojis). Além do texto, crie a descrição detalhada (em inglês) de uma imagem noturna aconchegante, com estrelas ou luz suave que traga tranquilidade. A imagem DEVE conter o texto 'Boa Noite' de forma legível.",
            morningTime: "08:00",
            nightTime: "20:00"
        }
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2));
}

const DEFAULT_MORNING = 'Aja como uma tia ou avó carinhosa, otimista e de muita fé. Gere uma mensagem de "Bom Dia" calorosa para o WhatsApp com palavras de encorajamento, saúde e esperança (use emojis). Além do texto, crie a descrição detalhada (em inglês) de uma imagem matinal vibrante, iluminada e realista que traga paz. A imagem DEVE conter o texto "Bom Dia" de forma legível e artística.';
const DEFAULT_NIGHT = 'Aja como uma tia ou avó carinhosa e de muita fé. Gere uma mensagem de "Boa Noite" serena para o WhatsApp com palavras de gratidão pelo dia, proteção e descanso (use emojis). Além do texto, crie a descrição detalhada (em inglês) de uma imagem noturna aconchegante, com estrelas ou luz suave que traga tranquilidade. A imagem DEVE conter o texto "Boa Noite" de forma legível.';

function getDB() {
    const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    if (!db.logs) db.logs = [];
    
    // Migração automática para garantir os novos prompts ricos
    let changed = false;
    if (!db.settings.morningPrompt || db.settings.morningPrompt.length < 100) {
        db.settings.morningPrompt = DEFAULT_MORNING;
        changed = true;
    }
    if (!db.settings.nightPrompt || db.settings.nightPrompt.length < 100) {
        db.settings.nightPrompt = DEFAULT_NIGHT;
        changed = true;
    }
    
    if (changed) saveDB(db);
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



app.get('/logs', (req, res) => {
    res.json(getDB().logs);
});

// Helper to sanitize phone numbers
function sanitizePhone(phone) {
    let cleaned = phone.replace(/\D/g, ''); // Remove tudo que não é número
    if (cleaned.length === 11 && !cleaned.startsWith('55')) {
        cleaned = '55' + cleaned; // Adiciona 55 se for número brasileiro de 11 dígitos
    } else if (cleaned.length === 10 && !cleaned.startsWith('55')) {
        cleaned = '55' + cleaned; // Adiciona 55 se for número brasileiro de 10 dígitos
    }
    return cleaned;
}

// Logic to run automation
async function runAutomation(type) {
    console.log(`\n--- STARTING ${type.toUpperCase()} AUTOMATION ---`);
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
                const cleanPhone = sanitizePhone(contact.phone);
                console.log(`Sending to ${contact.name} (${cleanPhone})...`);
                await sendMessage(cleanPhone, finalGreeting, finalImage);
                successes.push({ name: contact.name, phone: cleanPhone });
                
                // Delay aleatório entre 5 e 15 segundos para simular comportamento humano
                const delay = Math.floor(Math.random() * (15000 - 5000 + 1) + 5000);
                await new Promise(r => setTimeout(r, delay));
            } catch (err) {
                console.error(`Failed to send to ${contact.phone}:`, err.message || err.toString());
                failures.push({ name: contact.name, phone: contact.phone, error: err.message || err.toString() });
            }
        }

        const finalStatus = failures.length === 0 ? 'success' : (successes.length === 0 ? 'error' : 'warning');
        
        addLog(type, finalStatus, {
            summary: `Enviado para ${successes.length} contatos. Falhas: ${failures.length}`,
            successes,
            failures
        });
        console.log(`--- ${type.toUpperCase()} AUTOMATION COMPLETED ---`);
        console.log(`Success: ${successes.length}, Failures: ${failures.length}\n`);
    } catch (err) {
        console.error("Critical automation error:", err);
        addLog(type, 'error', {
            summary: "Erro crítico na automação",
            error: err.message || err.toString()
        });
    }
}

// Dynamic Scheduling Logic
let morningJob = null;
let nightJob = null;

function scheduleAllJobs() {
    const db = getDB();
    const { morningTime, nightTime } = db.settings;

    // Stop existing jobs
    if (morningJob) morningJob.stop();
    if (nightJob) nightJob.stop();

    // Parse times (assuming HH:mm format)
    const [mHour, mMin] = morningTime.split(':');
    const [nHour, nMin] = nightTime.split(':');

    // Schedule new jobs
    morningJob = cron.schedule(`${mMin} ${mHour} * * *`, () => {
        console.log(`Cron: Iniciando automação da manhã agendada para as ${morningTime}`);
        runAutomation('morning');
    });

    nightJob = cron.schedule(`${nMin} ${nHour} * * *`, () => {
        console.log(`Cron: Iniciando automação da noite agendada para as ${nightTime}`);
        runAutomation('night');
    });

    console.log(`Cron Jobs atualizados: Manhã (${morningTime}), Noite (${nightTime})`);
}

// Manual Trigger
app.post('/test-now', async (req, res) => {
    const { type } = req.body; 
    runAutomation(type || 'morning');
    res.json({ success: true, message: "Automation started manually" });
});

// Settings update with reschedule
app.post('/settings', (req, res) => {
    console.log("Recebida solicitação para atualizar configurações:", req.body);
    const db = getDB();
    db.settings = { ...db.settings, ...req.body };
    saveDB(db);
    console.log("Configurações salvas no banco de dados.");
    scheduleAllJobs(); // Re-agendar imediatamente
    res.json({ success: true });
});

// Initialize
scheduleAllJobs();
initWhatsApp();

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
