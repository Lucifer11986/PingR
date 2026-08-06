import cron, { ScheduledTask } from 'node-cron'
import ScheduledMessage from '../models/ScheduledMessage'
import Message from '../models/Message'
import Bot from '../models/Bot'
import { getIO } from '../socket/socketServer'
import { getBotSystemUserId } from '../utils/botMessageSender'
import { CronExpressionParser } from 'cron-parser'

let cronJob: ScheduledTask | null = null

/**
 * STARTET DEN SCHEDULER
 * Läuft jede Minute: '* * * * *'
 */
export function startScheduledMessagesJob() {
  console.log('🔧 [SCHEDULER] startScheduledMessagesJob() wurde aufgerufen!')
  
  if (cronJob) {
    console.log('⚠️  [SCHEDULER] Job läuft bereits')
    return
  }

  console.log('🔧 [SCHEDULER] Erstelle Cron Job...')
  
  try {
    // Cron Pattern: '* * * * *' = jede Minute
    // Format: Minute Stunde Tag Monat Wochentag
    cronJob = cron.schedule('* * * * *', async () => {
      try {
        const now = new Date()
        
        // Finde alle fälligen Nachrichten
        const dueMessages = await ScheduledMessage.find({
          status: 'pending',
          nextRunAt: { $lte: now }  // Kleiner oder gleich JETZT
        }).limit(50) // Max 50 pro Minute zur Sicherheit

        if (dueMessages.length === 0) {
          // Keine fälligen Nachrichten - still bleiben
          return
        }

        console.log(`⏰ [SCHEDULER] ${dueMessages.length} fällige Nachrichten gefunden`)

        // Verarbeite jede Nachricht
        for (const scheduled of dueMessages) {
          try {
            await processScheduledMessage(scheduled)
          } catch (error) {
            console.error(`❌ [SCHEDULER] Fehler bei ${scheduled._id}:`, error)
            
            // Markiere als failed
            scheduled.status = 'failed'
            scheduled.failureReason = error instanceof Error ? error.message : 'Unbekannter Fehler'
            await scheduled.save()
          }
        }
      } catch (error) {
        console.error('❌ [SCHEDULER] Job-Fehler:', error)
      }
    })

    console.log('✅ [SCHEDULER] Gestartet - läuft jede Minute')
  } catch (error) {
    console.error('❌ [SCHEDULER] Fehler beim Erstellen:', error)
  }
}

/**
 * STOPPT DEN SCHEDULER
 */
export function stopScheduledMessagesJob() {
  if (cronJob) {
    cronJob.stop()
    cronJob = null
    console.log('🛑 [SCHEDULER] Gestoppt')
  }
}

/**
 * VERARBEITET EINE EINZELNE GEPLANTE NACHRICHT
 */
async function processScheduledMessage(scheduled: any) {
  // 1. Hole Bot Details
  const bot = await Bot.findOne({ botId: scheduled.botId })
  if (!bot) {
    throw new Error(`Bot ${scheduled.botId} nicht gefunden`)
  }

  // 2. Erstelle Message in DB
  const message = new Message({
    content: scheduled.message || scheduled.content, // Support beide Feldnamen
    sender: await getBotSystemUserId(),
    conversationId: scheduled.conversationId,
    type: 'text',
    botId: bot.botId,
    botName: bot.name,
    isBotMessage: true,
    isTestMessage: false  // Timer-Nachrichten sind KEINE Test-Nachrichten
  })

  await message.save()

  // 3. Populate sender für Socket Event
  await message.populate('sender')

  // 4. Sende via Socket.IO zu allen Usern im Chat
  const io = getIO()
  io.to(`conv:${scheduled.conversationId}`).emit('new_message', message)

  console.log(`✅ [SCHEDULER] Message ${message._id} von Bot ${scheduled.botId} gesendet`)

  // 5. Update scheduled message
  scheduled.lastSentAt = new Date()

  // 6. Wenn wiederkehrend, berechne nächste Ausführung
  if (scheduled.scheduleType === 'cron' || (scheduled.scheduleType !== 'once' && scheduled.repeat?.enabled)) {
    scheduled.nextRunAt = calculateNextRun(scheduled)
    scheduled.status = 'pending'  // Bleibt pending für nächste Ausführung
    console.log(`🔁 [SCHEDULER] Nächste Ausführung: ${scheduled.nextRunAt.toISOString()}`)
  } else {
    // Einmalig - setze auf "sent"
    scheduled.status = 'sent'
    console.log(`✅ [SCHEDULER] Einmalige Nachricht abgeschlossen`)
  }

  await scheduled.save()
}

/**
 * BERECHNET NÄCHSTE AUSFÜHRUNGSZEIT FÜR WIEDERKEHRENDE NACHRICHTEN
 */
function calculateNextRun(scheduled: any): Date {
  const now = new Date()
  const timezone = scheduled.timezone || 'Europe/Berlin'
  if (scheduled.scheduleType === 'cron') {
    return CronExpressionParser.parse(scheduled.cronExpression, { currentDate: now, tz: timezone }).next().toDate()
  }
  const [hours, minutes] = (scheduled.repeat?.time || '09:00').split(':').map(Number)
  const expression = scheduled.scheduleType === 'daily'
    ? `${minutes} ${hours} * * *`
    : scheduled.scheduleType === 'weekly'
      ? `${minutes} ${hours} * * ${scheduled.repeat?.dayOfWeek ?? 0}`
      : `${minutes} ${hours} ${scheduled.repeat?.dayOfMonth ?? 1} * *`
  return CronExpressionParser.parse(expression, { currentDate: now, tz: timezone }).next().toDate()
}
