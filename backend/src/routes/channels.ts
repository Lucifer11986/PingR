import { Router, Request, Response } from 'express'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { Channel } from '../models/Channel'
import { Message } from '../models/Message'
import { getIO }   from '../socket/socketServer'
import { upload, verifyUpload }  from '../middleware/upload'

const router = Router()
router.use(authMiddleware)

// -- GET /api/channels � eigene Channels (abonniert + owned) ------------------
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const channels = await Channel.find({
      $or: [{ subscribers: userId }, { owner: userId }, { admins: userId }]
    })
      .populate('lastMessage')
      .sort({ updatedAt: -1 })

    // Als "Conversation-�hnliche" Objekte zur�ckgeben damit das Frontend
    // sie direkt in die bestehende Conversation-Liste einreihen kann
    const result = channels.map(ch => ({
      _id:           ch._id,
      isChannel:     true,
      isGroup:       false,
      groupName:     ch.name,
      groupAvatar:   ch.avatar,
      channelHandle: ch.handle,
      description:   ch.description,
      verified:      ch.verified,
      isPublic:      ch.isPublic,
      owner:         ch.owner,
      admins:        ch.admins,
      subscribers:   ch.subscribers,
      subscriberCount: ch.subscribers.length,
      lastMessage:   ch.lastMessage,
      unreadCount:   (ch.unreadCounts as any)?.get?.(userId) || (ch.unreadCounts as any)?.[userId] || 0,
      participants:  [], // Kompatibilit�t mit Frontend
      updatedAt:     ch.updatedAt,
      createdAt:     ch.createdAt,
    }))

    res.json(result)
  } catch (err) {
    console.error('[channels] GET / error:', err)
    res.status(500).json({ error: 'Serverfehler' })
  }
})

// -- POST /api/channels � Channel erstellen -----------------------------------
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name, handle, description, isPublic } = req.body
    const userId = req.userId!

    if (!name?.trim())   return res.status(400).json({ error: 'Name erforderlich' })
    if (!handle?.trim()) return res.status(400).json({ error: 'Handle erforderlich' })

    const cleanHandle = handle.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')
    if (cleanHandle.length < 3)
      return res.status(400).json({ error: 'Handle muss mindestens 3 Zeichen haben (a-z, 0-9, _)' })

    const exists = await Channel.findOne({ handle: cleanHandle })
    if (exists) return res.status(400).json({ error: `@${cleanHandle} ist bereits vergeben` })

    const channel = await Channel.create({
      name:        name.trim(),
      handle:      cleanHandle,
      description: description?.trim() || '',
      isPublic:    isPublic !== false,
      owner:       userId,
      admins:      [userId],
      subscribers: [userId], // Owner abonniert automatisch
    })

    // Als Conversation-Format zur�ckgeben
    res.status(201).json({
      _id:           channel._id,
      isChannel:     true,
      isGroup:       false,
      groupName:     channel.name,
      channelHandle: channel.handle,
      description:   channel.description,
      isPublic:      channel.isPublic,
      verified:      false,
      owner:         channel.owner,
      admins:        channel.admins,
      subscribers:   channel.subscribers,
      subscriberCount: 1,
      participants:  [],
      updatedAt:     channel.updatedAt,
      createdAt:     channel.createdAt,
    })
  } catch (err: any) {
    if (err.code === 11000) return res.status(400).json({ error: 'Handle bereits vergeben' })
    console.error('[channels] POST / error:', err)
    res.status(500).json({ error: 'Serverfehler' })
  }
})

// -- GET /api/channels/search � Channel suchen --------------------------------
router.get('/search', async (req: AuthRequest, res: Response) => {
  try {
    const q = (req.query.q as string)?.trim()
    if (!q || q.length < 2) return res.json([])

    const channels = await Channel.find({
      isPublic: true,
      $or: [
        { name:   { $regex: q, $options: 'i' } },
        { handle: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
      ]
    }).limit(20).select('name handle description avatar verified subscribers isPublic')

    res.json(channels.map(ch => ({
      _id:            ch._id,
      name:           ch.name,
      handle:         ch.handle,
      description:    ch.description,
      avatar:         ch.avatar,
      verified:       ch.verified,
      subscriberCount: ch.subscribers.length,
    })))
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' })
  }
})

// -- POST /api/channels/:id/subscribe � Abonnieren/Abbestellen ----------------
router.post('/:id/subscribe', async (req: AuthRequest, res: Response) => {
  try {
    const userId  = req.userId!
    const channel = await Channel.findById(req.params.id)
    if (!channel) return res.status(404).json({ error: 'Channel nicht gefunden' })

    const isSubscribed = channel.subscribers.some(s => s.toString() === userId)
    if (isSubscribed) {
      // Abbestellen (Owner kann nicht abbestellen)
      if (channel.owner.toString() === userId)
        return res.status(400).json({ error: 'Owner kann Channel nicht abbestellen' })
      channel.subscribers = channel.subscribers.filter(s => s.toString() !== userId)
    } else {
      channel.subscribers.push(userId as any)
    }
    await channel.save()

    res.json({ subscribed: !isSubscribed, subscriberCount: channel.subscribers.length })
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' })
  }
})

// -- GET /api/channels/:id/messages � Nachrichten laden -----------------------
router.get('/:id/messages', async (req: AuthRequest, res: Response) => {
  try {
    const channel = await Channel.findById(req.params.id)
    if (!channel) return res.status(404).json({ error: 'Channel nicht gefunden' })

    const msgs = await Message.find({
      conversationId: req.params.id,
      deleted: { $ne: true },
    }).populate('sender', 'username avatar').sort({ createdAt: -1 }).limit(100)

    res.json(msgs.reverse())
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' })
  }
})

// -- POST /api/channels/:id/messages � Nachricht senden (nur Admins) ----------
router.post('/:id/messages', async (req: AuthRequest, res: Response) => {
  try {
    const userId  = req.userId!
    const channel = await Channel.findById(req.params.id)
    if (!channel) return res.status(404).json({ error: 'Channel nicht gefunden' })

    // Nur Owner/Admins d�rfen schreiben
    const isAdmin = channel.owner.toString() === userId ||
                    channel.admins.some(a => a.toString() === userId)
    if (!isAdmin) return res.status(403).json({ error: 'Nur Admins k�nnen in Channels schreiben' })

    const { content, type = 'text' } = req.body
    if (!content?.trim()) return res.status(400).json({ error: 'Inhalt erforderlich' })

    const msg = await Message.create({
      conversationId: req.params.id,
      sender: userId,
      content: content.trim(),
      type,
      readBy: [userId],
    })

    const populated = await msg.populate('sender', 'username avatar')

    // Unread f�r alle Subscriber erh�hen au�er den Sender
    const update: Record<string, number> = {}
    channel.subscribers.forEach(sub => {
      const subscriberId = sub.toString()
      if (subscriberId !== userId) {
        const key = `unreadCounts.${subscriberId}`
        update[key] = ((channel.unreadCounts as any)?.[subscriberId] || 0) + 1
      }
    })
    await Channel.findByIdAndUpdate(req.params.id, {
      lastMessage: msg._id,
      updatedAt:   new Date(),
      $inc:        Object.keys(update).length ? update : undefined,
    })

    // Socket Event an alle Subscriber
    getIO().to(`channel:${req.params.id}`).emit('new_message', {
      ...populated.toObject(),
      conversationId: req.params.id,
    })

    res.status(201).json(populated)
  } catch (err) {
    console.error('[channels] POST /:id/messages error:', err)
    res.status(500).json({ error: 'Serverfehler' })
  }
})

// -- PATCH /api/channels/:id � Channel bearbeiten (nur Owner/Admin) -----------
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId  = req.userId!
    const channel = await Channel.findById(req.params.id)
    if (!channel) return res.status(404).json({ error: 'Channel nicht gefunden' })

    const isAdmin = channel.owner.toString() === userId ||
                    channel.admins.some(a => a.toString() === userId)
    if (!isAdmin) return res.status(403).json({ error: 'Keine Berechtigung' })

    const { name, description, isPublic, slowMode, isAdult } = req.body
    if (name !== undefined)        channel.name        = name.trim()
    if (description !== undefined) channel.description = description.trim()
    if (isPublic !== undefined)    channel.isPublic    = isPublic
    if (slowMode !== undefined)    channel.slowMode    = slowMode
    if (isAdult !== undefined)     (channel as any).isAdult = isAdult
    await channel.save()

    res.json({ success: true, channel })
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' })
  }
})

// -- POST /api/channels/:id/avatar � Avatar hochladen -------------------------
router.post('/:id/avatar', upload.single('avatar'), verifyUpload, async (req: AuthRequest, res: Response) => {
  try {
    const userId  = req.userId!
    const channel = await Channel.findById(req.params.id)
    if (!channel) return res.status(404).json({ error: 'Channel nicht gefunden' })

    const isAdmin = channel.owner.toString() === userId ||
                    channel.admins.some(a => a.toString() === userId)
    if (!isAdmin) return res.status(403).json({ error: 'Keine Berechtigung' })
    if (!req.file) return res.status(400).json({ error: 'Keine Datei' })

    channel.avatar = `/uploads/${req.file.filename}`
    await channel.save()
    res.json({ avatar: channel.avatar })
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' })
  }
})

// -- DELETE /api/channels/:id � Channel l�schen (nur Owner) -------------------
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId  = req.userId!
    const channel = await Channel.findById(req.params.id)
    if (!channel) return res.status(404).json({ error: 'Channel nicht gefunden' })
    if (channel.owner.toString() !== userId)
      return res.status(403).json({ error: 'Nur der Owner kann den Channel l�schen' })

    await Channel.findByIdAndDelete(req.params.id)
    await Message.deleteMany({ conversationId: req.params.id })

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' })
  }
})

// -- GET /api/channels/:id/mark-read � Als gelesen markieren ------------------
router.post('/:id/mark-read', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    await Channel.findByIdAndUpdate(req.params.id, {
      [`unreadCounts.${userId}`]: 0,
    })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' })
  }
})

export default router
