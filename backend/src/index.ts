import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { createServer } from 'http'
import { connectDB } from './config/db'
import { initSocket } from './socket/socketServer'
import { startScheduledMessageJob, startGroupCleanupJob } from './utils/scheduledMessageJob'
import { startScheduledMessagesJob } from './jobs/scheduledMessagesJob'  // ?? BOT TIMER JOB - NEU!
import { startGiveawayJob } from './jobs/giveawayJob'  // ?? GIVEAWAY CRON JOB - NEU!
import { seedCommands } from './utils/seedCommands'  // ?? SEED COMMANDS - NEU!
import { seedNokkiBots } from './utils/seedNokkiBots' // 🤖 NOKKI BOTS SEED
import { runMigrations } from './utils/migrations'
import { getRedis } from './utils/redis'
import { sanitizeInput, securityHeaders } from './middleware/security'
import { uploadAccessMiddleware } from './middleware/auth'
import authRoutes         from './routes/auth'
import messageRoutes      from './routes/messages'
import conversationRoutes from './routes/conversations'
import contactRoutes      from './routes/contacts'
import userRoutes         from './routes/users'
import fileRoutes         from './routes/files'
import reportRoutes       from './routes/reports'
import adminRoutes        from './routes/admin'
import twofaRoutes        from './routes/twofa'
import pollRoutes         from './routes/polls'
import exportRoutes       from './routes/export'
import adminStatsRoutes   from './routes/adminStats'
import linkPreviewRoutes  from './routes/linkpreview'
import { startTimeCapsuleJob } from './utils/timeCapsuleJob'
import soundRoutes    from './routes/sounds'
import claimsRoutes      from './routes/claims'
import identityRoutes    from './routes/identities'
import publicRoutes   from './routes/public'
import adminDbRoutes  from './routes/adminDb'
import pushRoutes     from './routes/push'
import botTestMessagesRoutes from './routes/botTestMessages'

// ========== DEVELOPER PORTAL ROUTES ==========
import devAuthRoutes from './routes/devAuth';
import devBotsRoutes from './routes/devBots';
import devKeysRoutes      from './routes/devKeys';
import devAnalyticsRoutes from './routes/devAnalytics';
import botInstallRoutes from './routes/botInstall';
import botMessagesRoutes from './routes/botMessages';  // ?? BOT MESSAGE MANAGEMENT - NEU!
import giveawayRoutes from './routes/giveaways';        // ?? USER GIVEAWAY API - NEU!

// ========== NEUE FEATURES ==========
import paypalRoutes from './routes/paypal';           // TODO: axios issue - später aktivieren
import botStoreRoutes from './routes/botStore';       // Bot Store/Marketplace
import adminDevRoutes from './routes/adminDev';       // Admin Portal - Dev Stats
import statusRoutes from './routes/status'
import channelRoutes from './routes/conversationRoutes';  // User Conversations/Channels API
import botSchedulerRoutes from './routes/botScheduler'
import botGiveawaysRoutes from './routes/botGiveaways'  // ?? GIVEAWAY SYSTEM - NEU!
import botWebhooksRoutes from './routes/botWebhooks'    // ?? WEBHOOKS - NEU!
import botAnalyticsRoutes from './routes/botAnalytics'  // ?? ANALYTICS - NEU!
import botCommandsRoutes from './routes/botCommands'    // ? COMMANDS - NEU!

const app        = express()
const httpServer = createServer(app)

// Trust proxy (für IP-Adressen hinter Nginx)
app.set('trust proxy', 1)

// Security Headers
app.use(securityHeaders)

// CORS: nur die eigene Web-App und lokale Entwicklung zulassen
const allowedOrigins = new Set([
  new URL(process.env.APP_URL || 'https://lumestack.de').origin,
  ...(process.env.NODE_ENV === 'production' ? [] : ['http://localhost:5173', 'http://localhost:8084']),
])
app.use(cors({
  origin: (origin: string | undefined, cb: Function) => {
    if (!origin || allowedOrigins.has(origin)) cb(null, true)
    else cb(new Error('CORS-Origin nicht erlaubt'))
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
}))

// Body Parsing mit Größenlimit
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true, limit: '2mb' }))

// Input Sanitization (gegen XSS + NoSQL Injection)
app.use(sanitizeInput)

// Static Files
app.use('/uploads', uploadAccessMiddleware, express.static('uploads', {
  fallthrough: false,
  setHeaders: res => {
    res.setHeader('Cache-Control', 'private, no-store')
    res.setHeader('X-Robots-Tag', 'noindex, nofollow')
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin')
  },
}))

// ========== CHAT APP ROUTES ==========
app.use('/api/auth',          authRoutes)
app.use('/api/messages',      messageRoutes)
app.use('/api/conversations', conversationRoutes)
app.use('/api/contacts',      contactRoutes)
app.use('/api/users',         userRoutes)
app.use('/api/files',         fileRoutes)
app.use('/api/reports',       reportRoutes)
app.use('/api/admin',         adminRoutes)
app.use('/api/2fa',           twofaRoutes)
app.use('/api/polls',         pollRoutes)
app.use('/api/export',        exportRoutes)
app.use('/api/admin',         adminStatsRoutes)
app.use('/api/linkpreview',   linkPreviewRoutes)
app.use('/api/sounds',        soundRoutes)
app.use('/api/identities',    identityRoutes)
app.use('/api/claims',        claimsRoutes)
app.use('/api/public',        publicRoutes)   // Öffentlich, kein Auth
app.use('/api/push',          pushRoutes)      // Push Notifications
app.use('/api/admin',         adminDbRoutes)  // DB-Explorer
app.use('/api/giveaways',     giveawayRoutes)  // ?? User Giveaway API


// ========== DEVELOPER PORTAL ROUTES ==========
app.use('/api/dev', rateLimit({ windowMs: 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false }))
app.use('/api/dev/auth',      devAuthRoutes);
app.use('/api/dev/bots',      devBotsRoutes);
app.use('/api/dev/keys',      devKeysRoutes);
app.use('/api/dev',          devAnalyticsRoutes);
app.use('/api/bot-scheduler', botSchedulerRoutes);
app.use('/api/bot-messages',  botMessagesRoutes);  // ?? BOT MESSAGE MANAGEMENT - NEU!
app.use('/api/bot-giveaways', botGiveawaysRoutes);  // ?? GIVEAWAY SYSTEM - NEU!
app.use('/api/bot-webhooks',  botWebhooksRoutes);   // ?? WEBHOOKS - NEU!
app.use('/api/bot-analytics', botAnalyticsRoutes);  // ?? ANALYTICS - NEU!
app.use('/api/bot-commands',  botCommandsRoutes);   // ? COMMANDS - NEU!

// ========== NEUE FEATURES ==========
app.use('/api/bot-install',   botInstallRoutes);   // Bot Installation System
app.use('/api/payments',      paypalRoutes);       // TODO: axios issue - später aktivieren
app.use('/api/bot-store',     botStoreRoutes);     // Bot Store/Marketplace
app.use('/api/admin',         adminDevRoutes);     // Admin Portal - Dev Stats
app.use('/api/bot-test', botTestMessagesRoutes)
import channelNewRoute   from './routes/channels'
import notificationRoutes from './routes/notifications'
import screenshotProtectionRoutes from './routes/screenshotProtection'
app.use('/api/status', statusRoutes)
app.use('/api/channels',      channelNewRoute)
app.use('/api/notifications', notificationRoutes)
app.use('/api/conversations', screenshotProtectionRoutes)

// Health Check
app.get('/api/health', (_req, res) => res.json({
  status: 'ok', app: 'Nokki', time: new Date().toISOString(),
}))

// 404
app.use((_req, res) => res.status(404).json({ error: 'Nicht gefunden' }))

// Error Handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err.message)
  res.status(500).json({ error: 'Interner Serverfehler' })
})

const PORT = parseInt(process.env.PORT || '4000')

connectDB().then(async () => {
  await runMigrations()  // Daten-Migration beim Start
  
  // Redis initialisieren
  try {
    getRedis() // Startet Redis-Connection und zeigt Logs
    console.log('? Redis wird initialisiert...')
  } catch (err) {
    console.error('? Redis-Initialisierung fehlgeschlagen:', err)
  }
  
  initSocket(httpServer)
  
  // ========== SEED COMMANDS ==========
  await seedCommands()    // ?? Lade vordefinierte Commands in DB
  await seedNokkiBots()   // 🤖 Lade offizielle Nokki-Bots
  
  // ========== JOBS STARTEN ==========
  startScheduledMessageJob()      // User scheduled messages (alte Funktion)
  startGroupCleanupJob()           // Gruppen-Cleanup
  startTimeCapsuleJob()            // Time Capsules
  startScheduledMessagesJob()      // ?? BOT TIMER-NACHRICHTEN (NEU!)
  startGiveawayJob()               // ?? GIVEAWAY AUTO-END (NEU!)
  
  httpServer.listen(PORT, () => console.log(`? Nokki API läuft auf Port ${PORT}`))
}).catch((err: Error) => {
  console.error('? Startup Fehler:', err)
  process.exit(1)
})
