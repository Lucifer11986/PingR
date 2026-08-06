import express, { Request, Response } from 'express'
import Giveaway from '../models/Giveaway'
import Bot from '../models/Bot'
import BotInstallation from '../models/BotInstallation'
import Message from '../models/Message'
import { authMiddleware } from '../middleware/devAuth'
import { authMiddleware as chatAuthMiddleware } from '../middleware/auth'
import { getBotSystemUserId } from '../utils/botMessageSender'
import { getIO } from '../socket/socketServer'
import { triggerGiveawayEvent } from '../utils/webhookTrigger'
import { trackBotAnalytics } from '../utils/analyticsTracker'

const router = express.Router()

/**
 * POST /api/bot-giveaways/create
 * Erstelle neues Giveaway
 */
router.post('/create', authMiddleware, async (req: Request, res: Response) => {
  try {
    const {
      botId,
      conversationId,
      prize,
      description,
      duration,
      winnersCount,
      requirements
    } = req.body
    const userId = (req as any).userId

    // Validierung
    if (!botId || !conversationId || !prize || !duration) {
      return res.status(400).json({ error: 'botId, conversationId, prize und duration erforderlich' })
    }
    const durationMinutes = Number(duration)
    const winnerTotal = Number(winnersCount || 1)
    if (typeof prize !== 'string' || !prize.trim() || prize.length > 120) return res.status(400).json({ error: 'Preis muss zwischen 1 und 120 Zeichen lang sein' })
    if (!Number.isFinite(durationMinutes) || durationMinutes < 1 || durationMinutes > 43200) return res.status(400).json({ error: 'Dauer muss zwischen 1 Minute und 30 Tagen liegen' })
    if (!Number.isInteger(winnerTotal) || winnerTotal < 1 || winnerTotal > 20) return res.status(400).json({ error: 'Gewinneranzahl muss zwischen 1 und 20 liegen' })

    // Bot Owner Check
    const bot = await Bot.findOne({ botId, ownerId: userId })
    if (!bot) {
      return res.status(403).json({ error: 'Keine Berechtigung für diesen Bot' })
    }

    // Installation Check
    const installation = await BotInstallation.findOne({
      botId,
      channelId: conversationId,
      active: true
    })
    if (!installation) {
      return res.status(400).json({ error: 'Bot nicht in dieser Conversation installiert' })
    }

    // Berechne End-Zeit
    const endsAt = new Date(Date.now() + durationMinutes * 60 * 1000)

    // Erstelle Giveaway
    const systemUserId = await getBotSystemUserId()
    const giveaway = new Giveaway({
      botId,
      conversationId,
      prize: prize.trim(),
      description: typeof description === 'string' ? description.slice(0, 500) : '',
      requirements: typeof requirements === 'string' ? requirements.slice(0, 300) : '',
      duration: durationMinutes,
      winnersCount: winnerTotal,
      endsAt,
      createdBy: systemUserId,
      developerId: userId,
      status: 'active'
    })

    await giveaway.save()

    // Erstelle Message mit Giveaway Widget
    const message = new Message({
      sender: systemUserId,
      conversationId,
      content: `🎉 **GIVEAWAY!** 🎉\n\n**Preis:** ${prize}\n${description ? `**Beschreibung:** ${description}\n` : ''}\n**Endet:** <t:${Math.floor(endsAt.getTime() / 1000)}:R>\n**Gewinner:** ${winnersCount}\n\nKlicke "Teilnehmen" um mitzumachen!`,
      type: 'text', botId, botName: bot.name, isBotMessage: true
    })

    await message.save()

    // Speichere Message ID im Giveaway
    giveaway.messageId = message._id.toString()
    await giveaway.save()

    // Socket Event
    const io = getIO()
    await message.populate('sender')
    io.to(`conv:${conversationId}`).emit('new_message', message)
    io.to(`conv:${conversationId}`).emit('giveaway_created', {
      giveawayId: giveaway._id,
      messageId: message._id
    })

    // Webhook Trigger
    await triggerGiveawayEvent(botId, 'start', giveaway)

    // Analytics
    await trackBotAnalytics(botId, 'giveawayCreated')

    console.log(`🎉 [GIVEAWAY] Created: ${giveaway.giveawayId}`)

    res.json({
      success: true,
      giveaway: {
        id: giveaway._id,
        giveawayId: giveaway.giveawayId,
        prize,
        endsAt,
        messageId: message._id
      }
    })

  } catch (error) {
    console.error('❌ [GIVEAWAY] Create error:', error)
    res.status(500).json({ error: 'Fehler beim Erstellen' })
  }
})

/**
 * POST /api/bot-giveaways/:id/join
 * User tritt Giveaway bei
 */
router.post('/:id/join', chatAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const userId = (req as any).userId

    const giveaway = await Giveaway.findById(id)
    if (!giveaway) {
      return res.status(404).json({ error: 'Giveaway nicht gefunden' })
    }

    if (giveaway.status !== 'active') {
      return res.status(400).json({ error: 'Giveaway ist nicht mehr aktiv' })
    }

    // Check if already participating
    const alreadyJoined = giveaway.participants.some(
      p => p.toString() === userId
    )

    if (alreadyJoined) {
      return res.status(400).json({ error: 'Du nimmst bereits teil' })
    }

    const conversation = await (await import('../models/Conversation')).default.findById(giveaway.conversationId).lean().catch(() => null) as any
    if (!conversation?.participants?.some((id: any) => id.toString() === userId)) return res.status(403).json({ error: 'Du bist kein Mitglied dieser Gruppe' })

    // Add participant
    giveaway.participants.push(userId as any)

    await giveaway.save()

    // Socket Event
    const io = getIO()
    io.to(`conv:${giveaway.conversationId}`).emit('giveaway_participant', {
      giveawayId: giveaway._id,
      userId,
      participantCount: giveaway.participants.length
    })

    // Webhook
    await triggerGiveawayEvent(giveaway.botId, 'participant', giveaway)

    // Analytics
    await trackBotAnalytics(giveaway.botId, 'giveawayParticipant')

    console.log(`✅ [GIVEAWAY] User ${userId} joined ${giveaway.giveawayId}`)

    res.json({
      success: true,
      participantCount: giveaway.participants.length
    })

  } catch (error) {
    console.error('❌ [GIVEAWAY] Join error:', error)
    res.status(500).json({ error: 'Fehler beim Beitreten' })
  }
})

router.get('/bot/:botId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const bot = await Bot.findOne({ botId: req.params.botId, ownerId: (req as any).userId })
    if (!bot) return res.status(403).json({ error: 'Keine Berechtigung' })
    const giveaways = await Giveaway.find({ botId: req.params.botId }).sort({ createdAt: -1 }).limit(50)
    res.json({ success: true, giveaways })
  } catch (error) {
    console.error('❌ [GIVEAWAY] List error:', error)
    res.status(500).json({ error: 'Fehler beim Laden' })
  }
})

/**
 * GET /api/bot-giveaways/bot/:botId
 * List all giveaways for a bot
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const giveaway = await Giveaway.findById(req.params.id).populate('createdBy', 'username avatar').populate('winners', 'username avatar')
    if (!giveaway) return res.status(404).json({ error: 'Giveaway nicht gefunden' })
    res.json({ success: true, giveaway })
  } catch (error) {
    console.error('❌ [GIVEAWAY] Get error:', error)
    res.status(500).json({ error: 'Fehler beim Laden' })
  }
})

/**
 * DELETE /api/bot-giveaways/:id
 * Cancel Giveaway
 */
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const userId = (req as any).userId

    const giveaway = await Giveaway.findById(id)
    if (!giveaway) {
      return res.status(404).json({ error: 'Giveaway nicht gefunden' })
    }

    // Bot Owner Check
    const bot = await Bot.findOne({ botId: giveaway.botId, ownerId: userId })
    if (!bot) {
      return res.status(403).json({ error: 'Keine Berechtigung' })
    }

    if (giveaway.status !== 'active') {
      return res.status(400).json({ error: 'Giveaway ist nicht mehr aktiv' })
    }

    giveaway.status = 'cancelled'
    await giveaway.save()

    // Socket Event
    const io = getIO()
    io.to(`conv:${giveaway.conversationId}`).emit('giveaway_cancelled', {
      giveawayId: giveaway._id
    })

    console.log(`❌ [GIVEAWAY] Cancelled: ${giveaway.giveawayId}`)

    res.json({
      success: true,
      message: 'Giveaway abgebrochen'
    })

  } catch (error) {
    console.error('❌ [GIVEAWAY] Cancel error:', error)
    res.status(500).json({ error: 'Fehler beim Abbrechen' })
  }
})

export default router
