import express, { Request, Response } from 'express'
import ScheduledMessage from '../models/ScheduledMessage'
import Bot from '../models/Bot'
import BotInstallation from '../models/BotInstallation'
import { authMiddleware } from '../middleware/devAuth'
import { CronExpressionParser } from 'cron-parser'

const router = express.Router()

// POST /api/bot-scheduler/schedule - Neue Timer-Nachricht erstellen
router.post('/schedule', authMiddleware, async (req: Request, res: Response) => {
  try {
    const {
      botId,
      conversationId,
      message,
      scheduleType,
      scheduledFor,
      cronExpression,
      timezone,
      repeat
    } = req.body
    const userId = (req as any).userId

    // Validierung
    if (!botId || !conversationId || !message || !scheduleType) {
      return res.status(400).json({ error: 'botId, conversationId, message und scheduleType erforderlich' })
    }
    if (!['once', 'daily', 'weekly', 'monthly', 'cron'].includes(scheduleType)) return res.status(400).json({ error: 'Ungültiger scheduleType' })
    if (typeof message !== 'string' || !message.trim() || message.length > 2000) return res.status(400).json({ error: 'Nachricht muss zwischen 1 und 2000 Zeichen lang sein' })
    const selectedTimezone = timezone || 'Europe/Berlin'
    try { Intl.DateTimeFormat('de-DE', { timeZone: selectedTimezone }).format() } catch { return res.status(400).json({ error: 'Ungültige Zeitzone' }) }

    // Prüfe ob Bot existiert und dem User gehört
    const bot = await Bot.findOne({ botId, ownerId: userId })  // ← GEÄNDERT: ownerId statt developerId
    if (!bot) {
      return res.status(404).json({ error: 'Bot nicht gefunden oder keine Berechtigung' })
    }

    // Prüfe ob Bot in Conversation installiert ist
    const installation = await BotInstallation.findOne({
      botId,
      channelId: conversationId,  // ← GEÄNDERT: channelId in DB, conversationId vom Frontend
      active: true                 // ← GEÄNDERT: active statt status
    })
    if (!installation) {
      return res.status(400).json({ error: 'Bot ist nicht in dieser Conversation installiert' })
    }

    // Berechne nextRunAt basierend auf scheduleType
    let nextRunAt: Date | undefined

    if (scheduleType === 'once') {
      if (!scheduledFor) {
        return res.status(400).json({ error: 'scheduledFor erforderlich für once-Typ' })
      }
      nextRunAt = new Date(scheduledFor)
      
      // Prüfe ob in Zukunft
      if (nextRunAt <= new Date()) {
        return res.status(400).json({ error: 'scheduledFor muss in der Zukunft liegen' })
      }
      
    } else if (scheduleType === 'cron') {
      if (!cronExpression) {
        return res.status(400).json({ error: 'cronExpression erforderlich für cron-Typ' })
      }
      try {
        nextRunAt = CronExpressionParser.parse(cronExpression, { currentDate: new Date(), tz: selectedTimezone }).next().toDate()
      } catch {
        return res.status(400).json({ error: 'Ungültiger Cron-Ausdruck' })
      }
      
    } else if (['daily', 'weekly', 'monthly'].includes(scheduleType)) {
      if (!repeat?.time) {
        return res.status(400).json({ error: 'repeat.time erforderlich für wiederkehrende Nachrichten' })
      }
      nextRunAt = calculateNextRun(scheduleType, repeat, selectedTimezone)
    }

    // Erstelle geplante Nachricht
    const scheduled = new ScheduledMessage({
      botId,
      conversationId,
      message: message.trim(),
      scheduleType,
      scheduledFor: scheduleType === 'once' ? scheduledFor : undefined,
      cronExpression,
      timezone: selectedTimezone,
      repeat: repeat || { enabled: false },
      status: 'pending',
      nextRunAt,
      createdBy: userId
    })

    await scheduled.save()

    console.log(`⏰ [BOT-SCHEDULER] Created scheduled message ${scheduled._id} for bot ${botId}`)

    res.json({
      success: true,
      message: 'Timer-Nachricht erstellt',
      scheduled: {
        id: scheduled._id,
        nextRunAt: scheduled.nextRunAt,
        scheduleType: scheduled.scheduleType
      }
    })
  } catch (error) {
    console.error('❌ [BOT-SCHEDULER] Schedule message error:', error)
    res.status(500).json({ error: 'Fehler beim Erstellen der Timer-Nachricht' })
  }
})

// GET /api/bot-scheduler/bot/:botId - Alle geplanten Nachrichten eines Bots
router.get('/bot/:botId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { botId } = req.params
    const userId = (req as any).userId

    // Prüfe Berechtigung
    const bot = await Bot.findOne({ botId, ownerId: userId })  // ← GEÄNDERT: ownerId
    if (!bot) {
      return res.status(404).json({ error: 'Bot nicht gefunden' })
    }

    const scheduled = await ScheduledMessage.find({ 
      botId,
      status: 'pending'  // ← Nur aktive Timer zeigen, nicht sent/failed/cancelled
    })
      .sort({ nextRunAt: 1 })

    res.json({
      success: true,
      scheduled,
      count: scheduled.length
    })
  } catch (error) {
    console.error('❌ [BOT-SCHEDULER] Get scheduled messages error:', error)
    res.status(500).json({ error: 'Fehler beim Laden' })
  }
})

// DELETE /api/bot-scheduler/:id - Timer-Nachricht löschen
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const userId = (req as any).userId

    const scheduled = await ScheduledMessage.findById(id)
    if (!scheduled) {
      return res.status(404).json({ error: 'Nicht gefunden' })
    }

    // Prüfe Berechtigung
    const bot = await Bot.findOne({ botId: scheduled.botId, ownerId: userId })  // ← GEÄNDERT: ownerId
    if (!bot) {
      return res.status(403).json({ error: 'Keine Berechtigung' })
    }

    await ScheduledMessage.findByIdAndDelete(id)

    res.json({
      success: true,
      message: 'Timer-Nachricht gelöscht'
    })
  } catch (error) {
    console.error('❌ [BOT-SCHEDULER] Cancel scheduled message error:', error)
    res.status(500).json({ error: 'Fehler beim Abbrechen' })
  }
})

// PATCH /api/bot-scheduler/:id - Timer bearbeiten (Nachricht & Zeit)
router.patch('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { message, scheduledFor, scheduleType, repeat } = req.body
    const userId = (req as any).userId

    // 1. Timer finden
    const scheduled = await ScheduledMessage.findById(id)
    if (!scheduled) {
      return res.status(404).json({ error: 'Timer nicht gefunden' })
    }

    // 2. Berechtigung prüfen
    const bot = await Bot.findOne({ botId: scheduled.botId, ownerId: userId })
    if (!bot) {
      return res.status(403).json({ error: 'Keine Berechtigung' })
    }

    // 3. Prüfe ob Timer noch pending ist
    if (scheduled.status !== 'pending') {
      return res.status(400).json({ error: 'Kann nur pending Timer bearbeiten' })
    }

    // 4. Update Nachricht
    if (message !== undefined) {
      scheduled.message = message.trim()
    }

    // 5. Update Schedule Type
    if (scheduleType && scheduleType !== scheduled.scheduleType) {
      scheduled.scheduleType = scheduleType
    }

    // 6. Update Zeit/Repeat
    if (scheduledFor !== undefined && scheduled.scheduleType === 'once') {
      const newTime = new Date(scheduledFor)
      if (newTime <= new Date()) {
        return res.status(400).json({ error: 'scheduledFor muss in der Zukunft liegen' })
      }
      scheduled.scheduledFor = newTime
      scheduled.nextRunAt = newTime
    }

    if (repeat !== undefined && ['daily', 'weekly', 'monthly'].includes(scheduled.scheduleType || '')) {
      scheduled.repeat = repeat
      // Berechne neue nextRunAt
      scheduled.nextRunAt = calculateNextRun(scheduled.scheduleType!, repeat, scheduled.timezone || 'Europe/Berlin')
    }

    await scheduled.save()

    console.log(`✏️ [BOT-SCHEDULER] Timer ${id} updated`)

    res.json({
      success: true,
      message: 'Timer aktualisiert',
      scheduled: {
        id: scheduled._id,
        message: scheduled.message,
        scheduleType: scheduled.scheduleType,
        nextRunAt: scheduled.nextRunAt,
        scheduledFor: scheduled.scheduledFor,
        repeat: scheduled.repeat
      }
    })

  } catch (error) {
    console.error('❌ [BOT-SCHEDULER] Update error:', error)
    res.status(500).json({ error: 'Fehler beim Aktualisieren' })
  }
})

// GET /api/bot-scheduler/:id - Einzelnen Timer abrufen
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const userId = (req as any).userId

    const scheduled = await ScheduledMessage.findById(id)
    if (!scheduled) {
      return res.status(404).json({ error: 'Timer nicht gefunden' })
    }

    // Berechtigung prüfen
    const bot = await Bot.findOne({ botId: scheduled.botId, ownerId: userId })
    if (!bot) {
      return res.status(403).json({ error: 'Keine Berechtigung' })
    }

    res.json({
      success: true,
      scheduled
    })

  } catch (error) {
    console.error('❌ [BOT-SCHEDULER] Get timer error:', error)
    res.status(500).json({ error: 'Fehler beim Laden' })
  }
})

// Helper: Berechne nächste Ausführung
function calculateNextRun(type: string, repeat: any, timezone: string): Date {
  const [hours, minutes] = String(repeat.time || '').split(':').map(Number)
  if (!Number.isInteger(hours) || hours < 0 || hours > 23 || !Number.isInteger(minutes) || minutes < 0 || minutes > 59) {
    throw new Error('Ungültige Uhrzeit')
  }
  const dayOfWeek = Number(repeat.dayOfWeek ?? 0)
  const dayOfMonth = Number(repeat.dayOfMonth ?? 1)
  if (type === 'weekly' && (dayOfWeek < 0 || dayOfWeek > 6)) throw new Error('Ungültiger Wochentag')
  if (type === 'monthly' && (dayOfMonth < 1 || dayOfMonth > 31)) throw new Error('Ungültiger Monatstag')
  const expression = type === 'daily'
    ? `${minutes} ${hours} * * *`
    : type === 'weekly'
      ? `${minutes} ${hours} * * ${dayOfWeek}`
      : `${minutes} ${hours} ${dayOfMonth} * *`
  return CronExpressionParser.parse(expression, { currentDate: new Date(), tz: timezone }).next().toDate()
}

export default router
