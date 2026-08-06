import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import DevUser from '../models/DevUser';
import rateLimit from 'express-rate-limit';
import { authMiddleware } from '../middleware/devAuth';
import Bot from '../models/Bot';
import BotInstallation from '../models/BotInstallation';
import BotWebhook from '../models/BotWebhook';
import ScheduledMessage from '../models/ScheduledMessage';
import Giveaway from '../models/Giveaway';
import BotAnalytics from '../models/BotAnalytics';
import DevSession from '../models/DevSession';
import { sendDeveloperPasswordResetEmail, sendDeveloperVerificationEmail } from '../utils/mailer';
import {
  hashSecret, normalizeDevEmail, randomToken, validDevEmail, validDevPassword, validDevUsername,
} from '../utils/devAuthSecurity';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET fehlt');

const devAuthLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false })
const devRecoveryLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false })
const hashApiKey = hashSecret

function issueDevToken(user: any) {
  return jwt.sign({ userId: user._id.toString(), email: user.email, sessionVersion: 2 }, JWT_SECRET!, {
    algorithm: 'HS256', expiresIn: '15m', issuer: 'nokki-dev'
  })
}

const sessionCookieOptions = (maxAge?: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/api/dev/auth',
  ...(maxAge ? { maxAge } : {}),
})

async function issueDevSession(req: Request, res: Response, user: any, remember = false) {
  const rawToken = randomToken(48)
  const lifetimeMs = remember ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000
  await DevSession.create({
    userId: user._id,
    tokenHash: hashSecret(rawToken),
    expiresAt: new Date(Date.now() + lifetimeMs),
    userAgent: String(req.headers['user-agent'] || '').slice(0, 500),
    ip: String(req.ip || '').slice(0, 100),
  })
  res.cookie('nokki_dev_refresh', rawToken, sessionCookieOptions(lifetimeMs))
  return issueDevToken(user)
}

function clearDevSessionCookie(res: Response) {
  res.clearCookie('nokki_dev_refresh', sessionCookieOptions())
}

async function createVerification(user: any) {
  const token = randomToken(32)
  user.emailVerifyTokenHash = hashSecret(token)
  user.emailVerifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000)
  user.emailVerified = false
  await user.save()
  await sendDeveloperVerificationEmail(user.email, user.username, token)
}

// Register
router.post('/register', devAuthLimiter, async (req: Request, res: Response) => {
  try {
    const username = String(req.body.username || '').trim();
    const email = normalizeDevEmail(req.body.email);
    const password = String(req.body.password || '');

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Alle Felder sind erforderlich' });
    }

    if (!validDevPassword(password)) {
      return res.status(400).json({ error: 'Passwort muss mindestens 10 Zeichen lang sein' });
    }
    if (!validDevUsername(username)) return res.status(400).json({ error: 'Username: 3–30 Zeichen, nur Buchstaben, Zahlen und Unterstrich' });
    if (!validDevEmail(email)) return res.status(400).json({ error: 'Ungültige E-Mail-Adresse' });

    // Check if user exists
    const existingUser = await DevUser.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ error: 'E-Mail oder Username bereits vergeben' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate API Key
    const apiKey = `sk_live_${crypto.randomBytes(32).toString('base64url')}`;

    // Create user
    const newUser = new DevUser({
      username,
      email,
      password: hashedPassword,
      apiKeyHash: hashApiKey(apiKey),
      apiKeyPrefix: `${apiKey.slice(0, 16)}…`,
      createdAt: new Date(),
      emailVerified: false,
      bots: [],
    });

    await createVerification(newUser);

    // Generate JWT
    const token = await issueDevSession(req, res, newUser);

    res.status(201).json({
      token,
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        emailVerified: false,
      },
      apiKey,
      apiKeyNotice: 'Dieser Schlüssel wird nur einmal vollständig angezeigt.',
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Serverfehler bei der Registrierung' });
  }
});

// Login
router.post('/login', devAuthLimiter, async (req: Request, res: Response) => {
  try {
    const email = normalizeDevEmail(req.body.email);
    const password = String(req.body.password || '');
    const remember = req.body.remember === true;

    if (!email || !password) {
      return res.status(400).json({ error: 'E-Mail und Passwort erforderlich' });
    }

    // Find user
    const user = await DevUser.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    }

    // Generate JWT
    if (user.isBanned && (!user.bannedUntil || user.bannedUntil > new Date())) return res.status(403).json({ error: 'Developer-Account gesperrt' });
    const token = await issueDevSession(req, res, user, remember);

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        emailVerified: user.emailVerified === true,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Serverfehler beim Login' });
  }
});

// ── Hilfsfunktionen ──────────────────────────────────────────────────────────
function makeApiKey() {
  return `sk_live_${crypto.randomBytes(32).toString('base64url')}`
}

function getFrontendUrl() {
  // z.B. http://217.154.165.25:8084 → http://217.154.165.25:3000
  return (process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '')
}

function readCookie(req: Request, name: string): string {
  const part = String(req.headers.cookie || '').split(';').find(value => value.trim().startsWith(`${name}=`))
  return part ? decodeURIComponent(part.trim().slice(name.length + 1)) : ''
}

function beginOAuth(res: Response, provider: 'github' | 'google') {
  const state = crypto.randomBytes(24).toString('base64url')
  const verifier = crypto.randomBytes(48).toString('base64url')
  const signedState = jwt.sign({ provider, state }, JWT_SECRET!, { algorithm: 'HS256', expiresIn: '10m', issuer: 'nokki-oauth' })
  const cookieOptions: any = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 10 * 60 * 1000, path: '/api/dev/auth' }
  res.cookie('nokki_oauth_state', signedState, cookieOptions)
  res.cookie('nokki_oauth_verifier', verifier, cookieOptions)
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url')
  return { state, verifier, challenge }
}

function verifyOAuth(req: Request, provider: 'github' | 'google'): { verifier: string } | null {
  try {
    const signedState = readCookie(req, 'nokki_oauth_state')
    const verifier = readCookie(req, 'nokki_oauth_verifier')
    const payload = jwt.verify(signedState, JWT_SECRET!, { algorithms: ['HS256'], issuer: 'nokki-oauth' }) as any
    if (!verifier || payload.provider !== provider || payload.state !== req.query.state) return null
    return { verifier }
  } catch { return null }
}

function clearOAuth(res: Response) {
  const opts: any = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/api/dev/auth' }
  res.clearCookie('nokki_oauth_state', opts)
  res.clearCookie('nokki_oauth_verifier', opts)
}

function apiKeyFields() {
  const key = makeApiKey()
  return { apiKeyHash: hashApiKey(key), apiKeyPrefix: `${key.slice(0, 16)}…` }
}

// Kurzes Access-Token erneuern und das einmalig nutzbare Refresh-Token rotieren.
router.post('/refresh', devAuthLimiter, async (req: Request, res: Response) => {
  const rawToken = readCookie(req, 'nokki_dev_refresh')
  if (!rawToken) return res.status(401).json({ error: 'Keine erneuerbare Developer-Sitzung' })
  try {
    const session = await DevSession.findOne({
      tokenHash: hashSecret(rawToken),
      expiresAt: { $gt: new Date() },
    }).select('+tokenHash')
    if (!session) {
      clearDevSessionCookie(res)
      return res.status(401).json({ error: 'Developer-Sitzung abgelaufen' })
    }
    const user = await DevUser.findById(session.userId)
    await DevSession.deleteOne({ _id: session._id })
    if (!user || (user.isBanned && (!user.bannedUntil || user.bannedUntil > new Date()))) {
      clearDevSessionCookie(res)
      return res.status(401).json({ error: 'Developer-Sitzung ungültig' })
    }
    const remainingMs = session.expiresAt.getTime() - Date.now()
    const remember = remainingMs > 2 * 24 * 60 * 60 * 1000
    const token = await issueDevSession(req, res, user, remember)
    return res.json({ token, user: { id: user._id, username: user.username, email: user.email, emailVerified: user.emailVerified === true } })
  } catch (error) {
    console.error('Developer refresh error:', error)
    clearDevSessionCookie(res)
    return res.status(401).json({ error: 'Developer-Sitzung konnte nicht erneuert werden' })
  }
})

router.post('/logout', async (req: Request, res: Response) => {
  const rawToken = readCookie(req, 'nokki_dev_refresh')
  if (rawToken) await DevSession.deleteOne({ tokenHash: hashSecret(rawToken) })
  clearDevSessionCookie(res)
  res.json({ success: true })
})

router.get('/verify-email', devRecoveryLimiter, async (req: Request, res: Response) => {
  const frontend = getFrontendUrl()
  const token = String(req.query.token || '')
  if (!token) return res.redirect(`${frontend}/dev-login?verification=invalid`)
  const user = await DevUser.findOne({
    emailVerifyTokenHash: hashSecret(token),
    emailVerifyExpires: { $gt: new Date() },
  }).select('+emailVerifyTokenHash +emailVerifyExpires')
  if (!user) return res.redirect(`${frontend}/dev-login?verification=invalid`)
  user.emailVerified = true
  user.emailVerifyTokenHash = undefined
  user.emailVerifyExpires = undefined
  await user.save()
  return res.redirect(`${frontend}/dev-login?verification=success`)
})

router.post('/resend-verification', devRecoveryLimiter, authMiddleware, async (req: Request, res: Response) => {
  const user = await DevUser.findById((req as any).userId).select('+emailVerifyTokenHash +emailVerifyExpires')
  if (!user) return res.status(404).json({ error: 'Developer-Account nicht gefunden' })
  if (user.emailVerified) return res.json({ message: 'E-Mail ist bereits bestätigt.' })
  await createVerification(user)
  return res.json({ message: 'Bestätigungs-E-Mail wurde versendet.' })
})

router.post('/forgot-password', devRecoveryLimiter, async (req: Request, res: Response) => {
  const email = normalizeDevEmail(req.body.email)
  const generic = { message: 'Falls die E-Mail registriert ist, wurde ein Reset-Link versendet.' }
  if (!validDevEmail(email)) return res.json(generic)
  const user = await DevUser.findOne({ email }).select('+passwordResetTokenHash +passwordResetExpires')
  if (!user) return res.json(generic)
  const token = randomToken(32)
  user.passwordResetTokenHash = hashSecret(token)
  user.passwordResetExpires = new Date(Date.now() + 30 * 60 * 1000)
  await user.save()
  await sendDeveloperPasswordResetEmail(user.email, user.username, token)
  return res.json(generic)
})

router.post('/reset-password', devRecoveryLimiter, async (req: Request, res: Response) => {
  const token = String(req.body.token || '')
  const password = String(req.body.password || '')
  if (!token || !validDevPassword(password)) return res.status(400).json({ error: 'Ungültiger Link oder Passwort unter 10 Zeichen' })
  const user = await DevUser.findOne({
    passwordResetTokenHash: hashSecret(token),
    passwordResetExpires: { $gt: new Date() },
  }).select('+passwordResetTokenHash +passwordResetExpires')
  if (!user) return res.status(400).json({ error: 'Reset-Link ist ungültig oder abgelaufen' })
  user.password = await bcrypt.hash(password, 12)
  user.passwordResetTokenHash = undefined
  user.passwordResetExpires = undefined
  await user.save()
  await DevSession.deleteMany({ userId: user._id })
  clearDevSessionCookie(res)
  return res.json({ success: true, message: 'Passwort wurde geändert. Bitte melde dich neu an.' })
})

// ── /me ───────────────────────────────────────────────────────────────────────
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = await DevUser.findById((req as any).userId).select('-password -apiKey -apiKeyHash')
    if (!user) return res.status(404).json({ error: 'User nicht gefunden' })
    res.json({ user })
  } catch { res.status(401).json({ error: 'Token ungültig' }) }
})

// ── PATCH /me ─────────────────────────────────────────────────────────────────
router.patch('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const username = String(req.body.username || '').trim()
    const email = normalizeDevEmail(req.body.email)
    if (!validDevUsername(username) || !validDevEmail(email)) return res.status(400).json({ error: 'Username oder E-Mail ungültig' })
    const duplicate = await DevUser.findOne({ _id: { $ne: (req as any).userId }, $or: [{ username }, { email }] })
    if (duplicate) return res.status(409).json({ error: 'Username oder E-Mail bereits vergeben' })
    const user = await DevUser.findById((req as any).userId).select('+emailVerifyTokenHash +emailVerifyExpires')
    if (!user) return res.status(404).json({ error: 'User nicht gefunden' })
    const emailChanged = user.email !== email
    user.username = username
    user.email = email
    if (emailChanged) await createVerification(user)
    else await user.save()
    res.json({ user: {
      id: user._id,
      username: user.username,
      email: user.email,
      emailVerified: user.emailVerified === true,
      notifications: user.notifications,
    } })
  } catch { res.status(500).json({ error: 'Serverfehler' }) }
})

// ── Change Password ───────────────────────────────────────────────────────────
router.post('/change-password', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body
    if (!currentPassword || !newPassword)
      return res.status(400).json({ error: 'Beide Passwörter erforderlich' })
    if (!validDevPassword(String(newPassword)))
      return res.status(400).json({ error: 'Mindestens 10 Zeichen' })
    const user = await DevUser.findById((req as any).userId)
    if (!user) return res.status(404).json({ error: 'User nicht gefunden' })
    if (!(await bcrypt.compare(currentPassword, user.password)))
      return res.status(401).json({ error: 'Aktuelles Passwort falsch' })
    user.password = await bcrypt.hash(newPassword, 12)
    await user.save()
    await DevSession.deleteMany({ userId: user._id })
    clearDevSessionCookie(res)
    res.json({ success: true, reauthenticate: true })
  } catch { res.status(500).json({ error: 'Serverfehler' }) }
})

router.patch('/notifications', authMiddleware, async (req: Request, res: Response) => {
  try {
    const notifications = {
      apiErrors: req.body.apiErrors === true,
      installs: req.body.installs === true,
      weekly: req.body.weekly === true,
    }
    const user = await DevUser.findByIdAndUpdate((req as any).userId, { notifications }, { new: true }).select('notifications')
    if (!user) return res.status(404).json({ error: 'User nicht gefunden' })
    res.json({ success: true, notifications: user.notifications })
  } catch { res.status(500).json({ error: 'Einstellungen konnten nicht gespeichert werden' }) }
})

router.delete('/delete', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId
    const bots = await Bot.find({ ownerId: userId }).select('botId').lean()
    const botIds = bots.map((bot: any) => bot.botId)
    await Promise.all([
      BotInstallation.deleteMany({ botId: { $in: botIds } }),
      BotWebhook.deleteMany({ botId: { $in: botIds } }),
      ScheduledMessage.deleteMany({ botId: { $in: botIds } }),
      Giveaway.deleteMany({ botId: { $in: botIds } }),
      BotAnalytics.deleteMany({ botId: { $in: botIds } }),
    ])
    await Bot.deleteMany({ ownerId: userId })
    await DevSession.deleteMany({ userId })
    await DevUser.findByIdAndDelete(userId)
    clearDevSessionCookie(res)
    res.json({ success: true })
  } catch (error) {
    console.error('Developer delete error:', error)
    res.status(500).json({ error: 'Account konnte nicht gelöscht werden' })
  }
})

// ── GitHub OAuth ──────────────────────────────────────────────────────────────
router.get('/github', (req: Request, res: Response) => {
  const clientId = process.env.GITHUB_CLIENT_ID
  const callback = process.env.GITHUB_CALLBACK_URL || 'http://localhost:8084/api/dev/auth/github/callback'
  if (!clientId) return res.status(500).json({ error: 'GITHUB_CLIENT_ID nicht konfiguriert' })
  const oauth = beginOAuth(res, 'github')
  const url = new URLSearchParams({ client_id: clientId, redirect_uri: callback, scope: 'user:email', state: oauth.state, code_challenge: oauth.challenge, code_challenge_method: 'S256' })
  res.redirect(`https://github.com/login/oauth/authorize?${url}`)
})

router.get('/github/callback', async (req: Request, res: Response) => {
  const { code } = req.query
  const frontend  = getFrontendUrl()
  const clientId  = process.env.GITHUB_CLIENT_ID!
  const clientSecret = process.env.GITHUB_CLIENT_SECRET!
  const callback  = process.env.GITHUB_CALLBACK_URL || 'http://localhost:8084/api/dev/auth/github/callback'

  if (!code) return res.redirect(`${frontend}/dev-login?oauth_error=github_no_code`)
  const oauth = verifyOAuth(req, 'github')
  if (!oauth) return res.redirect(`${frontend}/dev-login?oauth_error=oauth_state`)

  try {
    // 1. Token holen
    const tokRes  = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: callback, code_verifier: oauth.verifier }),
    })
    const tokData = await tokRes.json() as any
    if (!tokData.access_token) {
      console.error('[GitHub OAuth] Token error:', tokData)
      return res.redirect(`${frontend}/dev-login?oauth_error=github_token`)
    }

    // 2. GitHub User-Daten
    const gh = await (await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${tokData.access_token}`, 'User-Agent': 'Nokki-Dev' },
    })).json() as any

    // 3. E-Mail holen (kann privat sein)
    let email = gh.email
    if (!email) {
      const emails = await (await fetch('https://api.github.com/user/emails', {
        headers: { Authorization: `Bearer ${tokData.access_token}`, 'User-Agent': 'Nokki-Dev' },
      })).json() as any[]
      email = (emails.find((e: any) => e.primary && e.verified) || emails.find((e: any) => e.verified))?.email
    }
    if (!email) return res.redirect(`${frontend}/dev-login?oauth_error=github_no_email`)

    // 4. User anlegen / aktualisieren
    email = normalizeDevEmail(email)
    let user = await DevUser.findOne({ $or: [{ email }, { githubId: String(gh.id) }] })
    if (user) {
      if (!user.githubId) { user.githubId = String(gh.id); await user.save() }
    } else {
      let username = gh.login || email.split('@')[0]
      if (await DevUser.findOne({ username })) username = `${username}_gh`
      user = await new DevUser({
        username, email,
        password:      await bcrypt.hash(crypto.randomBytes(48).toString('base64url'), 12),
        ...apiKeyFields(),
        githubId:      String(gh.id),
        avatar:        gh.avatar_url || null,
        emailVerified: true,
        createdAt:     new Date(),
        bots:          [],
      }).save()
    }

    await issueDevSession(req, res, user)
    clearOAuth(res)
    res.redirect(`${frontend}/dev-oauth-callback`)
  } catch (err) {
    console.error('[GitHub OAuth] Error:', err)
    res.redirect(`${frontend}/dev-login?oauth_error=github_server`)
  }
})

// ── Google OAuth ──────────────────────────────────────────────────────────────
router.get('/google', (req: Request, res: Response) => {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const callback = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:8084/api/dev/auth/google/callback'
  if (!clientId) return res.status(500).json({ error: 'GOOGLE_CLIENT_ID nicht konfiguriert' })
  const oauth = beginOAuth(res, 'google')
  const url = new URLSearchParams({
    client_id: clientId, redirect_uri: callback,
    response_type: 'code', scope: 'openid email profile',
    access_type: 'offline', prompt: 'select_account',
    state: oauth.state, code_challenge: oauth.challenge, code_challenge_method: 'S256',
  })
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${url}`)
})

router.get('/google/callback', async (req: Request, res: Response) => {
  const { code, error: oErr } = req.query
  const frontend     = getFrontendUrl()
  const clientId     = process.env.GOOGLE_CLIENT_ID!
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!
  const callback     = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:8084/api/dev/auth/google/callback'

  if (oErr || !code) return res.redirect(`${frontend}/dev-login?oauth_error=google_cancelled`)
  const oauth = verifyOAuth(req, 'google')
  if (!oauth) return res.redirect(`${frontend}/dev-login?oauth_error=oauth_state`)

  try {
    // 1. Token holen
    const tokRes  = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: String(code), client_id: clientId, client_secret: clientSecret,
        redirect_uri: callback, grant_type: 'authorization_code', code_verifier: oauth.verifier,
      }),
    })
    const tokData = await tokRes.json() as any
    if (!tokData.access_token) {
      console.error('[Google OAuth] Token error:', tokData)
      return res.redirect(`${frontend}/dev-login?oauth_error=google_token`)
    }

    // 2. Google User-Daten
    const gu = await (await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokData.access_token}` },
    })).json() as any
    if (!gu.email || gu.verified_email === false) return res.redirect(`${frontend}/dev-login?oauth_error=google_no_email`)

    // 3. User anlegen / aktualisieren
    const googleEmail = normalizeDevEmail(gu.email)
    let user = await DevUser.findOne({ $or: [{ email: googleEmail }, { googleId: gu.id }] })
    if (user) {
      if (!user.googleId) { user.googleId = gu.id; await user.save() }
    } else {
      let username = (gu.name || gu.email.split('@')[0]).replace(/\s+/g, '_')
      if (await DevUser.findOne({ username })) username = `${username}_gg`
      user = await new DevUser({
        username, email: googleEmail,
        password:      await bcrypt.hash(crypto.randomBytes(48).toString('base64url'), 12),
        ...apiKeyFields(),
        googleId:      gu.id,
        avatar:        gu.picture || null,
        emailVerified: true,
        createdAt:     new Date(),
        bots:          [],
      }).save()
    }

    await issueDevSession(req, res, user)
    clearOAuth(res)
    res.redirect(`${frontend}/dev-oauth-callback`)
  } catch (err) {
    console.error('[Google OAuth] Error:', err)
    res.redirect(`${frontend}/dev-login?oauth_error=google_server`)
  }
})

export default router;
