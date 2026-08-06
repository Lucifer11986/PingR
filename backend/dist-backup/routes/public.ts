import { Router, Request, Response } from 'express'
import { User }         from '../models/User'
import { Message }      from '../models/Message'
import { Conversation } from '../models/Conversation'

const router = Router()

// GET /api/public/stats — Live-Statistiken für die Landing Page (kein Auth nötig)
router.get('/stats', async (_req: Request, res: Response): Promise<void> => {
  try {
    const [totalUsers, online, totalMessages, totalGroups] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ status: 'online' }),
      Message.countDocuments({ deleted: false }),
      Conversation.countDocuments({ isGroup: true }),
    ])
    res.set('Cache-Control', 'public, max-age=30')
    res.json({ totalUsers, online, totalMessages, totalGroups })
  } catch {
    res.json({ totalUsers: 0, online: 0, totalMessages: 0, totalGroups: 0 })
  }
})

export default router