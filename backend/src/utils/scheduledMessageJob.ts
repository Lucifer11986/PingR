/**
 * Job der alle 30 Sekunden prüft ob geplante Nachrichten gesendet werden sollen
 */
import { ScheduledMessage } from '../models/ScheduledMessage'
import { Message } from '../models/Message'
import { Conversation } from '../models/Conversation'
import { getIO } from '../socket/socketServer'
import { PUBLIC_USER_FIELDS } from './userFields'

export function startScheduledMessageJob(): void {
  setInterval(async () => {
    try {
      const due = await ScheduledMessage.find({
        sent:         false,
        scheduledFor: { $lte: new Date() },
      }).limit(20)

      for (const scheduled of due) {
        // Nachricht erstellen
        const message = await Message.create({
          conversationId: scheduled.conversationId,
          sender:         scheduled.sender,
          content:        scheduled.content,
          type:           scheduled.type || 'text',
          readBy:         [scheduled.sender],
        })

        const populated = await message.populate([
          { path: 'sender', select: PUBLIC_USER_FIELDS },
        ])

        await Conversation.findByIdAndUpdate(
          scheduled.conversationId,
          { lastMessage: message._id, updatedAt: new Date() }
        )

        getIO().to(`conv:${scheduled.conversationId}`).emit('new_message', populated)

        // Als gesendet markieren
        scheduled.sent = true
        await scheduled.save()

        console.log(`✅ Geplante Nachricht gesendet: ${scheduled._id}`)
      }
    } catch (err) {
      console.error('Scheduled message job error:', err)
    }
  }, 30 * 1000) // alle 30 Sekunden

  console.log('✅ Geplante-Nachrichten-Job gestartet')
}

/**
 * Job der stündlich leere Gruppen löscht
 */
export function startGroupCleanupJob(): void {
  const run = async () => {
    try {
      const { Conversation } = await import('../models/Conversation')
      // Gruppen mit 0 Mitgliedern löschen
      const deleted = await Conversation.deleteMany({
        isGroup: true,
        $or: [
          { participants: { $size: 0 } },
          { participants: { $exists: true, $eq: [] } },
        ]
      })
      if (deleted.deletedCount > 0) {
        console.log(`[Cleanup] ${deleted.deletedCount} leere Gruppe(n) gelöscht`)
      }
    } catch (err) {
      console.error('[GroupCleanup] Fehler:', err)
    }
  }
  run() // Einmal beim Start
  setInterval(run, 60 * 60 * 1000) // Stündlich
}
