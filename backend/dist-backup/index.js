"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = require("http");
const db_1 = require("./config/db");
const socketServer_1 = require("./socket/socketServer");
const scheduledMessageJob_1 = require("./utils/scheduledMessageJob");
const migrations_1 = require("./utils/migrations");
const redis_1 = require("./utils/redis");
const security_1 = require("./middleware/security");
const auth_1 = __importDefault(require("./routes/auth"));
const messages_1 = __importDefault(require("./routes/messages"));
const conversations_1 = __importDefault(require("./routes/conversations"));
const contacts_1 = __importDefault(require("./routes/contacts"));
const users_1 = __importDefault(require("./routes/users"));
const files_1 = __importDefault(require("./routes/files"));
const reports_1 = __importDefault(require("./routes/reports"));
const admin_1 = __importDefault(require("./routes/admin"));
const twofa_1 = __importDefault(require("./routes/twofa"));
const polls_1 = __importDefault(require("./routes/polls"));
const export_1 = __importDefault(require("./routes/export"));
const adminStats_1 = __importDefault(require("./routes/adminStats"));
const linkpreview_1 = __importDefault(require("./routes/linkpreview"));
const timeCapsuleJob_1 = require("./utils/timeCapsuleJob");
const sounds_1 = __importDefault(require("./routes/sounds"));
const claims_1 = __importDefault(require("./routes/claims"));
const identities_1 = __importDefault(require("./routes/identities"));
const public_1 = __importDefault(require("./routes/public"));
const adminDb_1 = __importDefault(require("./routes/adminDb"));
const push_1 = __importDefault(require("./routes/push"));
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
// Trust proxy (für IP-Adressen hinter Nginx)
app.set('trust proxy', 1);
// Security Headers
app.use(security_1.securityHeaders);
// CORS
app.use((0, cors_1.default)({
    origin: (origin, cb) => { cb(null, true); }, // alle Origins erlaubt - Nginx übernimmt Sicherheit
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));
// Body Parsing mit Größenlimit
app.use(express_1.default.json({ limit: '2mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '2mb' }));
// Input Sanitization (gegen XSS + NoSQL Injection)
app.use(security_1.sanitizeInput);
// Static Files
app.use('/uploads', express_1.default.static('uploads'));
// Routes
app.use('/api/auth', auth_1.default);
app.use('/api/messages', messages_1.default);
app.use('/api/conversations', conversations_1.default);
app.use('/api/contacts', contacts_1.default);
app.use('/api/users', users_1.default);
app.use('/api/files', files_1.default);
app.use('/api/reports', reports_1.default);
app.use('/api/admin', admin_1.default);
app.use('/api/2fa', twofa_1.default);
app.use('/api/polls', polls_1.default);
app.use('/api/export', export_1.default);
app.use('/api/admin', adminStats_1.default);
app.use('/api/linkpreview', linkpreview_1.default);
app.use('/api/sounds', sounds_1.default);
app.use('/api/identities', identities_1.default);
app.use('/api/claims', claims_1.default);
app.use('/api/public', public_1.default); // Öffentlich, kein Auth
app.use('/api/push', push_1.default); // Push Notifications
app.use('/api/admin', adminDb_1.default); // DB-Explorer
app.get('/api/health', (_req, res) => res.json({
    status: 'ok', app: 'PingR', time: new Date().toISOString(),
}));
// 404
app.use((_req, res) => res.status(404).json({ error: 'Nicht gefunden' }));
// Error Handler
app.use((err, _req, res, _next) => {
    console.error('Unhandled error:', err.message);
    res.status(500).json({ error: 'Interner Serverfehler' });
});
const PORT = parseInt(process.env.PORT || '4000');
(0, db_1.connectDB)().then(async () => {
    await (0, migrations_1.runMigrations)(); // Daten-Migration beim Start
    // Redis initialisieren
    try {
        (0, redis_1.getRedis)(); // Startet Redis-Connection und zeigt Logs
        console.log('✅ Redis wird initialisiert...');
    }
    catch (err) {
        console.error('❌ Redis-Initialisierung fehlgeschlagen:', err);
    }
    (0, socketServer_1.initSocket)(httpServer);
    (0, scheduledMessageJob_1.startScheduledMessageJob)();
    (0, scheduledMessageJob_1.startGroupCleanupJob)();
    (0, timeCapsuleJob_1.startTimeCapsuleJob)();
    httpServer.listen(PORT, () => console.log(`✅ PingR API läuft auf Port ${PORT}`));
}).catch((err) => {
    console.error('❌ Startup Fehler:', err);
    process.exit(1);
});
