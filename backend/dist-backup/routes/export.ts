import { Router, Response } from 'express'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { Message } from '../models/Message'
import { Conversation } from '../models/Conversation'

const router = Router()
router.use(authMiddleware)

// GET /api/export/:conversationId?format=txt|json
router.get('/:conversationId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { conversationId } = req.params
    const format = (req.query.format as string) || 'txt'

    // Prüfen ob User Mitglied ist
    const conv = await Conversation.findOne({
      _id: conversationId,
      participants: req.userId,
    }).populate('participants', 'username uin')

    if (!conv) { res.status(404).json({ error: 'Nicht gefunden' }); return }

    const messages = await Message.find({
      conversationId,
      deleted: false,
    })
      .populate('sender', 'username uin')
      .sort({ createdAt: 1 })
      .limit(10000)
      .lean()

    const convName = (conv as any).isGroup
      ? (conv as any).groupName
      : `Chat_${conversationId.slice(-6)}`

    const filename = `PingR_${convName}_${new Date().toISOString().slice(0,10)}`

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`)
      res.json({
        conversation: {
          id:   conversationId,
          name: convName,
          exportedAt: new Date().toISOString(),
        },
        messages: messages.map((m: any) => ({
          id:        m._id,
          sender:    m.sender?.username || 'Unbekannt',
          content:   m.content || '',
          type:      m.type,
          createdAt: m.createdAt,
          edited:    m.edited || false,
        })),
      })
      return
    }

    // TXT Format
    const lines: string[] = [
      `PingR Chat-Export`,
      `Gespräch: ${convName}`,
      `Exportiert: ${new Date().toLocaleString('de-DE')}`,
      `Nachrichten: ${messages.length}`,
      `${'─'.repeat(60)}`,
      '',
    ]

    messages.forEach((m: any) => {
      const sender  = m.sender?.username || 'Unbekannt'
      const time    = new Date(m.createdAt).toLocaleString('de-DE', {
        day:'2-digit', month:'2-digit', year:'2-digit',
        hour:'2-digit', minute:'2-digit',
      })
      const content = m.deleted ? '[Nachricht gelöscht]'
        : m.type === 'voice' ? '[Sprachnachricht]'
        : m.type === 'file'  ? `[Datei: ${m.fileName || ''}]`
        : m.content || ''

      lines.push(`[${time}] ${sender}: ${content}`)
      if (m.edited) lines[lines.length - 1] += ' (bearbeitet)'
    })

    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.txt"`)
    res.send(lines.join('\n'))
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

export default router