import { Router, Response } from 'express'
import fs from 'fs'
import path from 'path'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { User } from '../models/User'
import { Message } from '../models/Message'
import { Conversation } from '../models/Conversation'
import { ScheduledMessage } from '../models/ScheduledMessage'
import { upload, verifyUpload } from '../middleware/upload'
import { getIO } from '../socket/socketServer'
import { Types } from 'mongoose'
import { PUBLIC_USER_FIELDS, PRIVATE_USER_EXCLUDE } from '../utils/userFields'

const router = Router()
router.use(authMiddleware)

// GET /api/users/search
router.get('/search', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const q = String(req.query.q || '').trim().slice(0, 60)
    if (q.length < 2) { res.json([]); return }
    const escapedQuery = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const currentUser = await User.findById(req.userId).select('blockedUsers')
    const blockedIds  = currentUser?.blockedUsers || []
    const users = await User.find({
      username: { $regex: escapedQuery, $options: 'i' },
      _id:      { $ne: req.userId, $nin: blockedIds },
    }).select(PUBLIC_USER_FIELDS).limit(10)
    res.json(users)
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// GET /api/users/:id/profile
router.get('/:id/profile', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.params.id)
      .select(PUBLIC_USER_FIELDS)
    if (!user) { res.status(404).json({ error: 'Nutzer nicht gefunden' }); return }

    const sharedGroups = await Conversation.find({
      isGroup: true,
      participants: { $all: [req.userId, req.params.id] },
    }).select('groupName isPublic participants')

    res.json({
      _id: user._id, uin: user.uin, username: user.username,
      avatar: user.avatar, bio: user.bio,
      statusMessage: user.statusMessage, status: user.status,
      lastSeen: user.lastSeen, createdAt: user.createdAt,
      sharedGroups,
      showLastSeen: user.privacyShowLastSeen !== 'nobody',
      showStatus:   user.privacyShowStatus   !== 'nobody',
    })
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// PATCH /api/users/status
router.patch('/status', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, statusMessage, statusExpiresAt } = req.body
    const update: Record<string,unknown> = { lastSeen: new Date() }
    if (status)                 update.status = status
    if (statusMessage !== undefined) update.statusMessage = statusMessage
    if (statusExpiresAt)        update.statusExpiresAt = new Date(statusExpiresAt)
    const user = await User.findByIdAndUpdate(req.userId, update, { new: true }).select(PRIVATE_USER_EXCLUDE)
    if (!user) { res.status(404).json({ error: 'Nicht gefunden' }); return }
    getIO().emit('user_status', { userId: req.userId, status: user.status, lastSeen: user.lastSeen })
    res.json(user)
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// PATCH /api/users/privacy
router.patch('/privacy', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { privacyShowStatus, privacyShowLastSeen, privacyShowAvatar } = req.body
    const update: Record<string,unknown> = {}
    if (privacyShowStatus)   update.privacyShowStatus   = privacyShowStatus
    if (privacyShowLastSeen) update.privacyShowLastSeen = privacyShowLastSeen
    if (privacyShowAvatar)   update.privacyShowAvatar   = privacyShowAvatar
    const user = await User.findByIdAndUpdate(req.userId, update, { new: true }).select(PRIVATE_USER_EXCLUDE)
    res.json(user)
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// PATCH /api/users/profile
router.patch('/profile', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { bio } = req.body
    const user = await User.findByIdAndUpdate(
      req.userId, { bio: bio?.substring(0, 200) || '' }, { new: true }
    ).select(PRIVATE_USER_EXCLUDE)
    res.json(user)
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// PATCH /api/users/avatar
router.patch('/avatar', upload.single('avatar'), verifyUpload, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) { res.status(400).json({ error: 'Keine Datei' }); return }
    if (!req.file.mimetype.startsWith('image/')) {
      res.status(400).json({ error: 'Nur Bilder erlaubt' }); return
    }
    const user = await User.findByIdAndUpdate(
      req.userId, { avatar: `/uploads/${req.file.filename}` }, { new: true }
    ).select(PRIVATE_USER_EXCLUDE)
    res.json(user)
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// 🆕 POST /api/users/:id/block — Nutzer blockieren
router.post('/:id/block', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const targetId = new Types.ObjectId(req.params.id)
    await User.findByIdAndUpdate(req.userId, { $addToSet: { blockedUsers: targetId } })
    res.json({ ok: true, blocked: true })
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// 🆕 DELETE /api/users/:id/block — Blockierung aufheben
router.delete('/:id/block', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const targetId = new Types.ObjectId(req.params.id)
    await User.findByIdAndUpdate(req.userId, { $pull: { blockedUsers: targetId } })
    res.json({ ok: true, blocked: false })
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// 🆕 GET /api/users/blocked — Blockierte User Liste
router.get('/blocked', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.userId)
      .populate('blockedUsers', 'username uin avatar status')
    res.json(user?.blockedUsers || [])
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// 🆕 POST /api/users/bookmarks/:messageId — Lesezeichen setzen/entfernen
router.post('/bookmarks/:messageId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const msgId = new Types.ObjectId(req.params.messageId)
    const user  = await User.findById(req.userId).select('bookmarks')
    if (!user) { res.status(404).json({ error: 'Nicht gefunden' }); return }

    const isBookmarked = user.bookmarks.some(b => b.toString() === msgId.toString())
    if (isBookmarked) {
      await User.findByIdAndUpdate(req.userId, { $pull: { bookmarks: msgId } })
      res.json({ ok: true, bookmarked: false })
    } else {
      await User.findByIdAndUpdate(req.userId, { $addToSet: { bookmarks: msgId } })
      res.json({ ok: true, bookmarked: true })
    }
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// 🆕 GET /api/users/bookmarks — Alle Lesezeichen
router.get('/bookmarks', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.userId)
      .populate({
        path: 'bookmarks',
        populate: { path: 'sender', select: 'username uin avatar' },
      })
    res.json(user?.bookmarks || [])
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// 🆕 POST /api/users/scheduled — Geplante Nachricht erstellen
router.post('/scheduled', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { conversationId, content, scheduledFor } = req.body
    if (!conversationId || !content || !scheduledFor) {
      res.status(400).json({ error: 'Alle Felder erforderlich' }); return
    }
    const scheduledDate = new Date(scheduledFor)
    if (scheduledDate <= new Date()) {
      res.status(400).json({ error: 'Zeitpunkt muss in der Zukunft liegen' }); return
    }
    const msg = await ScheduledMessage.create({
      sender: req.userId, conversationId, content, scheduledFor: scheduledDate,
    })
    res.status(201).json(msg)
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// 🆕 GET /api/users/scheduled — Geplante Nachrichten anzeigen
router.get('/scheduled', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const msgs = await ScheduledMessage.find({ sender: req.userId, sent: false })
      .populate('conversationId', 'groupName participants')
      .sort({ scheduledFor: 1 })
    res.json(msgs)
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// 🆕 DELETE /api/users/scheduled/:id — Geplante Nachricht löschen
router.delete('/scheduled/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await ScheduledMessage.findOneAndDelete({ _id: req.params.id, sender: req.userId })
    res.json({ ok: true })
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// GET /api/users/:id/lastseen
router.get('/:id/lastseen', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.params.id)
      .select('status lastSeen privacyShowStatus privacyShowLastSeen')
    if (!user) { res.status(404).json({ error: 'Nicht gefunden' }); return }
    res.json({ status: user.status, lastSeen: user.lastSeen })
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// ── POST /api/users/e2e-key — Öffentlichen E2E-Schlüssel speichern ──────────
router.post('/e2e-key', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { publicKey } = req.body
    if (!publicKey) { res.status(400).json({ error: 'publicKey fehlt' }); return }
    await User.findByIdAndUpdate(req.userId, { e2ePublicKey: publicKey })
    res.json({ ok: true })
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// ── GET /api/users/:id/e2e-key — Öffentlichen E2E-Schlüssel abrufen ─────────
router.get('/:id/e2e-key', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.params.id).select('e2ePublicKey username')
    if (!user) { res.status(404).json({ error: 'Nicht gefunden' }); return }
    res.json({
      userId:    req.params.id,
      username:  (user as any).username,
      publicKey: (user as any).e2ePublicKey || null,
      e2eEnabled: !!(user as any).e2ePublicKey,
    })
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})


// ── DELETE /api/users/me — Eigenen Account löschen (Art. 17 DSGVO) ──────────
router.delete('/me', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId

    // 1. Alle Nachrichten des Users löschen + Dateien entfernen
    const { Message } = require('../models/Message')
    const userMessages = await Message.find({ sender: userId, fileUrl: { $exists: true, $ne: null } }).lean()
    for (const msg of userMessages) {
      if ((msg as any).fileUrl) {
        try {
          const fp = path.join('/app/uploads', path.basename((msg as any).fileUrl))
          if (fs.existsSync(fp)) fs.unlinkSync(fp)
        } catch (_e) {}
      }
    }
    await Message.updateMany(
      { sender: userId },
      { deleted: true, content: '[Nutzer gelöscht]', fileUrl: null, fileName: null }
    )

    // 2. Profilbild löschen
    const user = await User.findById(userId)
    if (user && (user as any).avatar) {
      try {
        const fp = path.join('/app/uploads', path.basename((user as any).avatar))
        if (fs.existsSync(fp)) fs.unlinkSync(fp)
      } catch (_e) {}
    }

    // 3. Login-History löschen
    const { LoginHistory } = require('../models/LoginHistory')
    await LoginHistory.deleteMany({ userId })

    // 4. Kontakte die diesen User haben bereinigen
    await User.updateMany(
      { blockedUsers: userId },
      { $pull: { blockedUsers: userId } }
    )

    // 5. User anonymisieren statt löschen
    // (Nachrichten bleiben als "[Nutzer gelöscht]" erhalten)
    const deletedUsername = `deleted_${Date.now()}`
    await User.findByIdAndUpdate(userId, {
      username:     deletedUsername,
      email:        `${deletedUsername}@deleted.invalid`,
      password:     'DELETED',
      avatar:       null,
      bio:          '',
      statusMessage:'',
      e2ePublicKey: null,
      isBanned:     true,
      bannedReason: 'Account gelöscht',
    })

    res.json({ ok: true, message: 'Account erfolgreich gelöscht' })
  } catch (err) {
    console.error('[DeleteAccount]', err)
    res.status(500).json({ error: 'Fehler beim Löschen' })
  }
})


// ── GET /api/users/me/export — Datenlöschungsantrag / Datenexport (Art. 20 DSGVO) ──
router.get('/me/export', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId

    const user = await User.findById(userId).select(PRIVATE_USER_EXCLUDE).lean()
    if (!user) { res.status(404).json({ error: 'Nicht gefunden' }); return }

    const { Message } = require('../models/Message')
    const { Conversation } = require('../models/Conversation')
    const { LoginHistory } = require('../models/LoginHistory')
    const { Contact } = require('../models/Contact')

    const [messages, conversations, loginHistory, contacts] = await Promise.all([
      Message.find({ sender: userId, deleted: false })
        .select('content type createdAt editedAt conversationId')
        .lean(),
      Conversation.find({ participants: userId })
        .select('groupName isGroup createdAt participants')
        .lean(),
      LoginHistory.find({ userId })
        .select('ipAddress device os browser timestamp success')
        .lean(),
      Contact.find({ owner: userId })
        .populate('user', 'username uin')
        .lean(),
    ])

    const exportData = {
      exportInfo: {
        generatedAt:    new Date().toISOString(),
        requestedBy:    (user as any).username,
        legalBasis:     'Art. 20 DSGVO — Recht auf Datenübertragbarkeit',
        dataController: 'Nokki Messenger — lumestack.de',
      },
      personalData: {
        uin:          (user as any).uin,
        username:     (user as any).username,
        email:        (user as any).email,
        bio:          (user as any).bio,
        registeredAt: (user as any).createdAt,
        lastSeen:     (user as any).lastSeen,
        emailVerified:(user as any).emailVerified,
      },
      messages: messages.map((m: any) => ({
        conversationId: m.conversationId,
        content:        m.content,
        type:           m.type,
        sentAt:         m.createdAt,
        edited:         m.editedAt ? true : false,
      })),
      conversations: conversations.map((c: any) => ({
        id:        c._id,
        name:      c.groupName || 'Direktnachricht',
        isGroup:   c.isGroup,
        createdAt: c.createdAt,
        members:   c.participants?.length,
      })),
      loginHistory: loginHistory.map((l: any) => ({
        date:    l.timestamp,
        ip:      l.ipAddress,
        device:  l.device,
        os:      l.os,
        browser: l.browser,
        success: l.success,
      })),
      contacts: contacts.map((c: any) => ({
        username: c.user?.username,
        uin:      c.user?.uin,
        nickname: c.nickname,
        addedAt:  c.createdAt,
      })),
    }

    res.setHeader('Content-Type', 'application/json')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="Nokki_Datenauszug_${(user as any).username}_${new Date().toISOString().slice(0,10)}.json"`
    )
    res.json(exportData)
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})



// ── Verfügbarkeitsfenster ────────────────────────────────────────────────────

// GET /api/users/availability — eigenes Verfügbarkeitsfenster abrufen
router.get('/availability', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.userId).select('availability timezone')
    res.json({
      availability: (user as any)?.availability || { enabled:false, days:[1,2,3,4,5], startTime:'09:00', endTime:'22:00', message:'' },
      timezone:     (user as any)?.timezone || 'Europe/Berlin',
    })
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// PATCH /api/users/availability — Verfügbarkeitsfenster speichern
router.patch('/availability', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { availability, timezone } = req.body
    const update: Record<string,unknown> = {}
    if (availability !== undefined) update.availability = availability
    if (timezone)                   update.timezone     = timezone
    await User.findByIdAndUpdate(req.userId, update)
    res.json({ ok: true })
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// GET /api/users/:id/availability — Verfügbarkeit eines anderen Users prüfen
router.get('/:id/availability', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.params.id).select('availability timezone username')
    if (!user) { res.status(404).json({ error: 'Nicht gefunden' }); return }

    const avail    = (user as any)?.availability
    const timezone = (user as any)?.timezone || 'Europe/Berlin'

    if (!avail?.enabled) {
      res.json({ available: true, timezone, availability: null }); return
    }

    // Aktuelle Uhrzeit in der Zeitzone des Users berechnen
    const now       = new Date()
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone, hour:'2-digit', minute:'2-digit', hour12: false, weekday:'short'
    })
    const parts    = formatter.formatToParts(now)
    const hourStr  = parts.find(p => p.type === 'hour')?.value  || '00'
    const minStr   = parts.find(p => p.type === 'minute')?.value || '00'
    const dayStr   = parts.find(p => p.type === 'weekday')?.value || 'Mon'
    const dayMap:  Record<string,number> = { Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 }
    const dayNum   = dayMap[dayStr] ?? 1
    const nowMins  = parseInt(hourStr) * 60 + parseInt(minStr)
    const [sh, sm] = (avail.startTime || '09:00').split(':').map(Number)
    const [eh, em] = (avail.endTime   || '22:00').split(':').map(Number)
    const startMin = sh * 60 + sm
    const endMin   = eh * 60 + em

    const inDays  = (avail.days || [1,2,3,4,5]).includes(dayNum)
    const inTime  = nowMins >= startMin && nowMins <= endMin
    const available = inDays && inTime

    res.json({
      available,
      timezone,
      localTime:    `${hourStr}:${minStr}`,
      availability: avail,
      message:      !available ? (avail.message || '') : '',
    })
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

export default router

// ── 🆕 Runde 5: Login-History ────────────────────────────────────────────────
// GET /api/users/login-history
router.get('/login-history', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { LoginHistory } = require('../models/LoginHistory')
    const history = await LoginHistory.find({ userId: req.userId })
      .sort({ timestamp: -1 }).limit(20)
    res.json(history)
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})
