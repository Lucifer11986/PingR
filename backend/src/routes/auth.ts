import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { User } from '../models/User'
import { authMiddleware, AuthRequest, createJWT, invalidateToken } from '../middleware/auth'
import { generateUIN } from '../utils/helpers'
import { validateEmail } from '../utils/emailValidator'
import { detectDevice } from '../utils/deviceDetector'
import { recordFailedAttempt, clearAttempts, checkIPBlacklist } from '../middleware/ipBlacklist'
import { encryptField, decryptField } from '../utils/fieldEncryption'
import { sendVerificationEmail, sendPasswordResetEmail, sendLoginAlert } from '../utils/mailer'
import { PRIVATE_USER_EXCLUDE } from '../utils/userFields'

const router = Router()
const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) throw new Error('JWT_SECRET fehlt')
const REFRESH_SECRET = process.env.REFRESH_SECRET || crypto.createHash('sha256').update(`${JWT_SECRET}:nokki-refresh`).digest('hex')
if (!process.env.REFRESH_SECRET) console.warn('⚠️ REFRESH_SECRET fehlt; abgeleiteter Schlüssel wird verwendet')

function readCookie(req: Request, name: string): string | undefined {
  const cookies = String(req.headers.cookie || '').split(';')
  for (const cookie of cookies) {
    const [key, ...value] = cookie.trim().split('=')
    if (key === name) return decodeURIComponent(value.join('='))
  }
  return undefined
}

function issueSession(res: Response, userId: string, extra: Record<string, unknown> = {}): string {
  const accessToken = createJWT(userId, undefined, extra)
  const refreshToken = jwt.sign({ userId, type: 'refresh', ...extra }, REFRESH_SECRET, {
    algorithm: 'HS256', expiresIn: '7d', issuer: 'nokki-api',
  })
  res.cookie('nokki_refresh', refreshToken, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict',
    path: '/api/auth', maxAge: 7 * 24 * 60 * 60 * 1000,
  })
  res.cookie('nokki_upload_access', accessToken, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict',
    path: '/uploads', maxAge: 60 * 60 * 1000,
  })
  return accessToken
}

// ── TOTP inline ───────────────────────────────────────────────────────────────
function base32Decode(s: string): Buffer {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = 0, value = 0
  const out: number[] = []
  for (const c of s.toUpperCase().replace(/=+$/, '')) {
    value = (value << 5) | chars.indexOf(c)
    bits += 5
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8 }
  }
  return Buffer.from(out)
}

function verifyTOTP(secret: string, token: string): boolean {
  try {
    const now = Math.floor(Date.now() / 1000 / 30)
    for (const delta of [-1, 0, 1]) {
      const time = now + delta
      const key  = base32Decode(secret)
      const buf  = Buffer.alloc(8)
      buf.writeUInt32BE(0, 0); buf.writeUInt32BE(time, 4)
      const hmac   = crypto.createHmac('sha1', key).update(buf).digest()
      const offset = hmac[19] & 0xf
      const code   = (((hmac[offset] & 0x7f) << 24) | (hmac[offset+1] << 16) | (hmac[offset+2] << 8) | hmac[offset+3]) % 1000000
      if (String(code).padStart(6, '0') === token) return true
    }
  } catch (_e) {}
  return false
}

function getIP(req: Request): string {
  try {
    // x-forwarded-for zuerst — Nginx setzt diesen Header mit der echten Client-IP
    const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    const realIP    = String(req.headers['x-real-ip'] || '').trim()
    const raw = forwarded
      || realIP
      || req.ip
      || req.socket?.remoteAddress
      || 'unknown'
    return raw.replace('::ffff:', '').trim() || 'unknown'
  } catch (_e) {
    return 'unknown'
  }
}


// ── GET /api/auth/captcha — CAPTCHA generieren ───────────────────────────────
const captchaStore = new Map<string, { answer: number; expiresAt: number }>()

router.get('/captcha', (req: Request, res: Response): void => {
  const a = Math.floor(Math.random() * 10) + 1
  const b = Math.floor(Math.random() * 10) + 1
  const id = require('crypto').randomBytes(8).toString('hex')
  captchaStore.set(id, { answer: a + b, expiresAt: Date.now() + 10 * 60 * 1000 })
  // Alte CAPTCHAs aufräumen
  for (const [k, v] of captchaStore.entries()) {
    if (Date.now() > v.expiresAt) captchaStore.delete(k)
  }
  res.json({ id, question: `${a} + ${b} = ?` })
})

// ── POST /api/auth/captcha/verify — CAPTCHA prüfen ──────────────────────────
router.post('/captcha/verify', (req: Request, res: Response): void => {
  const { id, answer } = req.body
  const captcha = captchaStore.get(id)
  if (!captcha || Date.now() > captcha.expiresAt) {
    res.status(400).json({ valid: false, error: 'CAPTCHA abgelaufen' }); return
  }
  const valid = parseInt(String(answer)) === captcha.answer
  if (valid) captchaStore.delete(id)
  res.json({ valid })
})

// ── POST /api/auth/register ───────────────────────────────────────────────────
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, email, password } = req.body
    if (!username?.trim() || !email?.trim() || !password) {
      res.status(400).json({ error: 'Alle Felder erforderlich' }); return
    }
    const emailCheck = validateEmail(email)
    if (!emailCheck.valid) { res.status(400).json({ error: emailCheck.reason }); return }
    if (String(password).length < 10) { res.status(400).json({ error: 'Passwort muss mindestens 10 Zeichen haben' }); return }

    const exists = await User.findOne({ email: email.toLowerCase().trim() })
    if (exists) { res.status(409).json({ error: 'E-Mail bereits vergeben' }); return }

    let deviceStr = 'desktop | Unbekannt | Unbekannt'
    let ipAddr = 'unknown'
    try {
      const device = detectDevice(req.headers['user-agent'] || '')
      deviceStr = `${device.deviceType} | ${device.os} | ${device.browser} ${device.browserVersion}`.trim()
      ipAddr = getIP(req)
    } catch (_de) {}

    const uin    = await generateUIN()
    const hashed = await bcrypt.hash(String(password), 12)
    const user   = await User.create({
      uin,
      username:   String(username).trim(),
      email:      email.toLowerCase().trim(),
      password:   hashed,
      lastDevice: deviceStr,
      lastIP:     encryptField(ipAddr),
      status:     'offline',
    })

    // Verifizierungs-Token generieren
    const verifyToken   = crypto.randomBytes(32).toString('hex')
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h
    await User.findByIdAndUpdate(user._id, {
      emailVerifyToken:   verifyToken,
      emailVerifyExpires: verifyExpires,
      emailVerified:      false,
    })

    // E-Mail senden (non-blocking, non-fatal)
    sendVerificationEmail(user.email, user.username, verifyToken, user.uin).then(sent => {
      if (!sent && process.env.NODE_ENV !== 'production') {
        console.log(`[Register] No SMTP configured — verify token: ${verifyToken}`)
      }
    })

    const token = issueSession(res, user._id.toString())
    res.status(201).json({
      token,
      emailVerified: false,
      user: { _id: user._id, uin: user.uin, username: user.username, email: user.email, status: user.status, emailVerified: false },
    })
  } catch (err) {
    console.error('[Register] Error:', err)
    res.status(500).json({ error: 'Serverfehler bei der Registrierung' })
  }
})

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', checkIPBlacklist, async (req: Request, res: Response): Promise<void> => {
  try {
    const { login, password, twoFaCode } = req.body

    if (!login || !password) {
      res.status(400).json({ error: 'Login und Passwort erforderlich' }); return
    }

    // Device + IP ermitteln (non-fatal)
    let deviceStr = 'desktop | Unbekannt | Unbekannt'
    let ipAddr = 'unknown'
    let deviceType = 'desktop'
    let deviceOS = 'Unbekannt'
    let deviceBrowser = 'Unbekannt'
    try {
      const device = detectDevice(String(req.headers['user-agent'] || ''))
      deviceStr    = `${device.deviceType} | ${device.os} | ${device.browser} ${device.browserVersion}`.trim()
      deviceType   = device.deviceType
      deviceOS     = device.os
      deviceBrowser = `${device.browser} ${device.browserVersion}`.trim()
      ipAddr = getIP(req)
    } catch (_de) {}

    // User finden
    const loginStr = String(login).trim()
    const isUIN    = /^\d+$/.test(loginStr)
    const query    = isUIN ? { uin: loginStr } : { email: loginStr.toLowerCase() }

    const user = await User.findOne(query)
    if (!user) {
      res.status(401).json({ error: 'UIN/E-Mail oder Passwort falsch' }); return
    }

    // Fake-PIN prüfen: wenn user einen fakePin hat und das eingegebene Passwort dem fakePin entspricht
    // → Token ausstellen aber mit isFakeAccount Flag, Frontend zeigt Schein-Account
    if ((user as any).fakePin) {
      const isFakeLogin = await bcrypt.compare(String(password), (user as any).fakePin)
      if (isFakeLogin) {
        const fakeToken = issueSession(res, user._id.toString(), { isFakeAccount: true })
        res.json({
          token: fakeToken,
          user: {
            _id:           user._id,
            uin:           (user as any).uin,
            username:      (user as any).fakeUsername || (user as any).username,
            statusMessage: (user as any).fakeStatusMessage || '',
            avatar:        null,
            isFakeAccount: true,
          }
        })
        return
      }
    }

    // Passwort prüfen
    const ok = await bcrypt.compare(String(password), user.password)
    if (!ok) {
      recordFailedAttempt(ipAddr)
      res.status(401).json({ error: 'UIN/E-Mail oder Passwort falsch' }); return
    }

    // Gebannt?
    if ((user as any).isBanned) {
      res.status(403).json({ error: `Konto gesperrt: ${(user as any).bannedReason || 'Verstoß gegen AGB'}` }); return
    }

    // 2FA prüfen
    if ((user as any).twoFactorEnabled && (user as any).twoFactorSecret) {
      if (!twoFaCode) {
        res.status(200).json({ requires2FA: true }); return
      }
      const normalizedCode = String(twoFaCode).replace(/\s|-/g, '').toUpperCase()
      const totpValid = verifyTOTP(decryptField(String((user as any).twoFactorSecret)), normalizedCode)
      const backupHash = crypto.createHash('sha256').update(normalizedCode).digest('hex')
      const backupCodes: string[] = (user as any).twoFactorBackup || []
      const backupIndex = backupCodes.indexOf(backupHash)
      if (!totpValid && backupIndex < 0) {
        recordFailedAttempt(ipAddr)
        res.status(401).json({ error: 'Ungültiger 2FA-Code' }); return
      }
      if (backupIndex >= 0) {
        backupCodes.splice(backupIndex, 1)
        await User.findByIdAndUpdate(user._id, { twoFactorBackup: backupCodes })
      }
    }

    // Status + Device + IP aktualisieren
    try {
      await User.findByIdAndUpdate(user._id, {
        status:     'online',
        lastSeen:   new Date(),
        lastDevice: deviceStr,
        lastIP:     encryptField(ipAddr),
      })
    } catch (_ue) {
      console.error('[Login] User update error (non-fatal):', _ue)
    }

    // Login-History (vollständig optional)
    try {
      const { LoginHistory } = require('../models/LoginHistory')
      LoginHistory.create({
        userId: user._id, ipAddress: ipAddr,
        device: deviceType, os: deviceOS, browser: deviceBrowser,
        timestamp: new Date(), success: true,
      })
    } catch (_lhe) { /* optional */ }

    const token = issueSession(res, user._id.toString())

    clearAttempts(ipAddr)

    // Login-Alert: bei neuer IP, nur wenn Gerät nicht als vertrauenswürdig markiert
    try {
      const lastIP       = (user as any).lastIP
      const trustedToken = req.body.trustedDeviceToken as string | undefined
      const trustedDevices: string[] = (user as any).trustedDevices || []
      const isTrusted    = trustedToken && trustedDevices.includes(trustedToken)

      if (!isTrusted && lastIP && lastIP !== 'unknown' && lastIP !== ipAddr && (user as any).email) {
        sendLoginAlert({
          email:    (user as any).email,
          username: user.username,
          ip:       ipAddr,
          device:   deviceType,
          os:       deviceOS,
          browser:  deviceBrowser,
          time:     new Date(),
        }).catch(() => {})
      }
    } catch (_ae) {}

    console.log(`[Login] OK: ${user.username} | ${ipAddr} | ${deviceStr}`)

    res.json({
      token,
      user: {
        _id:      user._id,
        uin:      user.uin,
        username: user.username,
        email:    user.email,
        status:   'online',
        avatar:   (user as any).avatar || null,
      },
    })
  } catch (err) {
    console.error('[Login] FATAL Error:', err)
    res.status(500).json({ error: 'Serverfehler beim Login. Bitte erneut versuchen.' })
  }
})

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.userId).select(PRIVATE_USER_EXCLUDE)
    if (!user) { res.status(404).json({ error: 'Nicht gefunden' }); return }
    res.json(user)
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  try {
    const refreshToken = readCookie(req, 'nokki_refresh')
    if (!refreshToken) { res.status(401).json({ error: 'Keine erneuerbare Sitzung' }); return }
    const payload = jwt.verify(refreshToken, REFRESH_SECRET, {
      algorithms: ['HS256'], issuer: 'nokki-api',
    }) as jwt.JwtPayload
    if (payload.type !== 'refresh' || typeof payload.userId !== 'string') {
      res.status(401).json({ error: 'Ungültige Sitzung' }); return
    }
    const user = await User.findOne({ _id: payload.userId, isBanned: { $ne: true } }).select('_id')
    if (!user) { res.status(401).json({ error: 'Sitzung ungültig' }); return }
    const token = issueSession(res, payload.userId, payload.isFakeAccount ? { isFakeAccount: true } : {})
    res.json({ token })
  } catch (_err) {
    res.clearCookie('nokki_refresh', { path: '/api/auth' })
    res.status(401).json({ error: 'Sitzung abgelaufen' })
  }
})

router.post('/logout', async (req: Request, res: Response): Promise<void> => {
  const header = req.headers.authorization
  if (header?.startsWith('Bearer ')) await invalidateToken(header.slice(7)).catch(() => {})
  res.clearCookie('nokki_refresh', { path: '/api/auth' })
  res.clearCookie('nokki_upload_access', { path: '/uploads' })
  res.json({ ok: true })
})

// ── POST /api/auth/forgot-password ───────────────────────────────────────────
router.post('/forgot-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body
    if (!email) { res.status(400).json({ error: 'E-Mail fehlt' }); return }
    const user = await User.findOne({ email: String(email).toLowerCase() })
    if (!user) { res.json({ message: 'Falls registriert, erhältst du einen Reset-Code.' }); return }
    const resetCode  = Math.floor(100000 + Math.random() * 900000).toString()
    const resetToken = crypto.createHash('sha256').update(resetCode).digest('hex')
    await User.findByIdAndUpdate(user._id, {
      resetToken,
      resetTokenExpires: new Date(Date.now() + 15 * 60 * 1000),
    })
    await sendPasswordResetEmail(user.email, user.username, resetCode)
    const isDev = process.env.NODE_ENV !== 'production'
    res.json({ message: 'Reset-Code generiert.', ...(isDev && { resetCode }) })
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// ── POST /api/auth/reset-password ────────────────────────────────────────────
router.post('/reset-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, resetCode, newPassword } = req.body
    if (!email || !resetCode || !newPassword || String(newPassword).length < 10) {
      res.status(400).json({ error: 'Ungültige Daten' }); return
    }
    const resetToken = crypto.createHash('sha256').update(String(resetCode)).digest('hex')
    const user = await User.findOne({
      email: String(email).toLowerCase(),
      resetToken,
      resetTokenExpires: { $gt: new Date() },
    })
    if (!user) { res.status(400).json({ error: 'Code ungültig oder abgelaufen' }); return }
    await User.findByIdAndUpdate(user._id, {
      password: await bcrypt.hash(String(newPassword), 12),
      resetToken: undefined,
      resetTokenExpires: undefined,
    })
    res.json({ message: 'Passwort geändert.' })
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// ── PATCH /api/auth/change-password ──────────────────────────────────────────
router.patch('/change-password', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body
    if (!currentPassword || !newPassword || String(newPassword).length < 10) {
      res.status(400).json({ error: 'Ungültige Daten' }); return
    }
    const user = await User.findById(req.userId)
    if (!user || !(await bcrypt.compare(String(currentPassword), user.password))) {
      res.status(401).json({ error: 'Aktuelles Passwort falsch' }); return
    }
    await User.findByIdAndUpdate(req.userId, {
      password: await bcrypt.hash(String(newPassword), 12),
    })
    res.json({ message: 'Passwort geändert.' })
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// ── DELETE /api/auth/account ──────────────────────────────────────────────────
router.delete('/account', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const uid = req.userId!

    // Personenbezogene Daten und Verknüpfungen vollständig entfernen. Schlägt
    // ein Schritt fehl, bleibt das Benutzerkonto bestehen und der Vorgang kann
    // sicher wiederholt werden.
    const { Message }            = require('../models/Message')
    const { Conversation }       = require('../models/Conversation')
    const { ConversationMember } = require('../models/ConversationMember')
    const { Contact }            = require('../models/Contact')
    const { Report }             = require('../models/Report')
    const { Identity }           = require('../models/Identity')
    const { LoginHistory }       = require('../models/LoginHistory')
    const { SecurityLog }        = require('../models/SecurityLog')
    const { Status }             = require('../models/Status')
    const { LegacyClaim }        = require('../models/LegacyClaim')
    const { ScheduledMessage }   = require('../models/ScheduledMessage')
    const { Poll }               = require('../models/Poll')
    const { Giveaway }           = require('../models/Giveaway')

    await Promise.all([
      Message.deleteMany({ sender: uid }),
      Message.updateMany({}, { $pull: { readBy: uid, reactions: { userId: uid } } }),
      Conversation.updateMany({ participants: uid }, { $pull: { participants: uid, muteList: { userId: uid } } }),
      ConversationMember.deleteMany({ userId: uid }),
      Contact.deleteMany({ $or: [{ user: uid }, { owner: uid }] }),
      Report.deleteMany({ reporter: uid }),
      Identity.deleteMany({ userId: uid }),
      LoginHistory.deleteMany({ userId: uid }),
      SecurityLog.deleteMany({ userId: uid }),
      Status.deleteMany({ userId: uid }),
      LegacyClaim.deleteMany({ userId: uid }),
      ScheduledMessage.deleteMany({ $or: [{ sender: uid }, { createdBy: uid }] }),
      Poll.deleteMany({ createdBy: uid }),
      Poll.updateMany({}, { $pull: { 'options.$[].votes': uid } }),
      Giveaway.updateMany({}, { $pull: { participants: uid, winners: uid } }),
    ])

    // User vollständig aus der Datenbank löschen
    // Damit wird die E-Mail-Adresse und UIN wieder frei
    await User.findByIdAndDelete(uid)

    console.log(`[DeleteAccount] User ${uid} vollständig gelöscht`)
    res.json({ ok: true })
  } catch (err) {
    console.error('[DeleteAccount] Error:', err)
    res.status(500).json({ error: 'Fehler beim Löschen' })
  }
})

// ── GET /api/auth/verify-email?token=xxx ─────────────────────────────────────
router.get('/verify-email', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.query
    if (!token) { res.status(400).send('Token fehlt'); return }

    const user = await User.findOne({
      emailVerifyToken:   String(token),
      emailVerifyExpires: { $gt: new Date() },
    })

    if (!user) {
      res.status(400).send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Nokki</title>
        <style>body{font-family:sans-serif;background:#0d0d14;color:#f1f0f8;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}.box{text-align:center;padding:40px;background:#13131f;border-radius:16px;border:1px solid rgba(255,255,255,.1)}</style>
        </head><body><div class="box"><div style="font-size:48px">❌</div><h2>Link ungültig oder abgelaufen</h2>
        <p style="color:#8b8aa8">Bitte fordere einen neuen Link in der App an.</p>
        <a href="/chat" style="color:#4f6ef7">Zurück zur App →</a></div></body></html>`)
      return
    }

    await User.findByIdAndUpdate(user._id, {
      emailVerified: true,
      emailVerifyToken: undefined,
      emailVerifyExpires: undefined,
    })

    console.log(`[Auth] E-Mail verifiziert: ${(user as any).username}`)

    res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Verifiziert – Nokki</title>
      <meta http-equiv="refresh" content="3;url=/chat">
      <style>body{font-family:sans-serif;background:#0d0d14;color:#f1f0f8;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}.box{text-align:center;padding:40px;background:#13131f;border-radius:16px;border:1px solid rgba(255,255,255,.1)}</style>
      </head><body><div class="box"><div style="font-size:48px">✅</div><h2>E-Mail erfolgreich bestätigt!</h2>
      <p style="color:#8b8aa8">Weiterleitung in 3 Sekunden…</p>
      <a href="/chat" style="color:#4f6ef7">Jetzt zum Chat →</a></div></body></html>`)
  } catch (err) {
    console.error('[VerifyEmail]', err)
    res.status(500).send('Serverfehler')
  }
})

// ── POST /api/auth/resend-verification ───────────────────────────────────────
router.post('/resend-verification', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.userId).select('email username emailVerified')
    if (!user) { res.status(404).json({ error: 'Nicht gefunden' }); return }
    if ((user as any).emailVerified) { res.json({ message: 'Bereits verifiziert.' }); return }

    const verifyToken   = crypto.randomBytes(32).toString('hex')
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000)
    await User.findByIdAndUpdate(req.userId, { emailVerifyToken: verifyToken, emailVerifyExpires: verifyExpires })

    const sent = await sendVerificationEmail((user as any).email, (user as any).username, verifyToken, (user as any).uin)
    if (!sent) {
      console.log(`[ResendVerify] SMTP not configured. Token: ${verifyToken}`)
    }
    res.json({ message: 'Bestätigungsmail gesendet! Bitte überprüfe dein Postfach.' })
  } catch (err) {
    console.error('[ResendVerify]', err)
    res.status(500).json({ error: 'Serverfehler' })
  }
})

export default router
// POST /api/auth/trust-device — Gerät als vertrauenswürdig markieren
router.post('/trust-device', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const crypto = require('crypto')
    const token  = crypto.randomBytes(32).toString('hex')
    const days   = parseInt(req.body.days || '30')
    const user   = await User.findById(req.userId)
    if (!user) { res.status(404).json({ error: 'Nicht gefunden' }); return }
    const trusted = [...((user as any).trustedDevices || []), token].slice(-10)
    await User.findByIdAndUpdate(req.userId, { trustedDevices: trusted })
    const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
    res.json({ ok: true, token, expires, days })
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// ── PATCH /api/auth/fake-pin — Fake-PIN setzen / entfernen ───────────────────
router.patch('/fake-pin', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { fakePin, fakeUsername, fakeStatusMessage } = req.body
    if (fakePin && (String(fakePin).length < 4 || String(fakePin).length > 8)) {
      res.status(400).json({ error: 'Fake-PIN muss 4–8 Zeichen haben' }); return
    }
    const update: any = { fakeUsername: fakeUsername || '', fakeStatusMessage: fakeStatusMessage || '' }
    if (fakePin) {
      update.fakePin = await bcrypt.hash(String(fakePin), 12)
    } else {
      update.fakePin = null  // PIN entfernen wenn leer
    }
    await User.findByIdAndUpdate(req.userId, update)
    res.json({ ok: true, message: fakePin ? 'Fake-PIN gesetzt' : 'Fake-PIN entfernt' })
  } catch (err) {
    console.error('[FakePin]', err)
    res.status(500).json({ error: 'Serverfehler' })
  }
})
