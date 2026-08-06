// notifications.ts — nutzt Conversation.unreadCounts für korrekte Ungelesen-Anzeige
import { Router, Response } from 'express'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { Message }      from '../models/Message'
import { Conversation } from '../models/Conversation'
import { User }         from '../models/User'

const router = Router()
router.use(authMiddleware)

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const since  = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    // Conversations mit unreadCounts laden
    const convs = await Conversation.find({ participants: userId })
      .select('_id groupName isGroup participants unreadCounts')
      .populate('participants', 'username avatar status')

    const user = await User.findById(userId).select('username')
    const username = (user as any)?.username || ''

    const notifications: any[] = []

    for (const conv of convs) {
      // unreadCount aus dem Conversation-Modell lesen
      const unreadCount = (conv.unreadCounts as any)?.get?.(userId) ||
                          (conv.unreadCounts as any)?.[userId] || 0

      if (unreadCount === 0) continue // Keine ungelesenen → überspringen

      // Letzte Nachricht des anderen holen
      const lastMsg = await Message.findOne({
        conversationId: conv._id,
        sender: { $ne: userId },
        deleted: { $ne: true },
        createdAt: { $gte: since },
      })
        .populate('sender', 'username avatar')
        .sort({ createdAt: -1 })

      if (!lastMsg) continue

      const sender  = lastMsg.sender as any
      const isGroup = conv.isGroup
      const isMention = username && lastMsg.content?.toLowerCase().includes(`@${username.toLowerCase()}`)

      notifications.push({
        _id:     lastMsg._id,
        type:    isMention ? 'mention' : isGroup ? 'group_message' : 'direct_message',
        icon:    isMention ? 'at' : isGroup ? 'users' : 'message',
        title:   isGroup ? `${sender?.username} in ${conv.groupName}` : sender?.username,
        preview: lastMsg.content?.slice(0, 80) || '📎 Datei',
        conversationId:   conv._id,
        conversationName: isGroup ? conv.groupName : sender?.username,
        avatar:  sender?.avatar,
        read:    false, // nur ungelesene kommen hier an
        unreadCount,
        createdAt: lastMsg.createdAt,
      })
    }

    // Nach Datum sortieren
    notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    res.json({
      notifications: notifications.slice(0, 20),
      unreadCount:   notifications.length,
    })
  } catch (err) {
    console.error('[notifications] GET error:', err)
    res.status(500).json({ error: 'Serverfehler' })
  }
})

router.post('/read-all', async (req: AuthRequest, res: Response) => {
  try {
    // Alle unreadCounts für diesen User auf 0 setzen
    await Conversation.updateMany(
      { participants: req.userId },
      { $set: { [`unreadCounts.${req.userId}`]: 0 } }
    )
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' })
  }
})

export default router