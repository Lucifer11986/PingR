import { Router, Response } from 'express'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { filterGroupName } from '../utils/contentFilter'
import { Conversation } from '../models/Conversation'
import ConversationMember from '../models/ConversationMember'
import { upload, verifyUpload } from '../middleware/upload'
import { Types } from 'mongoose'
import crypto from 'crypto'
import { dualAuthMiddleware } from '../middleware/dualAuth'
import { PUBLIC_USER_FIELDS } from '../utils/userFields'

const router = Router()

// ── GET /api/conversations/my-channels — Gruppen wo User Admin ist (für Bot Installation) ──
router.get('/my-channels', dualAuthMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId
    const Channel = require('../models/Channel').Channel

    // Gruppen wo User Admin ist
    const groups = await Conversation.find({
      isGroup: true,
      admins: userId,
    }).select('_id groupName groupAvatar isPublic').lean()

    // PingR Channels wo User Owner oder Admin ist
    const nokkiChannels = await Channel.find({
      $or: [{ owner: userId }, { admins: userId }]
    }).select('_id name handle isPublic').lean()

    const channels = [
      ...groups.map((conv: any) => ({
        id:       conv._id.toString(),
        name:     conv.groupName || 'Unbenannte Gruppe',
        type:     'group' as const,
        isPublic: conv.isPublic || false,
      })),
      ...nokkiChannels.map((ch: any) => ({
        id:       ch._id.toString(),
        name:     ch.name || 'Unbenannter Channel',
        type:     'nokki_channel' as const,
        handle:   ch.handle,
        isPublic: true,
      })),
    ]

    res.json({ channels })
  } catch (error) {
    console.error('Error fetching user channels:', error)
    res.status(500).json({ error: 'Fehler beim Laden der Channels' })
  }
});

router.use(authMiddleware)

// GET /api/conversations
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Aktive Identity aus Middleware
  const identityId = req.activeIdentityId || null

  // Filter: nach identityId ODER userId (Rückwärtskompatibilität)
  const filter = identityId
    ? { $or: [
        { identityParticipants: identityId },
        { participants: req.userId, identityParticipants: { $size: 0 } },
        { participants: req.userId, identityParticipants: { $exists: false } },
      ]}
    : { participants: req.userId }

  const convs = await Conversation.find(filter)
      .populate('participants', PUBLIC_USER_FIELDS)
      .populate('bots', 'name botId status')
      .populate('lastMessage')
      .sort({ updatedAt: -1 })

    // FIX: Stelle sicher dass isGroup korrekt gesetzt ist
    // Wenn groupName vorhanden ist, muss isGroup true sein
    const fixed = convs.map((c: any) => {
      const obj = c.toObject()
      // Korrigiere isGroup falls inkonsistent
      if (obj.groupName && !obj.isGroup) {
        obj.isGroup = true
      }
      return obj
    })

    res.json(fixed)
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// POST /api/conversations — 1:1 Chat
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { participantId } = req.body
    if (!participantId) { res.status(400).json({ error: 'participantId fehlt' }); return }
    const meId    = new Types.ObjectId(req.userId)
    const otherId = new Types.ObjectId(participantId)
    let conv: any = await Conversation.findOne({
      isGroup: false,
      participants: { $all: [meId, otherId], $size: 2 },
    }).populate('participants', PUBLIC_USER_FIELDS).populate('lastMessage')
      .populate('bots', 'name botId status')
    if (!conv) {
      // Anonym-Profil: Chat-Limit prüfen
      if (req.activeIdentityId) {
        try {
          const { Identity } = require('../models/Identity')
          const ident = await Identity.findById(req.activeIdentityId)
          if (ident?.type === 'anonymous') {
            const limit = ident.settings?.newChatLimit || 10
            const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
            const count = await Conversation.countDocuments({
              identityParticipants: req.activeIdentityId, createdAt: { $gte: since }, isGroup: false,
            })
            if (count >= limit) {
              res.status(429).json({ error: `Chat-Limit: max. ${limit} neue Chats/24h für anonyme Identitäten` })
              return
            }
          }
        } catch (_le) {}
      }
      conv = await Conversation.create({
        participants: [meId, otherId],
        isGroup: false,
        identityParticipants: req.activeIdentityId ? [req.activeIdentityId] : [],
      })
      conv = await conv.populate('participants', PUBLIC_USER_FIELDS)
      .populate('bots', 'name botId status')
    }
    res.json(conv)
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// POST /api/conversations/group — Gruppe erstellen
router.post('/group', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { groupName, participantIds, isPublic } = req.body
    const nameCheck = filterGroupName(groupName || '')
    if (nameCheck.blocked) { res.status(400).json({ error: nameCheck.reason }); return }

    const members = [
      new Types.ObjectId(req.userId),
      ...(participantIds || []).map((id: string) => new Types.ObjectId(id)),
    ]
    const joinCode = isPublic ? crypto.randomBytes(6).toString('hex') : undefined
    const conv = await Conversation.create({
      participants: members,
      isGroup:      true,
      groupName:    groupName.trim(),
      isPublic:     !!isPublic,
      joinCode,
      admins: [new Types.ObjectId(req.userId)],
    })
    
    // ✅ ERSTELLE CONVERSATIONMEMBER FÜR CREATOR (OWNER/ADMIN)
    try {
      await ConversationMember.create({
        conversationId: conv._id,
        userId: new Types.ObjectId(req.userId),
        roles: ['owner', 'admin'],
        isActive: true
      })
      console.log(`✅ [CONVERSATION] Creator ${req.userId} set as owner/admin in ${conv.groupName}`)
      
      // ERSTELLE CONVERSATIONMEMBER FÜR PARTICIPANTS (MEMBER)
      if (participantIds && participantIds.length > 0) {
        for (const participantId of participantIds) {
          // Skip Creator (schon gesetzt)
          if (participantId === req.userId) {
            continue
          }
          
          await ConversationMember.create({
            conversationId: conv._id,
            userId: new Types.ObjectId(participantId),
            roles: ['member'],
            isActive: true
          })
        }
        console.log(`✅ [CONVERSATION] ${participantIds.length} participants set as members`)
      }
    } catch (memberError) {
      console.error('⚠️ [CONVERSATION] Error creating members:', memberError)
      // Continue - nicht kritisch
    }
    
    const populated = await conv.populate([
      { path: 'participants', select: PUBLIC_USER_FIELDS },
      { path: 'bots', select: 'name botId status' },
    ])
    res.status(201).json(populated)
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// GET /api/conversations/join/:code
router.get('/join/:code', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const conv: any = await Conversation.findOne({ joinCode: req.params.code, isPublic: true })
      .populate('participants', PUBLIC_USER_FIELDS)
      .populate('bots', 'name botId status')
    if (!conv) { res.status(404).json({ error: 'Gruppe nicht gefunden' }); return }
    const isMember = conv.participants.some((p: any) => p._id.toString() === req.userId)
    if (!isMember) {
      conv.participants.push(new Types.ObjectId(req.userId) as any)
      await conv.save()
      await conv.populate('participants', PUBLIC_USER_FIELDS)
      .populate('bots', 'name botId status')
      
      // ✅ ERSTELLE CONVERSATIONMEMBER FÜR NEUEN MEMBER
      try {
        await ConversationMember.create({
          conversationId: conv._id,
          userId: new Types.ObjectId(req.userId),
          roles: ['member'],
          isActive: true
        })
        console.log(`✅ [CONVERSATION] User ${req.userId} joined as member in ${conv.groupName}`)
      } catch (memberError) {
        console.error('⚠️ [CONVERSATION] Error creating member on join:', memberError)
      }
      
      // Socket: User benachrichtigen dass er einer Gruppe beigetreten ist
      try {
        const { getIO } = require('../socket/socketServer')
        getIO().to(req.userId!).emit('group_joined', { conversationId: conv._id })
      } catch (_se) {}
    }
    res.json(conv)
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// GET /api/conversations/public
router.get('/public', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const q       = req.query.q as string
    const popular = req.query.popular === 'true'
    const filter: Record<string, unknown> = { isGroup: true, isPublic: true }
    if (q) filter.groupName = { $regex: q, $options: 'i' }
    const groups = await Conversation.find(filter)
      .populate('participants', 'username avatar status')
      .limit(popular ? 10 : 20)
      .sort(popular ? {} : { updatedAt: -1 })
    // Nach Mitgliederzahl sortieren für "Beliebt"
    const sorted = popular
      ? [...groups].sort((a, b) => b.participants.length - a.participants.length)
      : groups
    res.json(sorted)
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// GET /api/conversations/:id
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const conv: any = await Conversation.findById(req.params.id)
      .populate('participants', PUBLIC_USER_FIELDS)
      .populate('bots', 'name botId status')
      .populate('lastMessage')
    if (!conv) { res.status(404).json({ error: 'Nicht gefunden' }); return }
    const isMember = conv.participants.some((p: any) => p._id.toString() === req.userId)
    if (!isMember) { res.status(403).json({ error: 'Kein Mitglied' }); return }
    const obj = conv.toObject()
    if (obj.groupName && !obj.isGroup) obj.isGroup = true
    res.json(obj)
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// PATCH /api/conversations/:id/settings — Gruppeneinstellungen
router.patch('/:id/settings', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { groupName, isPublic, description, adminOnly, slowMode, maxMembers, requireApproval } = req.body
    const conv: any = await Conversation.findById(req.params.id)
    if (!conv) { res.status(404).json({ error: 'Nicht gefunden' }); return }

    const isAdmin = conv.admins?.some((a: any) => a.toString() === req.userId)
      || conv.participants[0]?.toString() === req.userId
    if (!isAdmin) { res.status(403).json({ error: 'Nur Admins können Einstellungen ändern' }); return }

    if (groupName?.trim()) {
      const nameCheck = filterGroupName(groupName)
      if (nameCheck.blocked) { res.status(400).json({ error: nameCheck.reason }); return }
      conv.groupName = groupName.trim()
    }
    if (typeof isPublic === 'boolean') {
      conv.isPublic = isPublic
      if (isPublic && !conv.joinCode) {
        conv.joinCode = crypto.randomBytes(6).toString('hex')
      }
    }
    if (description !== undefined)     conv.description    = String(description).slice(0, 300)
    if (typeof adminOnly === 'boolean') conv.adminOnly      = adminOnly
    if (slowMode !== undefined)         conv.slowMode       = Math.max(0, Number(slowMode))
    if (maxMembers !== undefined)       conv.maxMembers     = Math.min(500, Math.max(2, Number(maxMembers)))
    if (typeof requireApproval === 'boolean') conv.requireApproval = requireApproval

    conv.isGroup = true
    await conv.save()
    const populated = await conv.populate('participants', PUBLIC_USER_FIELDS)
      .populate('bots', 'name botId status')
    const obj = populated.toObject ? populated.toObject() : populated
    obj.isGroup = true
    res.json(obj)
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// POST /api/conversations/:id/kick
router.post('/:id/kick', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.body
    const conv: any = await Conversation.findById(req.params.id)
    if (!conv) { res.status(404).json({ error: 'Nicht gefunden' }); return }
    const isAdmin = conv.admins?.some((a: any) => a.toString() === req.userId)
      || conv.participants[0]?.toString() === req.userId
    if (!isAdmin) { res.status(403).json({ error: 'Nur Admins können Mitglieder entfernen' }); return }
    if (userId === req.userId) { res.status(400).json({ error: 'Kannst dich nicht selbst entfernen' }); return }
    conv.participants = conv.participants.filter((p: any) => p.toString() !== userId)
    await conv.save()
    const populated = await conv.populate('participants', PUBLIC_USER_FIELDS)
      .populate('bots', 'name botId status')
    res.json(populated)
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// POST /api/conversations/:id/promote
router.post('/:id/promote', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.body
    const conv: any = await Conversation.findById(req.params.id)
    if (!conv) { res.status(404).json({ error: 'Nicht gefunden' }); return }
    const isAdmin = conv.admins?.some((a: any) => a.toString() === req.userId)
      || conv.participants[0]?.toString() === req.userId
    if (!isAdmin) { res.status(403).json({ error: 'Nur Admins können befördern' }); return }
    if (!conv.admins) conv.admins = []
    if (!conv.admins.some((a: any) => a.toString() === userId)) {
      conv.admins.push(new Types.ObjectId(userId))
      await conv.save()
    }
    const populated = await conv.populate('participants', PUBLIC_USER_FIELDS)
      .populate('bots', 'name botId status')
    res.json(populated)
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// DELETE /api/conversations/:id/leave
router.delete('/:id/leave', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const conv: any = await Conversation.findById(req.params.id)
    if (!conv) { res.status(404).json({ error: 'Nicht gefunden' }); return }
    conv.participants = conv.participants.filter((p: any) => p.toString() !== req.userId)
    if (conv.admins) {
      conv.admins = conv.admins.filter((a: any) => a.toString() !== req.userId)
      if (conv.admins.length === 0 && conv.participants.length > 0) {
        conv.admins = [conv.participants[0]]
      }
    }
    await conv.save()
    res.json({ ok: true })
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// PATCH /api/conversations/:id/add (backward compat)
router.patch('/:id/add', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.body
    const conv: any = await Conversation.findById(req.params.id)
    if (!conv) { res.status(404).json({ error: 'Nicht gefunden' }); return }
    const maxM = conv.maxMembers || 100
    if (conv.participants.length >= maxM) {
      res.status(400).json({ error: `Gruppe ist voll (max. ${maxM} Mitglieder)` }); return
    }
    if (!conv.participants.some((p: any) => p.toString() === userId)) {
      conv.participants.push(new Types.ObjectId(userId))
      await conv.save()
    }
    const populated = await conv.populate('participants', PUBLIC_USER_FIELDS)
      .populate('bots', 'name botId status')
    res.json(populated)
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// POST /api/conversations/:id/add — Mitglied hinzufügen (Admin)
router.post('/:id/add', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.body
    const conv: any = await Conversation.findById(req.params.id)
    if (!conv) { res.status(404).json({ error: 'Nicht gefunden' }); return }
    const isAdmin = conv.admins?.some((a: any) => a.toString() === req.userId)
      || conv.participants[0]?.toString() === req.userId
    if (!isAdmin) { res.status(403).json({ error: 'Nur Admins können Mitglieder hinzufügen' }); return }
    const maxM = conv.maxMembers || 100
    if (conv.participants.length >= maxM) {
      res.status(400).json({ error: `Gruppe ist voll (max. ${maxM} Mitglieder)` }); return
    }
    if (!conv.participants.some((p: any) => p.toString() === userId)) {
      conv.participants.push(new Types.ObjectId(userId))
      await conv.save()
      
      // ✅ ERSTELLE CONVERSATIONMEMBER FÜR NEUEN MEMBER
      try {
        await ConversationMember.create({
          conversationId: conv._id,
          userId: new Types.ObjectId(userId),
          roles: ['member'],
          isActive: true
        })
        console.log(`✅ [CONVERSATION] User ${userId} added as member by admin`)
      } catch (memberError) {
        console.error('⚠️ [CONVERSATION] Error creating member on add:', memberError)
      }
    }
    const populated = await conv.populate('participants', PUBLIC_USER_FIELDS)
      .populate('bots', 'name botId status')
    res.json(populated)
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// POST /api/conversations/:id/add — Mitglied hinzufügen (mit Admin-Check)
// ── DELETE /api/conversations/:id — Chat löschen (DM) oder Gruppe löschen (Admin) ──
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const conv: any = await Conversation.findOne({ _id: req.params.id, participants: req.userId })
    if (!conv) { res.status(404).json({ error: 'Nicht gefunden' }); return }
    const { Message } = require('../models/Message')

    if (conv.isGroup) {
      // Gruppe: nur Ersteller darf löschen
      const admins = conv.admins || []
      const isCreator = admins.length === 0
        ? conv.participants[0]?.toString() === req.userId
        : conv.admins[0]?.toString() === req.userId
      if (!isCreator) { res.status(403).json({ error: 'Nur der Gruppen-Ersteller darf die Gruppe löschen' }); return }
    }

    await Message.deleteMany({ conversationId: req.params.id })
    await Conversation.findByIdAndDelete(req.params.id)
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: String(err) }) }
})


// ── PATCH /api/conversations/:id/avatar — Gruppen-Bild hochladen ─────────────
router.patch('/:id/avatar', upload.single('avatar'), verifyUpload, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const conv = await Conversation.findOne({
      _id: req.params.id,
      isGroup: true,
      $or: [{ admins: req.userId }, { participants: req.userId }],
    })
    if (!conv) { res.status(404).json({ error: 'Gruppe nicht gefunden' }); return }
    if (!req.file) { res.status(400).json({ error: 'Kein Bild' }); return }

    const avatarUrl = `/uploads/${req.file.filename}`
    await Conversation.findByIdAndUpdate(req.params.id, { groupAvatar: avatarUrl })

    // Socket: alle Mitglieder informieren
    try {
      const { getIO } = require('../socket/socketServer')
      getIO().to(req.params.id).emit('conversation_updated', { conversationId: req.params.id })
    } catch (_se) {}

    res.json({ ok: true, avatarUrl })
  } catch (err) { res.status(500).json({ error: String(err) }) }
})


// ── POST /api/conversations/:id/pin/:msgId ────────────────────────────────────
router.post('/:id/pin/:msgId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const conv = await Conversation.findOne({ _id: req.params.id, participants: req.userId })
    if (!conv) { res.status(404).json({ error: 'Nicht gefunden' }); return }

    const pins = (conv as any).pinnedMessages || []
    const msgId = req.params.msgId
    const idx = pins.indexOf(msgId)

    if (idx === -1) {
      pins.unshift(msgId)           // Vorne anhängen
      if (pins.length > 5) pins.pop() // Max 5 angepinnte
    } else {
      pins.splice(idx, 1)           // Entpinnen
    }

    await Conversation.findByIdAndUpdate(req.params.id, { pinnedMessages: pins })

    // Socket: alle informieren
    try {
      const { getIO } = require('../socket/socketServer')
      getIO().to(req.params.id).emit('pins_updated', { conversationId: req.params.id, pins })
    } catch (_se) {}

    res.json({ ok: true, pins, pinned: idx === -1 })
  } catch (err) { res.status(500).json({ error: String(err) }) }
})

// ── GET /api/conversations/:id/pins ──────────────────────────────────────────
router.get('/:id/pins', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const conv = await Conversation.findOne({ _id: req.params.id, participants: req.userId })
      .select('pinnedMessages')
    if (!conv) { res.status(404).json({ error: 'Nicht gefunden' }); return }

    const pins = (conv as any).pinnedMessages || []
    if (!pins.length) { res.json([]); return }

    const { Message } = require('../models/Message')
    const messages = await Message.find({ _id: { $in: pins }, deleted: false })
      .populate('sender', 'username avatar')
      .lean()

    // Reihenfolge beibehalten
    const sorted = pins
      .map((id: string) => messages.find((m: any) => m._id.toString() === id))
      .filter(Boolean)

    res.json(sorted)
  } catch (err) { res.status(500).json({ error: String(err) }) }
})


// ── POST /api/conversations/:id/demote — Admin degradieren ───────────────
router.post('/:id/demote', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.body
    const conv: any = await Conversation.findById(req.params.id)
    if (!conv) { res.status(404).json({ error: 'Nicht gefunden' }); return }
    const admins = conv.admins || []
    const isCreator = admins.length === 0
      ? conv.participants[0]?.toString() === req.userId
      : conv.admins[0]?.toString() === req.userId
    if (!isCreator) { res.status(403).json({ error: 'Nur der Gruppen-Ersteller darf Admins entfernen' }); return }
    conv.admins = (conv.admins || []).filter((a: any) => a.toString() !== userId)
    await conv.save()
    const populated = await conv.populate('participants', PUBLIC_USER_FIELDS)
      .populate('bots', 'name botId status')
    res.json(populated)
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// ── POST /api/conversations/:id/mute — Mitglied stummschalten ────────────
router.post('/:id/mute', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId, minutes } = req.body
    const conv: any = await Conversation.findById(req.params.id)
    if (!conv) { res.status(404).json({ error: 'Nicht gefunden' }); return }
    const isAdmin = conv.admins?.some((a: any) => a.toString() === req.userId)
      || conv.participants[0]?.toString() === req.userId
    if (!isAdmin) { res.status(403).json({ error: 'Nur Admins' }); return }

    const mutedUntil = new Date(Date.now() + Number(minutes) * 60 * 1000)
    if (!conv.muteList) conv.muteList = []
    const existing = conv.muteList.findIndex((m: any) => m.userId.toString() === String(userId))
    if (existing >= 0) {
      conv.muteList[existing].mutedUntil = mutedUntil
    } else {
      conv.muteList.push({ userId: new Types.ObjectId(userId), mutedUntil })
    }
    conv.markModified('muteList')
    await conv.save()
    res.json({ ok: true, mutedUntil })
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// ── DELETE /api/conversations/:id/messages — Chat leeren (nur Nachrichten) ─
router.delete('/:id/messages', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const conv: any = await Conversation.findOne({ _id: req.params.id, participants: req.userId })
    if (!conv) { res.status(404).json({ error: 'Nicht gefunden' }); return }
    const isAdmin = conv.admins?.some((a: any) => a.toString() === req.userId)
      || conv.participants[0]?.toString() === req.userId
    if (!isAdmin) { res.status(403).json({ error: 'Nur Admins' }); return }
    const { Message } = require('../models/Message')
    await Message.deleteMany({ conversationId: req.params.id })
    conv.lastMessage = undefined
    await conv.save()
    // Socket: alle informieren
    try {
      const { getIO } = require('../socket/socketServer')
      getIO().to(req.params.id).emit('chat_cleared', { conversationId: req.params.id })
    } catch (_se) {}
    res.json({ ok: true })
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})


export default router
