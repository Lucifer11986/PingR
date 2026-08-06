import { Schema, model, Document } from 'mongoose'

export interface IBotAnalytics extends Document {
  botId: string
  date: Date
  
  // Message Stats
  messagesSent: number
  messagesDeleted: number
  messagesEdited: number
  
  // Command Stats
  commandsExecuted: number
  commandsByType: Record<string, number>
  
  // API Stats
  apiCalls: number
  webhookCalls: number
  webhookFailures: number
  
  // Interaction Stats
  activeConversations: number
  activeUsers: number
  
  // Giveaway Stats
  giveawaysCreated: number
  giveawayParticipants: number
  
  createdAt: Date
}

const BotAnalyticsSchema = new Schema<IBotAnalytics>({
  botId: { type: String, required: true, index: true },
  date: { type: Date, required: true, index: true },
  
  messagesSent: { type: Number, default: 0 },
  messagesDeleted: { type: Number, default: 0 },
  messagesEdited: { type: Number, default: 0 },
  
  commandsExecuted: { type: Number, default: 0 },
  commandsByType: { type: Map, of: Number, default: {} },
  
  apiCalls: { type: Number, default: 0 },
  webhookCalls: { type: Number, default: 0 },
  webhookFailures: { type: Number, default: 0 },
  
  activeConversations: { type: Number, default: 0 },
  activeUsers: { type: Number, default: 0 },
  
  giveawaysCreated: { type: Number, default: 0 },
  giveawayParticipants: { type: Number, default: 0 }
}, { timestamps: true })

BotAnalyticsSchema.index({ botId: 1, date: 1 }, { unique: true })

const BotAnalytics = model<IBotAnalytics>('BotAnalytics', BotAnalyticsSchema)
export { BotAnalytics }
export default BotAnalytics

// ========================================
// COMMAND USAGE TRACKING
// ========================================

export interface IBotCommandUsage extends Document {
  commandId: string
  botId: string
  conversationId: string
  channelId?: string
  userId: string
  executedAt: Date
  success: boolean
  errorMessage?: string
  executionTime: number
}

const BotCommandUsageSchema = new Schema<IBotCommandUsage>({
  commandId: { type: String, required: true, index: true },
  botId: { type: String, required: true, index: true },
  conversationId: { type: String, required: true },
  channelId: { type: String },
  userId: { type: String, required: true },
  executedAt: { type: Date, default: Date.now, index: true },
  success: { type: Boolean, default: true },
  errorMessage: { type: String },
  executionTime: { type: Number }
}, { timestamps: false })

BotCommandUsageSchema.index({ botId: 1, executedAt: -1 })
BotCommandUsageSchema.index({ commandId: 1, executedAt: -1 })

const BotCommandUsage = model<IBotCommandUsage>('BotCommandUsage', BotCommandUsageSchema)
export { BotCommandUsage }