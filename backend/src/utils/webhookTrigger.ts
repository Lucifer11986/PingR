import crypto from 'crypto'
import BotWebhook, { WebhookEvent } from '../models/BotWebhook'
import BotAnalytics from '../models/BotAnalytics'
import { validatePublicWebhookUrl } from './safeWebhookUrl'
import { decryptWebhookSecret } from './webhookSecret'

export interface WebhookPayload {
  event: WebhookEvent
  timestamp: Date
  botId: string
  conversationId: string
  channelId?: string
  data: any
}

/**
 * Berechne HMAC Signature für Webhook Validation
 */
function calculateSignature(payload: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
}

/**
 * Sende Webhook mit Retry Logic
 */
export async function sendWebhook(
  webhook: any,
  payload: WebhookPayload,
  attempt: number = 1
): Promise<{ success: boolean; error?: string }> {
  try {
    const payloadString = JSON.stringify(payload)
    await validatePublicWebhookUrl(webhook.url)
    const signature = calculateSignature(payloadString, decryptWebhookSecret(webhook.secret))

    console.log(`🪝 [WEBHOOK] Sending ${payload.event} to ${webhook.url} (Attempt ${attempt})`)

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Bot-Signature': signature,
        'X-Bot-Event': payload.event,
        'X-Bot-ID': payload.botId,
        'User-Agent': 'Nokki-Bot-Webhook/1.0'
      },
      body: payloadString,
      signal: AbortSignal.timeout(10000),
      redirect: 'error'
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    // Update stats
    webhook.stats.totalCalls += 1
    webhook.stats.successCalls += 1
    webhook.stats.lastSuccess = new Date()
    await webhook.save()

    console.log(`✅ [WEBHOOK] Success: ${payload.event} delivered`)

    return { success: true }

  } catch (error: any) {
    console.error(`❌ [WEBHOOK] Failed (Attempt ${attempt}):`, error.message)

    // Update failure stats
    webhook.stats.totalCalls += 1
    webhook.stats.failedCalls += 1
    webhook.stats.lastFailure = new Date()
    webhook.stats.lastError = error.message
    await webhook.save()

    // Retry logic
    if (attempt < webhook.retryConfig.maxRetries) {
      const delay = webhook.retryConfig.backoff === 'exponential' 
        ? Math.pow(2, attempt) * 1000 
        : attempt * 1000

      console.log(`🔄 [WEBHOOK] Retrying in ${delay}ms...`)
      
      await new Promise(resolve => setTimeout(resolve, delay))
      return sendWebhook(webhook, payload, attempt + 1)
    }

    return { success: false, error: error.message }
  }
}

/**
 * Trigger Webhook für ein bestimmtes Event
 */
export async function triggerWebhook(
  botId: string,
  event: WebhookEvent,
  data: any
): Promise<void> {
  try {
    // Finde alle aktiven Webhooks für diesen Bot & Event
    const webhooks = await BotWebhook.find({
      botId,
      active: true,
      events: event
    })

    if (webhooks.length === 0) {
      console.log(`ℹ️ [WEBHOOK] No webhooks registered for ${event}`)
      return
    }

    console.log(`🪝 [WEBHOOK] Triggering ${webhooks.length} webhook(s) for ${event}`)

    const payload: WebhookPayload = {
      event,
      timestamp: new Date(),
      botId,
      conversationId: data.conversationId || data.channelId,
      channelId: data.channelId,
      data
    }

    // Sende an alle Webhooks parallel (non-blocking)
    const promises = webhooks.map(webhook =>
      sendWebhook(webhook, payload).catch(err => {
        console.error(`❌ [WEBHOOK] Error for ${webhook.url}:`, err)
        return { success: false, error: String(err) }
      })
    )

    const results = await Promise.all(promises)

    // Track in Analytics
    await trackWebhookCall(botId, webhooks.length, results.filter(result => !result.success).length)

  } catch (error) {
    console.error('❌ [WEBHOOK] Trigger error:', error)
  }
}

/**
 * Track Webhook Call in Analytics
 */
async function trackWebhookCall(botId: string, count: number, failures: number): Promise<void> {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    await BotAnalytics.findOneAndUpdate(
      { botId, date: today },
      { $inc: { webhookCalls: count, webhookFailures: failures } },
      { upsert: true }
    )
  } catch (error) {
    console.error('❌ [WEBHOOK] Analytics tracking error:', error)
  }
}

/**
 * Shortcut Functions für häufige Events
 */

export async function triggerMessageEvent(
  botId: string,
  event: 'create' | 'delete' | 'edit',
  message: any
): Promise<void> {
  const eventMap = {
    create: WebhookEvent.MESSAGE_CREATE,
    delete: WebhookEvent.MESSAGE_DELETE,
    edit: WebhookEvent.MESSAGE_EDIT
  }

  await triggerWebhook(botId, eventMap[event], {
    conversationId: message.conversationId,
    message: {
      id: message._id,
      content: message.content,
      sender: {
        id: message.sender._id || message.sender,
        username: message.sender.username || 'Unknown'
      },
      timestamp: message.createdAt
    }
  })
}

export async function triggerMemberEvent(
  botId: string,
  event: 'join' | 'leave' | 'kick' | 'ban',
  conversationId: string,
  user: any,
  reason?: string
): Promise<void> {
  const eventMap = {
    join: WebhookEvent.MEMBER_JOIN,
    leave: WebhookEvent.MEMBER_LEAVE,
    kick: WebhookEvent.MEMBER_KICK,
    ban: WebhookEvent.MEMBER_BAN
  }

  await triggerWebhook(botId, eventMap[event], {
    conversationId,
    user: {
      id: user._id || user,
      username: user.username || 'Unknown'
    },
    reason
  })
}

export async function triggerCommandEvent(
  botId: string,
  conversationId: string,
  command: string,
  args: any,
  user: any
): Promise<void> {
  await triggerWebhook(botId, WebhookEvent.COMMAND_EXECUTE, {
    conversationId,
    command: {
      name: command,
      options: args,
      user: {
        id: user._id || user,
        username: user.username || 'Unknown'
      }
    }
  })
}

export async function triggerGiveawayEvent(
  botId: string,
  event: 'start' | 'end' | 'participant',
  giveaway: any
): Promise<void> {
  const eventMap = {
    start: WebhookEvent.GIVEAWAY_START,
    end: WebhookEvent.GIVEAWAY_END,
    participant: WebhookEvent.GIVEAWAY_PARTICIPANT
  }

  await triggerWebhook(botId, eventMap[event], {
    conversationId: giveaway.conversationId,
    giveaway: {
      id: giveaway._id || giveaway.giveawayId,
      prize: giveaway.prize,
      winner: giveaway.winner,
      participants: giveaway.participants?.length || 0,
      status: giveaway.status
    }
  })
}
