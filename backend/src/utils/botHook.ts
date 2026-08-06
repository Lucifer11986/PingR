import { processBotMessage } from './botEngine'

interface HookMessage {
  _id: string
  content: string
  conversationId: string
  senderId: string
  senderName: string
  type?: string
}

export async function triggerBotHook(msg: HookMessage) {
  if (msg.type === 'bot' || msg.type === 'system') return
  if (!msg.content?.trim()) return
  setImmediate(async () => {
    try {
      await processBotMessage(msg)
    } catch (err) {
      console.error('[BotHook] Fehler:', err)
    }
  })
}
