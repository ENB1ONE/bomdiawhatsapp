require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { initWhatsApp, sendMessage, getStatus } = require('./services/whatsapp');
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

// Middleware de Autenticação
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: "Acesso negado. Autenticação necessária." });
    }

    const auth = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
    const user = auth[0];
    const pass = auth[1];

    const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    const foundUser = db.users?.find(u => u.username === user && u.password === pass);

    if (foundUser) {
        req.user = foundUser;
        next();
    } else {
        res.status(401).json({ error: "Credenciais inválidas." });
    }
};

// Rota de Login (pública para o front validar)
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    const foundUser = db.users?.find(u => u.username === username && u.password === password);
    
    if (foundUser) {
        res.json({ success: true, role: foundUser.role });
    } else {
        res.status(401).json({ success: false, error: "Usuário ou senha incorretos" });
    }
});

// Proteger todas as rotas abaixo com o middleware
app.use(authMiddleware);

if (!fs.existsSync(DB_PATH)) {
    const initialData = {
        contacts: [],
        logs: [],
        users: [{ username: "enb1one", password: "enb1palms@28", role: "admin" }],
        calendar: [],
        settings: {
            morningPrompt: "Com fé e otimismo, gere uma mensagem calorosa de 'Bom Dia' para WhatsApp com encorajamento, saúde, esperança e emojis. Crie também um prompt em inglês de uma imagem matinal realista, vibrante e de paz. A imagem DEVE ser 100% visual, estritamente SEM textos ou letras.",
            nightPrompt: "Com fé e otimismo, gere uma mensagem calorosa de 'Boa Noite' para WhatsApp com encorajamento, saúde, esperança e emojis. Crie também um prompt em inglês de uma imagem noturna realista, aconchegante e de paz. A imagem DEVE ser 100% visual, estritamente SEM textos ou letras.",
            morningTime: "08:00",
            nightTime: "20:00",
            autoSendEnabled: true
        }
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2));
}

const DEFAULT_MORNING = "Com fé e otimismo, gere uma mensagem calorosa de 'Bom Dia' para WhatsApp com encorajamento, saúde, esperança e emojis. Crie também um prompt em inglês de uma imagem matinal realista, vibrante e de paz. A imagem DEVE ser 100% visual, estritamente SEM textos ou letras.";
const DEFAULT_NIGHT = "Com fé e otimismo, gere uma mensagem calorosa de 'Boa Noite' para WhatsApp com encorajamento, saúde, esperança e emojis. Crie também um prompt em inglês de uma imagem noturna realista, aconchegante e de paz. A imagem DEVE ser 100% visual, estritamente SEM textos ou letras.";

function getDB() {
    const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    if (!db.logs) db.logs = [];
    
    // Migração automática para garantir os novos prompts ricos e remover instruções antigas de texto na imagem
    let changed = false;

    // Se o usuário ainda estiver usando o padrão antigo (Aja como uma tia...), forçamos a atualização para o novo padrão solicitado.
    const isOldPattern = (text) => text && text.includes("Aja como uma tia");

    if (!db.settings.morningPrompt || db.settings.morningPrompt.length < 50 || isOldPattern(db.settings.morningPrompt)) {
        db.settings.morningPrompt = DEFAULT_MORNING;
        changed = true;
    }

    if (!db.settings.nightPrompt || db.settings.nightPrompt.length < 50 || isOldPattern(db.settings.nightPrompt)) {
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
const adminOnly = (req, res, next) => {
    if (req.user && req.user.role === 'admin') next();
    else res.status(403).json({ error: "Acesso negado. Apenas administradores." });
};

app.get('/users', adminOnly, (req, res) => {
    const db = getDB();
    // Não retorna senhas para o front
    const safeUsers = (db.users || []).map(u => ({ username: u.username, role: u.role }));
    res.json(safeUsers);
});

app.post('/users', adminOnly, (req, res) => {
    const { username, password, role } = req.body;
    const db = getDB();
    if (!db.users) db.users = [];
    if (db.users.find(u => u.username === username)) {
        return res.status(400).json({ error: "Usuário já existe" });
    }
    db.users.push({ username, password, role: role || 'user' });
    saveDB(db);
    res.json({ success: true });
});

app.delete('/users/:username', adminOnly, (req, res) => {
    const { username } = req.params;
    const db = getDB();
    if (username === req.user.username) {
        return res.status(400).json({ error: "Não é possível deletar o próprio usuário" });
    }
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

app.put('/settings/toggle-auto', adminOnly, (req, res) => {
    const { enabled } = req.body;
    const db = getDB();
    db.settings.autoSendEnabled = enabled;
    saveDB(db);
    res.json({ success: true, autoSendEnabled: enabled });
});

app.get('/calendar', (req, res) => {
    res.json(getDB().calendar || []);
});

app.post('/calendar', adminOnly, upload.single('image'), (req, res) => {
    const { date, time, targetId, text } = req.body;
    const db = getDB();
    if (!db.calendar) db.calendar = [];
    
    const newEvent = {
        id: Date.now().toString(),
        date,
        time,
        targetId, // Group ID or Phone number
        text,
        imagePath: req.file ? req.file.path : null,
        sent: false
    };
    
    db.calendar.push(newEvent);
    saveDB(db);
    res.json({ success: true, event: newEvent });
});

app.delete('/calendar/:id', adminOnly, (req, res) => {
    const { id } = req.params;
    const db = getDB();
    if (!db.calendar) db.calendar = [];
    
    const eventIndex = db.calendar.findIndex(e => e.id === id);
    if (eventIndex !== -1) {
        const event = db.calendar[eventIndex];
        if (event.imagePath && fs.existsSync(event.imagePath)) {
            fs.unlinkSync(event.imagePath); // Clean up file
        }
        db.calendar.splice(eventIndex, 1);
        saveDB(db);
    }
    res.json({ success: true });
});

app.get('/groups', adminOnly, async (req, res) => {
    try {
        const { getClient } = require('./services/whatsapp');
        const client = getClient();
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
async function runAutomation(type, targetPhone = null) {
    console.log(`\n--- STARTING ${type.toUpperCase()} AUTOMATION ${targetPhone ? `(TEST FOR ${targetPhone})` : ''} ---`);
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

        // Verifica se a automação global está ativa (só importa se não for um teste manual)
        if (!targetPhone && db.settings.autoSendEnabled === false) {
            console.log("Automação Global está DESATIVADA. Abortando envio automático.");
            return;
        }

        // Determina data de hoje no formato YYYY-MM-DD local
        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

        // Identifica os contatos (targetId) que possuem agendamento no calendário para o dia de hoje
        const contactsWithEventToday = (db.calendar || [])
            .filter(e => e.date === today && !e.sent)
            .map(e => e.targetId);

        // Filtra contatos se houver um targetPhone específico
        let contactsToSend = targetPhone 
            ? db.contacts.filter(c => sanitizePhone(c.phone) === sanitizePhone(targetPhone))
            : db.contacts;

        // Se for um envio automático, remove da lista de envio quem tem evento hoje
        if (!targetPhone) {
            contactsToSend = contactsToSend.filter(c => !contactsWithEventToday.includes(c.phone) && !contactsWithEventToday.includes(sanitizePhone(c.phone)));
            if (contactsToSend.length < db.contacts.length) {
                console.log(`Excluídos ${db.contacts.length - contactsToSend.length} contatos do envio automático pois possuem eventos no calendário hoje.`);
            }
        }

        if (targetPhone && contactsToSend.length === 0) {
            // Se o contato de teste não existe no BD, enviamos direto para ele mesmo assim
            contactsToSend.push({ name: "Teste", phone: targetPhone });
        }

        for (const contact of contactsToSend) {
            try {
                const cleanPhone = sanitizePhone(contact.phone);
                console.log(`Sending to ${contact.name} (${cleanPhone})...`);
                await sendMessage(cleanPhone, finalGreeting, finalImage);
                successes.push({ name: contact.name, phone: cleanPhone });
                
                if (contactsToSend.length > 1) {
                    // Delay aleatório maior para evitar sobrecarga no navegador (10 a 25 segundos)
                    const delay = Math.floor(Math.random() * (25000 - 10000 + 1) + 10000);
                    await new Promise(r => setTimeout(r, delay));
                }
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

async function runCalendarEvents() {
    const db = getDB();
    if (!db.calendar || db.calendar.length === 0) return;

    const now = new Date();
    // Use local time in Brazil to compare with stored dates/times
    const today = now.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); // YYYY-MM-DD
    const timeNow = now.toLocaleTimeString('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }); // HH:MM

    const pendingEvents = db.calendar.filter(e => !e.sent && e.date === today && e.time === timeNow);

    if (pendingEvents.length === 0) return;

    console.log(`\n--- ENVIANDO EVENTOS AGENDADOS: ${today} ${timeNow} ---`);
    
    let dbChanged = false;

    for (const event of pendingEvents) {
        try {
            console.log(`Enviando evento para ${event.targetId}...`);
            let mediaBuffer = null;
            let filename = null;

            if (event.imagePath && fs.existsSync(event.imagePath)) {
                mediaBuffer = fs.readFileSync(event.imagePath);
                filename = path.basename(event.imagePath);
            }

            const targetId = event.targetId.includes('@g.us') ? event.targetId : sanitizePhone(event.targetId);

            await sendMessage(targetId, event.text, mediaBuffer, filename);
            console.log(`Evento enviado com sucesso para ${targetId}`);

            event.sent = true;
            dbChanged = true;

            // Apagar a imagem após envio com sucesso
            if (event.imagePath && fs.existsSync(event.imagePath)) {
                fs.unlinkSync(event.imagePath);
                event.imagePath = null;
            }

        } catch (err) {
            console.error(`Falha ao enviar evento para ${event.targetId}:`, err.message);
        }
    }

    if (dbChanged) {
        // Recarrega o DB caso tenha sido modificado em paralelo e atualiza os status
        const latestDb = getDB();
        pendingEvents.forEach(pe => {
            const ev = latestDb.calendar.find(e => e.id === pe.id);
            if (ev) {
                ev.sent = pe.sent;
                ev.imagePath = pe.imagePath;
            }
        });
        saveDB(latestDb);
    }
}

// Dynamic Scheduling Logic
let morningJob = null;
let nightJob = null;
let calendarJob = null;

function scheduleAllJobs() {
    const db = getDB();
    const { morningTime, nightTime } = db.settings;

    // Stop existing jobs
    if (morningJob) morningJob.stop();
    if (nightJob) nightJob.stop();
    if (calendarJob) calendarJob.stop();

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

    // Run calendar checker every minute
    calendarJob = cron.schedule('* * * * *', () => {
        runCalendarEvents();
    });

    console.log(`Hora atual do servidor: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
    console.log(`Cron Jobs atualizados: Manhã (${morningTime}), Noite (${nightTime})`);
}

// Manual Trigger
app.post('/test-now', async (req, res) => {
    const { type, contactPhone } = req.body; 
    runAutomation(type || 'morning', contactPhone);
    res.json({ success: true, message: contactPhone ? `Teste enviado para ${contactPhone}` : "Automação iniciada" });
});

// Clear Cache endpoint
app.post('/clear-cache', (req, res) => {
    console.log("--- SOLICITAÇÃO: Limpar Cache ---");
    try {
        const cacheDir = path.join(process.cwd(), 'cache');
        if (fs.existsSync(cacheDir)) {
            const files = fs.readdirSync(cacheDir);
            console.log(`Encontrados ${files.length} arquivos no cache. Apagando...`);
            for (const file of files) {
                try {
                    fs.unlinkSync(path.join(cacheDir, file));
                } catch (e) {
                    console.error(`Erro ao deletar arquivo ${file}:`, e.message);
                }
            }
            console.log("SUCESSO: Cache de imagens e textos limpo.");
            res.json({ success: true, message: "Cache limpo com sucesso" });
        } else {
            console.log("AVISO: Diretório de cache não encontrado (está vazio).");
            res.json({ success: true, message: "Cache já estava vazio" });
        }
    } catch (err) {
        console.error("ERRO CRÍTICO ao limpar cache:", err);
        res.status(500).json({ success: false, error: err.message });
    }
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
