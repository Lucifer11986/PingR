import express, { Request, Response } from 'express'
import Bot from '../models/Bot'
import { authMiddleware } from '../middleware/devAuth'
import { getBotAnalytics, getCommandUsageStats } from '../utils/analyticsTracker'

const router = express.Router()

/**
 * GET /api/bot-analytics/:botId
 * Get Bot Analytics
 */
router.get('/:botId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { botId } = req.params
    const { days = '30' } = req.query
    const userId = (req as any).userId

    // Bot Owner Check
    const bot = await Bot.findOne({ botId, ownerId: userId })
    if (!bot) {
      return res.status(403).json({ error: 'Keine Berechtigung' })
    }

    const analytics = await getBotAnalytics(botId, parseInt(days as string))

    res.json({
      success: true,
      analytics
    })

  } catch (error) {
    console.error('❌ [ANALYTICS] Get error:', error)
    res.status(500).json({ error: 'Fehler beim Laden' })
  }
})

/**
 * GET /api/bot-analytics/:botId/commands
 * Get Command Usage Stats
 */
router.get('/:botId/commands', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { botId } = req.params
    const { commandId, days = '30' } = req.query
    const userId = (req as any).userId

    // Bot Owner Check
    const bot = await Bot.findOne({ botId, ownerId: userId })
    if (!bot) {
      return res.status(403).json({ error: 'Keine Berechtigung' })
    }

    const stats = await getCommandUsageStats(
      botId,
      commandId as string,
      parseInt(days as string)
    )

    res.json({
      success: true,
      stats
    })

  } catch (error) {
    console.error('❌ [ANALYTICS] Command stats error:', error)
    res.status(500).json({ error: 'Fehler beim Laden' })
  }
})

export default router