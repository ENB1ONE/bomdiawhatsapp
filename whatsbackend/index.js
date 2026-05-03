require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { initWhatsAppForUser, initializeAllClientsSequentially, sendMessage, getStatus, getClient } = require('./services/whatsapp');
const { generateImage } = require('./services/gemini');

// Configuração do multer para upload de imagens
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir)
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
  }
});
const upload = multer({ storage: storage });

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

const app = express();
const PORT = process.env.PORT || 3001;

const DB_PATH = path.join(__dirname, 'database.json');

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json());

const DEFAULT_MORNING = "Com fé e otimismo, gere uma mensagem calorosa de 'Bom Dia' para WhatsApp com encorajamento, saúde, esperança e emojis. Crie também um prompt em inglês de uma imagem matinal realista, vibrante e de paz. A imagem DEVE ser 100% visual, estritamente SEM textos ou letras.";
const DEFAULT_NIGHT = "Com fé e otimismo, gere uma mensagem calorosa de 'Boa Noite' para WhatsApp com encorajamento, saúde, esperança e emojis. Crie também um prompt em inglês de uma imagem noturna realista, aconchegante e de paz. A imagem DEVE ser 100% visual, estritamente SEM textos ou letras.";

function getDB() {
    if (!fs.existsSync(DB_PATH)) {
        fs.writeFileSync(DB_PATH, JSON.stringify({}, null, 2));
    }
    const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    let changed = false;

    // Migração: Garante que exista o array de usuários
    if (!db.users || !Array.isArray(db.users) || db.users.length === 0) {
        db.users = [{ username: "enb1one", password: "enb1palms@28", role: "admin" }];
        changed = true;
    }

    // Migração: Se existirem chaves globais (antigas), movê-las para o usuário admin (primeiro usuário)
    if (db.contacts || db.calendar || db.settings || db.logs) {
        const firstUser = db.users[0];
        if (db.contacts) { firstUser.contacts = db.contacts; delete db.contacts; }
        if (db.calendar) { firstUser.calendar = db.calendar; delete db.calendar; }
        if (db.settings) { firstUser.settings = db.settings; delete db.settings; }
        if (db.logs) { firstUser.logs = db.logs; delete db.logs; }
        changed = true;
    }

    // Migração: Garante estrutura base para TODOS os usuários
    for (const u of db.users) {
        if (!u.contacts) { u.contacts = []; changed = true; }
        if (!u.calendar) { u.calendar = []; changed = true; }
        if (!u.logs) { u.logs = []; changed = true; }
        if (!u.settings) {
            u.settings = {
                morningPrompt: DEFAULT_MORNING,
                nightPrompt: DEFAULT_NIGHT,
                morningTime: "08:00",
                nightTime: "20:00",
                autoSendEnabled: true
            };
            changed = true;
        } else {
            // Consertar prompts vazios ou antigos
            const isOldPattern = (text) => text && text.includes("Aja como uma tia");
            if (!u.settings.morningPrompt || u.settings.morningPrompt.length < 50 || isOldPattern(u.settings.morningPrompt)) {
                u.settings.morningPrompt = DEFAULT_MORNING; changed = true;
            }
            if (!u.settings.nightPrompt || u.settings.nightPrompt.length < 50 || isOldPattern(u.settings.nightPrompt)) {
                u.settings.nightPrompt = DEFAULT_NIGHT; changed = true;
            }
            if (typeof u.settings.autoSendEnabled === 'undefined') {
                u.settings.autoSendEnabled = true; changed = true;
            }
        }
    }

    if (changed) saveDB(db);
    return db;
}

function saveDB(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// Retorna o objeto de usuário do DB por referência para edição fácil
const getUserNode = (db, username) => db.users.find(u => u.username === username);

function addLog(username, type, status, details) {
    const db = getDB();
    const user = getUserNode(db, username);
    if (!user) return;
    user.logs.unshift({
        id: Date.now(),
        timestamp: new Date().toISOString(),
        type, 
        status, 
        details
    });
    if (user.logs.length > 50) user.logs = user.logs.slice(0, 50);
    saveDB(db);
}

// Rota de Login Pública
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const db = getDB();
    const foundUser = db.users?.find(u => u.username === username && u.password === password);
    
    if (foundUser) {
        // Inicializa o WhatsApp dele se ainda não estiver (lazy load para novos logins, mas a fila inicia no boot tbm)
        initWhatsAppForUser(username);
        res.json({ success: true, role: foundUser.role });
    } else {
        res.status(401).json({ success: false, error: "Usuário ou senha incorretos" });
    }
});

// Middleware de Autenticação
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Acesso negado. Autenticação necessária." });

    const auth = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
    const user = auth[0];
    const pass = auth[1];

    const db = getDB();
    const foundUser = db.users?.find(u => u.username === user && u.password === pass);

    if (foundUser) {
        req.user = foundUser;
        next();
    } else {
        res.status(401).json({ error: "Credenciais inválidas." });
    }
};

app.use(authMiddleware);

const adminOnly = (req, res, next) => {
    if (req.user && req.user.role === 'admin') next();
    else res.status(403).json({ error: "Acesso negado. Apenas administradores." });
};

// --- CRUD de Usuários (Apenas Admin) ---
app.get('/users', adminOnly, (req, res) => {
    const db = getDB();
    const safeUsers = db.users.map(u => ({ username: u.username, role: u.role }));
    res.json(safeUsers);
});

app.post('/users', adminOnly, (req, res) => {
    const { username, password, role } = req.body;
    const db = getDB();
    if (db.users.find(u => u.username === username)) return res.status(400).json({ error: "Usuário já existe" });
    db.users.push({ username, password, role: role || 'user', contacts: [], calendar: [], logs: [], settings: { morningPrompt: DEFAULT_MORNING, nightPrompt: DEFAULT_NIGHT, morningTime: "08:00", nightTime: "20:00", autoSendEnabled: true } });
    saveDB(db);
    res.json({ success: true });
});

app.delete('/users/:username', adminOnly, (req, res) => {
    const { username } = req.params;
    const db = getDB();
    if (username === req.user.username) return res.status(400).json({ error: "Não é possível deletar a si próprio" });
    db.users = db.users.filter(u => u.username !== username);
    saveDB(db);
    res.json({ success: true });
});

app.put('/users/:username', adminOnly, (req, res) => {
    const { username } = req.params;
    const { password, role } = req.body;
    const db = getDB();
    const userIndex = db.users.findIndex(u => u.username === username);
    if (userIndex === -1) return res.status(404).json({ error: "Usuário não encontrado" });
    if (password) db.users[userIndex].password = password;
    if (role) db.users[userIndex].role = role;
    saveDB(db);
    res.json({ success: true });
});

// --- API MULTI-TENANT ISOLADA ---

app.get('/status', (req, res) => {
    res.json(getStatus(req.user.username));
});

app.get('/contacts', (req, res) => {
    const user = getUserNode(getDB(), req.user.username);
    res.json(user.contacts);
});

app.post('/contacts', (req, res) => {
    const { phone, name } = req.body;
    const db = getDB();
    const user = getUserNode(db, req.user.username);
    user.contacts.push({ phone, name });
    saveDB(db);
    res.json({ success: true });
});

app.delete('/contacts/:phone', (req, res) => {
    const { phone } = req.params;
    const db = getDB();
    const user = getUserNode(db, req.user.username);
    user.contacts = user.contacts.filter(c => c.phone !== phone);
    saveDB(db);
    res.json({ success: true });
});

app.get('/settings', (req, res) => {
    const user = getUserNode(getDB(), req.user.username);
    res.json(user.settings);
});

app.post('/settings', (req, res) => {
    const db = getDB();
    const user = getUserNode(db, req.user.username);
    user.settings = { ...user.settings, ...req.body };
    saveDB(db);
    // Como os horários variam por usuário agora, re-agendar geral
    scheduleAllJobs();
    res.json({ success: true });
});

app.put('/settings/toggle-auto', (req, res) => {
    const { enabled } = req.body;
    const db = getDB();
    const user = getUserNode(db, req.user.username);
    user.settings.autoSendEnabled = enabled;
    saveDB(db);
    res.json({ success: true, autoSendEnabled: enabled });
});

app.get('/calendar', (req, res) => {
    const user = getUserNode(getDB(), req.user.username);
    res.json(user.calendar);
});

app.post('/calendar', upload.single('image'), (req, res) => {
    const { date, time, targetId, text } = req.body;
    const db = getDB();
    const user = getUserNode(db, req.user.username);
    
    const newEvent = {
        id: Date.now().toString(),
        date,
        time,
        targetId, 
        text,
        imagePath: req.file ? req.file.path : null,
        sent: false
    };
    
    user.calendar.push(newEvent);
    saveDB(db);
    res.json({ success: true, event: newEvent });
});

app.delete('/calendar/:id', (req, res) => {
    const { id } = req.params;
    const db = getDB();
    const user = getUserNode(db, req.user.username);
    
    const eventIndex = user.calendar.findIndex(e => e.id === id);
    if (eventIndex !== -1) {
        const event = user.calendar[eventIndex];
        if (event.imagePath && fs.existsSync(event.imagePath)) fs.unlinkSync(event.imagePath);
        user.calendar.splice(eventIndex, 1);
        saveDB(db);
    }
    res.json({ success: true });
});

app.get('/groups', async (req, res) => {
    try {
        const client = getClient(req.user.username);
        if (!client) return res.status(500).json({ error: "WhatsApp cliente não inicializado" });
        const chats = await client.getChats();
        const groups = chats.filter(chat => chat.isGroup).map(group => ({
            id: group.id._serialized,
            name: group.name
        }));
        res.json(groups);
    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar grupos", details: err.message });
    }
});

app.get('/logs', (req, res) => {
    const user = getUserNode(getDB(), req.user.username);
    res.json(user.logs);
});

function sanitizePhone(phone) {
    let cleaned = phone.replace(/\D/g, ''); 
    if (cleaned.length === 11 && !cleaned.startsWith('55')) cleaned = '55' + cleaned; 
    else if (cleaned.length === 10 && !cleaned.startsWith('55')) cleaned = '55' + cleaned; 
    return cleaned;
}

// --- AUTOMATION ENGINE (Itera sobre cada usuário da plataforma) ---

async function runAutomationForUser(userNode, type, targetPhone = null) {
    const username = userNode.username;
    console.log(`\n--- STARTING ${type.toUpperCase()} AUTOMATION PARA ${username} ${targetPhone ? `(TEST)` : ''} ---`);
    
    const { morningPrompt, nightPrompt, autoSendEnabled } = userNode.settings;
    if (!targetPhone && autoSendEnabled === false) {
        console.log(`[${username}] Automação está DESATIVADA. Abortando.`);
        return;
    }

    const prompt = type === 'morning' ? morningPrompt : nightPrompt;
    const greeting = type === 'morning' ? "Bom dia! ☀️" : "Boa noite! 🌙";

    try {
        let aiContent = { image: null, caption: greeting };
        try {
            aiContent = await generateImage(prompt, type);
        } catch (iaError) {
            console.error(`[${username}] IA falhou:`, iaError.message);
        }
        
        const finalImage = aiContent.image;
        const finalGreeting = aiContent.caption || greeting;
        
        let successes = [];
        let failures = [];

        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
        const contactsWithEventToday = (userNode.calendar || [])
            .filter(e => e.date === today && !e.sent)
            .map(e => e.targetId);

        let contactsToSend = targetPhone 
            ? userNode.contacts.filter(c => sanitizePhone(c.phone) === sanitizePhone(targetPhone))
            : [...userNode.contacts];

        if (!targetPhone) {
            contactsToSend = contactsToSend.filter(c => !contactsWithEventToday.includes(c.phone) && !contactsWithEventToday.includes(sanitizePhone(c.phone)));
        }

        if (targetPhone && contactsToSend.length === 0) {
            contactsToSend.push({ name: "Teste", phone: targetPhone });
        }

        for (const contact of contactsToSend) {
            try {
                const cleanPhone = sanitizePhone(contact.phone);
                console.log(`[${username}] Sending to ${contact.name} (${cleanPhone})...`);
                await sendMessage(username, cleanPhone, finalGreeting, finalImage);
                successes.push({ name: contact.name, phone: cleanPhone });
                
                if (contactsToSend.length > 1) {
                    const delay = Math.floor(Math.random() * (25000 - 10000 + 1) + 10000);
                    await new Promise(r => setTimeout(r, delay));
                }
            } catch (err) {
                console.error(`[${username}] Failed to send to ${contact.phone}:`, err.message);
                failures.push({ name: contact.name, phone: contact.phone, error: err.message });
            }
        }

        const finalStatus = failures.length === 0 ? 'success' : (successes.length === 0 ? 'error' : 'warning');
        addLog(username, type, finalStatus, {
            summary: `Enviado para ${successes.length} contatos. Falhas: ${failures.length}`,
            successes,
            failures
        });
        console.log(`--- ${type.toUpperCase()} COMPLETED PARA ${username} ---`);
    } catch (err) {
        console.error(`[${username}] Critical error:`, err);
        addLog(username, type, 'error', { summary: "Erro crítico", error: err.message });
    }
}

app.post('/test-now', async (req, res) => {
    const { type, contactPhone } = req.body; 
    const db = getDB();
    const userNode = getUserNode(db, req.user.username);
    runAutomationForUser(userNode, type || 'morning', contactPhone);
    res.json({ success: true, message: "Automação de teste iniciada" });
});

async function runCalendarEvents() {
    const db = getDB();
    if (!db.users) return;

    const now = new Date();
    const today = now.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); 
    const timeNow = now.toLocaleTimeString('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });

    let dbChanged = false;

    for (const user of db.users) {
        const pendingEvents = user.calendar.filter(e => !e.sent && e.date === today && e.time === timeNow);
        if (pendingEvents.length === 0) continue;

        console.log(`\n--- ENVIANDO EVENTOS DE CALENDÁRIO (${user.username}): ${today} ${timeNow} ---`);
        for (const event of pendingEvents) {
            try {
                let mediaBuffer = null, filename = null;
                if (event.imagePath && fs.existsSync(event.imagePath)) {
                    mediaBuffer = fs.readFileSync(event.imagePath);
                    filename = path.basename(event.imagePath);
                }
                const targetId = event.targetId.includes('@g.us') ? event.targetId : sanitizePhone(event.targetId);

                await sendMessage(user.username, targetId, event.text, mediaBuffer, filename);
                console.log(`[${user.username}] Evento enviado para ${targetId}`);

                event.sent = true;
                dbChanged = true;

                if (event.imagePath && fs.existsSync(event.imagePath)) {
                    fs.unlinkSync(event.imagePath);
                    event.imagePath = null;
                }
            } catch (err) {
                console.error(`[${user.username}] Falha ao enviar evento para ${event.targetId}:`, err.message);
            }
        }
    }

    if (dbChanged) saveDB(db);
}

// CRON JOBS AVALIAM HORÁRIOS DE CADA USUÁRIO
let cronJobs = [];

function scheduleAllJobs() {
    // Limpar jobs anteriores
    cronJobs.forEach(job => job.stop());
    cronJobs = [];

    const db = getDB();
    
    // Cria os cron jobs diários baseados nos horários de CADA usuário
    for (const user of db.users) {
        if (!user.settings) continue;
        const [mHour, mMin] = user.settings.morningTime.split(':');
        const [nHour, nMin] = user.settings.nightTime.split(':');

        cronJobs.push(cron.schedule(`${mMin} ${mHour} * * *`, () => {
            const currentDb = getDB(); // pega db atualizado
            const uNode = getUserNode(currentDb, user.username);
            if (uNode) runAutomationForUser(uNode, 'morning');
        }));

        cronJobs.push(cron.schedule(`${nMin} ${nHour} * * *`, () => {
            const currentDb = getDB();
            const uNode = getUserNode(currentDb, user.username);
            if (uNode) runAutomationForUser(uNode, 'night');
        }));
    }

    // Cron Job por minuto para o calendário
    cronJobs.push(cron.schedule('* * * * *', runCalendarEvents));

    console.log(`Jobs reagendados para ${db.users.length} usuários.`);
}

app.post('/clear-cache', (req, res) => {
    try {
        const cacheDir = path.join(process.cwd(), 'cache');
        if (fs.existsSync(cacheDir)) {
            const files = fs.readdirSync(cacheDir);
            for (const file of files) { try { fs.unlinkSync(path.join(cacheDir, file)); } catch (e) {} }
            res.json({ success: true, message: "Cache limpo" });
        } else {
            res.json({ success: true, message: "Vazio" });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// START
const initialDb = getDB();
initializeAllClientsSequentially(initialDb.users);
scheduleAllJobs();

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
