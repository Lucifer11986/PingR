import { Router, Request, Response } from 'express'
import { authMiddleware }            from '../middleware/devAuth'
import BotAnalytics from '../models/BotAnalytics'
import DevUser from '../models/DevUser'

const router = Router()
router.use(authMiddleware)

// ── GET /api/dev/activity ─────────────────────────────────────────
router.get('/activity', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId
    const Bot    = require('../models/Bot').default

    const bots   = await Bot.find({ ownerId: userId }).lean()
    const activities: any[] = []

    // Bot-Erstellungen
    for (const b of bots) {
      activities.push({
        type:        'bot_created',
        title:       `Bot "${b.name}" wurde erstellt`,
        description: 'Neuer Bot erfolgreich erstellt und aktiviert',
        createdAt:   b.createdAt,
      })
    }

    const user = await DevUser.findById(userId).select('createdAt').lean()
    if (user?.createdAt) activities.push({ type: 'welcome', title: 'Developer-Account erstellt', description: 'Dein Nokki-Developer-Account wurde angelegt', createdAt: user.createdAt })

    activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    res.json({ activities: activities.slice(0, 20) })
  } catch (err) {
    console.error('[devAnalytics] activity error:', err)
    res.status(500).json({ activities: [] })
  }
})

// ── GET /api/dev/analytics/chart ─────────────────────────────────
router.get('/analytics/chart', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId
    const Bot    = require('../models/Bot').default

    const bots   = await Bot.find({ ownerId: userId }).lean()

    const botIds = bots.map((bot: any) => bot.botId)
    const start = new Date(); start.setUTCHours(0, 0, 0, 0); start.setUTCDate(start.getUTCDate() - 6)
    const records = await BotAnalytics.find({ botId: { $in: botIds }, date: { $gte: start } }).lean()
    const data = Array.from({ length: 7 }, (_, i) => {
      const d    = new Date(Date.now() - (6 - i) * 86400000)
      const date = d.toISOString().slice(0, 10)
      const day = records.filter((record: any) => new Date(record.date).toISOString().slice(0, 10) === date)
      return {
        date,
        calls: day.reduce((sum: number, record: any) => sum + (record.apiCalls || 0) + (record.webhookCalls || 0), 0),
        messages: day.reduce((sum: number, record: any) => sum + (record.messagesSent || 0), 0),
        errors: day.reduce((sum: number, record: any) => sum + (record.webhookFailures || 0), 0),
      }
    })
    const totalCalls = data.reduce((sum, day) => sum + day.calls, 0)
    const totalMessages = data.reduce((sum, day) => sum + day.messages, 0)
    const totalErrors = data.reduce((sum, day) => sum + day.errors, 0)

    res.json({
      data,
      totals: {
        calls:     totalCalls,
        messages:  totalMessages,
        errorRate: totalCalls ? Math.round((totalErrors / totalCalls) * 10000) / 100 : 0,
      },
    })
  } catch (err) {
    console.error('[devAnalytics] chart error:', err)
    res.status(500).json({ data: [], totals: { calls: 0, messages: 0, errorRate: 0 } })
  }
})

export default router
