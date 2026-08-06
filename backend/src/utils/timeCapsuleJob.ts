// ⏳ Zeitkapsel-Job — läuft jede Minute und stellt fällige Nachrichten zu
import { Message } from '../models/Message'
import { Conversation } from '../models/Conversation'
import { getIO } from '../socket/socketServer'
import { PUBLIC_USER_FIELDS } from './userFields'

export async function deliverTimeCapsules(): Promise<void> {
  try {
    const now = new Date()

    // Alle Zeitkapsel-Nachrichten finden die fällig und noch nicht zugestellt sind
    const pending = await Message.find({
      deliverAt:  { $lte: now },
      delivered:  false,
      deleted:    false,
    }).populate('sender', PUBLIC_USER_FIELDS).populate('replyTo')

    if (pending.length === 0) return

    console.log(`[TimeCapsule] ${pending.length} Nachricht(en) werden jetzt zugestellt`)

    for (const message of pending) {
      // Als zugestellt markieren
      message.delivered = true
      await message.save()

      // Conversation updaten
      await Conversation.findByIdAndUpdate(
        message.conversationId,
        { lastMessage: message._id, updatedAt: new Date() }
      )

      // Per WebSocket in Echtzeit senden
      getIO()
        .to(`conv:${message.conversationId}`)
        .emit('new_message', message)

      // Optional: Browser-Push Benachrichtigung auslösen
      getIO()
        .to(`conv:${message.conversationId}`)
        .emit('time_capsule_delivered', {
          messageId:      message._id,
          conversationId: message.conversationId,
          senderName:     (message.sender as any).username,
        })
    }
  } catch (err) {
    console.error('[TimeCapsule] Fehler:', err)
  }
}

// Cron-Job starten (jede Minute)
export function startTimeCapsuleJob(): void {
  console.log('[TimeCapsule] Job gestartet — prüft jede Minute')
  setInterval(deliverTimeCapsules, 60 * 1000)
  // Auch direkt beim Start einmal prüfen
  deliverTimeCapsules()
}
