import { Router, Request, Response } from 'express'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import Giveaway from '../models/Giveaway'
import { getIO } from '../socket/socketServer'
import { PUBLIC_USER_FIELDS } from '../utils/userFields'

const router = Router()

router.use(authMiddleware)

// GET /api/giveaways - Hole aktives Giveaway für Conversation
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { conversationId } = req.query
    
    if (!conversationId) {
      res.status(400).json({ error: 'conversationId ist erforderlich' })
      return
    }

    // Erst aktives Giveaway suchen
    let giveaway = await Giveaway.findOne({
      conversationId,
      status: 'active'
    }).populate('participants', 'username avatar').populate('winners', 'username avatar')

    // Kein aktives → letztes beendetes laden
    if (!giveaway) {
      giveaway = await Giveaway.findOne({
        conversationId,
        status: { $in: ['completed', 'ended', 'cancelled'] }
      }).sort({ createdAt: -1 }).populate('participants', 'username avatar').populate('winners', 'username avatar')
    }

    res.json({ giveaway })

  } catch (error) {
    console.error('❌ [GIVEAWAY] Get error:', error)
    res.status(500).json({ error: 'Fehler beim Laden' })
  }
})

// POST /api/giveaways - Erstelle neues Giveaway
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { conversationId, prize, description, duration, winners, requirements } = req.body

    // Validation
    if (!conversationId || !prize) {
      res.status(400).json({ error: 'conversationId und prize sind erforderlich' })
      return
    }

    // Berechne End Time
    const endsAt = new Date()
    endsAt.setMinutes(endsAt.getMinutes() + (duration || 60))

    // Erstelle Giveaway
    const giveaway = await Giveaway.create({
      conversationId,
      createdBy: req.userId,
      prize,
      description,
      requirements: requirements || 'React mit 🎉 um teilzunehmen',
      duration: duration || 60,
      winnersCount: winners || 1,
      endsAt,
      status: 'active',
      participants: []
    })

    console.log('✅ [GIVEAWAY] Created:', giveaway._id)

    // Chat-Ankündigung für alle User
    try {
      const { Message } = require('../models/Message')
      const BotInstallation = require('../models/BotInstallation').default
      const Bot = require('../models/Bot').default
      const installation = await BotInstallation.findOne({ channelId: conversationId, active: true })
      const bot = installation ? await Bot.findOne({ botId: installation.botId }) : null
      const senderId = bot?._id || req.userId
      const announcementText = `🎉 **GIVEAWAY GESTARTET!** 🎉\n\n🏆 **Preis:** ${prize}\n⏱️ **Dauer:** ${duration || 60} Minuten\n👥 **Gewinner:** ${winners || 1}\n\n📋 **Teilnahmebedingungen:** ${requirements || 'Schreibe /teilnehmen im Chat'}\n\n➡️ Tippe **/teilnehmen** um mitzumachen!`
      const msg = await Message.create({ conversationId, sender: senderId, content: announcementText, type: 'text', readBy: [req.userId] })
      const pop = await msg.populate('sender', PUBLIC_USER_FIELDS)
      getIO().to(`conv:${conversationId}`).emit('new_message', pop)
      console.log('✅ [GIVEAWAY] Announcement sent')
    } catch (msgErr) {
      console.error('❌ [GIVEAWAY] Announcement error:', msgErr)
    }

    // Socket: Sende Giveaway an alle in Conversation
    getIO().to(`conv:${conversationId}`).emit('giveaway_created', {
      giveaway: giveaway.toObject()
    })

    res.status(201).json({ success: true, giveaway })

  } catch (error) {
    console.error('❌ [GIVEAWAY] Create error:', error)
    res.status(500).json({ error: 'Fehler beim Erstellen des Giveaways' })
  }
})

// POST /api/giveaways/:id/participate - Teilnehmen
router.post('/:id/participate', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const giveaway = await Giveaway.findById(req.params.id)
    if (!giveaway) {
      res.status(404).json({ error: 'Giveaway nicht gefunden' })
      return
    }

    if (giveaway.status !== 'active') {
      res.status(400).json({ error: 'Giveaway ist nicht mehr aktiv' })
      return
    }

    // Check if already participating
    if (giveaway.participants.some((p: any) => p.toString() === req.userId)) {
      res.status(400).json({ error: 'Du nimmst bereits teil' })
      return
    }

    // Add participant
    giveaway.participants.push(req.userId as any)
    await giveaway.save()

    console.log(`✅ [GIVEAWAY] User ${req.userId} joined ${giveaway._id}`)

    // Socket: Live Update
    getIO().to(`conv:${giveaway.conversationId}`).emit('giveaway_updated', {
      giveawayId: giveaway._id,
      participants: giveaway.participants
    })

    res.json({ success: true, participantCount: giveaway.participants.length })

  } catch (error) {
    console.error('❌ [GIVEAWAY] Participate error:', error)
    res.status(500).json({ error: 'Fehler beim Beitreten' })
  }
})

// POST /api/giveaways/:id/draw - Gewinner ziehen
router.post('/:id/draw', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const giveaway = await Giveaway.findById(req.params.id)
    if (!giveaway) {
      res.status(404).json({ error: 'Giveaway nicht gefunden' })
      return
    }

    // Check if creator
    if (giveaway.createdBy.toString() !== req.userId) {
      res.status(403).json({ error: 'Nur der Ersteller kann Gewinner ziehen' })
      return
    }

    if (giveaway.status !== 'active') {
      res.status(400).json({ error: 'Giveaway ist nicht mehr aktiv' })
      return
    }

    if (giveaway.participants.length === 0) {
      res.status(400).json({ error: 'Keine Teilnehmer vorhanden' })
      return
    }

    // Random pick winners
    const shuffled = [...giveaway.participants].sort(() => Math.random() - 0.5)
    const winners = shuffled.slice(0, Math.min(giveaway.winnersCount, shuffled.length))

    giveaway.winners = winners
    giveaway.status = 'completed'
    await giveaway.save()

    console.log(`✅ [GIVEAWAY] Winners drawn for ${giveaway._id}:`, winners)

    // Socket: Announce winners
    getIO().to(`conv:${giveaway.conversationId}`).emit('giveaway_completed', {
      giveawayId: giveaway._id,
      winners
    })

    // Gewinner im Chat ankündigen
    try {
      const Message = require('../models/Message').Message
      const BotInstallation = require('../models/BotInstallation').default
      const Bot = require('../models/Bot').default
      const installation = await BotInstallation.findOne({ channelId: giveaway.conversationId, active: true })
      const bot = installation ? await Bot.findOne({ botId: installation.botId }) : null

      const populated = await Giveaway.findById(giveaway._id).populate('winners', 'username')
      const winnerNames = (populated?.winners as any[])?.map((w: any) => `@${w.username || w}`).join(', ') || '?'

      const announceMsg = await Message.create({
        conversationId: giveaway.conversationId,
        sender: bot?._id || giveaway.createdBy,
        content: `🎊 **GIVEAWAY BEENDET!** 🎊\n\n🏆 **Preis:** ${giveaway.prize}\n\n🎉 **Gewinner:** ${winnerNames}\n\nHerzlichen Glückwunsch!`,
        type: 'text',
        readBy: []
      })
      const announcePop = await announceMsg.populate('sender', PUBLIC_USER_FIELDS)
      getIO().to(`conv:${giveaway.conversationId}`).emit('new_message', announcePop)
    } catch (announceErr) {
      console.error('❌ [GIVEAWAY] Winner announcement error:', announceErr)
    }

    res.json({ success: true, winners })

  } catch (error) {
    console.error('❌ [GIVEAWAY] Draw error:', error)
    res.status(500).json({ error: 'Fehler beim Ziehen der Gewinner' })
  }
})

// DELETE /api/giveaways/:id - Giveaway abbrechen
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const giveaway = await Giveaway.findById(req.params.id)
    if (!giveaway) {
      res.status(404).json({ error: 'Giveaway nicht gefunden' })
      return
    }

    // Check if creator
    if (giveaway.createdBy.toString() !== req.userId) {
      res.status(403).json({ error: 'Nur der Ersteller kann das Giveaway abbrechen' })
      return
    }

    giveaway.status = 'cancelled'
    await giveaway.save()

    console.log(`✅ [GIVEAWAY] Cancelled ${giveaway._id}`)

    // Socket: Notify cancellation
    getIO().to(`conv:${giveaway.conversationId}`).emit('giveaway_cancelled', {
      giveawayId: giveaway._id
    })

    res.json({ success: true })

  } catch (error) {
    console.error('❌ [GIVEAWAY] Cancel error:', error)
    res.status(500).json({ error: 'Fehler beim Abbrechen' })
  }
})

export default router
