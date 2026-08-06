import BotAnalytics, { BotCommandUsage } from '../models/BotAnalytics'

/**
 * Track Bot Action in Daily Analytics
 */
export async function trackBotAnalytics(
  botId: string,
  metric: keyof Omit<any, 'botId' | 'date' | 'createdAt' | '_id' | '__v'>,
  value: number = 1
): Promise<void> {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const update: any = {}
    update[`$inc`] = { [metric]: value }

    await BotAnalytics.findOneAndUpdate(
      { botId, date: today },
      update,
      { upsert: true, new: true }
    )

  } catch (error) {
    console.error('❌ [ANALYTICS] Track error:', error)
  }
}

/**
 * Track Command Usage
 */
export async function trackCommandUsage(
  commandId: string,
  botId: string,
  conversationId: string,
  userId: string,
  success: boolean,
  executionTime: number,
  errorMessage?: string
): Promise<void> {
  try {
    // Track in command usage log
    await BotCommandUsage.create({
      commandId,
      botId,
      conversationId,
      userId,
      success,
      executionTime,
      errorMessage
    })

    // Track in daily analytics
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    await BotAnalytics.findOneAndUpdate(
      { botId, date: today },
      {
        $inc: {
          commandsExecuted: 1,
          [`commandsByType.${commandId}`]: 1
        }
      },
      { upsert: true }
    )

    console.log(`📊 [ANALYTICS] Command tracked: ${commandId} (${success ? 'success' : 'failed'})`)

  } catch (error) {
    console.error('❌ [ANALYTICS] Command tracking error:', error)
  }
}

/**
 * Track Message Action
 */
export async function trackMessageAction(
  botId: string,
  action: 'sent' | 'deleted' | 'edited'
): Promise<void> {
  const metricMap = {
    sent: 'messagesSent',
    deleted: 'messagesDeleted',
    edited: 'messagesEdited'
  }

  await trackBotAnalytics(botId, metricMap[action] as any)
}

/**
 * Track API Call
 */
export async function trackApiCall(botId: string): Promise<void> {
  await trackBotAnalytics(botId, 'apiCalls')
}

/**
 * Get Bot Analytics für Zeitraum
 */
export async function getBotAnalytics(
  botId: string,
  days: number = 30
): Promise<any> {
  try {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    startDate.setHours(0, 0, 0, 0)

    const analytics = await BotAnalytics.find({
      botId,
      date: { $gte: startDate }
    }).sort({ date: 1 })

    // Aggregate totals
    const totals = {
      messagesSent: 0,
      messagesDeleted: 0,
      messagesEdited: 0,
      commandsExecuted: 0,
      apiCalls: 0,
      webhookCalls: 0,
      webhookFailures: 0,
      giveawaysCreated: 0,
      giveawayParticipants: 0
    }

    const commandsByType: Record<string, number> = {}

    analytics.forEach(day => {
      totals.messagesSent += day.messagesSent
      totals.messagesDeleted += day.messagesDeleted
      totals.messagesEdited += day.messagesEdited
      totals.commandsExecuted += day.commandsExecuted
      totals.apiCalls += day.apiCalls
      totals.webhookCalls += day.webhookCalls
      totals.webhookFailures += day.webhookFailures
      totals.giveawaysCreated += day.giveawaysCreated
      totals.giveawayParticipants += day.giveawayParticipants

      // Aggregate commands
      if (day.commandsByType) {
        const cmdMap = day.commandsByType instanceof Map 
          ? Object.fromEntries(day.commandsByType) 
          : day.commandsByType

        Object.entries(cmdMap).forEach(([cmd, count]) => {
          commandsByType[cmd] = (commandsByType[cmd] || 0) + (count as number)
        })
      }
    })

    return {
      period: { days, startDate },
      totals,
      commandsByType,
      timeline: analytics.map(day => ({
        date: day.date,
        messagesSent: day.messagesSent,
        commandsExecuted: day.commandsExecuted,
        apiCalls: day.apiCalls
      }))
    }

  } catch (error) {
    console.error('❌ [ANALYTICS] Get analytics error:', error)
    throw error
  }
}

/**
 * Get Command Usage Stats
 */
export async function getCommandUsageStats(
  botId: string,
  commandId?: string,
  days: number = 30
): Promise<any> {
  try {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const query: any = { botId, executedAt: { $gte: startDate } }
    if (commandId) {
      query.commandId = commandId
    }

    const usages = await BotCommandUsage.find(query).sort({ executedAt: -1 })

    const stats = {
      total: usages.length,
      successful: usages.filter(u => u.success).length,
      failed: usages.filter(u => !u.success).length,
      avgExecutionTime: usages.length > 0 
        ? usages.reduce((sum, u) => sum + (u.executionTime || 0), 0) / usages.length 
        : 0,
      recentUsages: usages.slice(0, 20)
    }

    return stats

  } catch (error) {
    console.error('❌ [ANALYTICS] Command usage stats error:', error)
    throw error
  }
}