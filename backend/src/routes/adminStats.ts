import { Router, Request, Response } from 'express'
import { User }         from '../models/User'
import { Message }      from '../models/Message'
import { Conversation } from '../models/Conversation'
import type { PipelineStage } from 'mongoose'
import { adminAuth, requireAdminPermission } from '../middleware/adminAuth'

const router = Router()

router.use(adminAuth, requireAdminPermission('charts'))

// GET /api/admin/charts — Chartdaten für Dashboard
router.get('/charts', async (_req: Request, res: Response): Promise<void> => {
  try {
    const now    = new Date()
    const day30  = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const day7   = new Date(now.getTime() -  7 * 24 * 60 * 60 * 1000)

    // Registrierungen der letzten 30 Tage nach Tag
    const regPipeline: PipelineStage[] = [
      { $match: { createdAt: { $gte: day30 } } },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 },
      }},
      { $sort: { _id: 1 } },
    ]
    const regStats = await User.aggregate(regPipeline)

    // Nachrichten der letzten 7 Tage nach Tag
    const msgPipeline: PipelineStage[] = [
      { $match: { createdAt: { $gte: day7 }, deleted: false } },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 },
      }},
      { $sort: { _id: 1 } },
    ]
    const msgStats = await Message.aggregate(msgPipeline)

    // Top aktive Nutzer (meiste Nachrichten)
    const topUsersPipeline: PipelineStage[] = [
      { $match: { createdAt: { $gte: day30 }, deleted: false } },
      { $group: { _id: '$sender', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $project: { username: '$user.username', uin: '$user.uin', count: 1 } },
    ]
    const topUsers = await Message.aggregate(topUsersPipeline)

    // Top Gruppen (meiste Mitglieder)
    const topGroups = await Conversation.find({ isGroup: true })
      .select('groupName participants groupAvatar')
      .sort({ 'participants.length': -1 })
      .limit(5)
      .lean()

    // Gesamtzahlen
    const [totalUsers, totalMessages, totalGroups, activeToday] = await Promise.all([
      User.countDocuments(),
      Message.countDocuments({ deleted: false }),
      Conversation.countDocuments({ isGroup: true }),
      User.countDocuments({
        lastSeen: { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) }
      }),
    ])

    // Nachrichten-Typen Verteilung
    const typePipeline: PipelineStage[] = [
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]
    const typeStats = await Message.aggregate(typePipeline)

    res.json({
      totals: { totalUsers, totalMessages, totalGroups, activeToday },
      registrations: regStats,
      messages:      msgStats,
      topUsers,
      topGroups:     topGroups.map((g: any) => ({
        name:    g.groupName,
        members: g.participants?.length || 0,
        avatar:  g.groupAvatar,
      })),
      messageTypes: typeStats,
    })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

export default router
