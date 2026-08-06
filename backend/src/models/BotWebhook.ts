import { Schema, model, Document } from 'mongoose'

export enum WebhookEvent {
  MESSAGE_CREATE = 'message.create',
  MESSAGE_DELETE = 'message.delete',
  MESSAGE_EDIT = 'message.edit',
  
  MEMBER_JOIN = 'member.join',
  MEMBER_LEAVE = 'member.leave',
  MEMBER_KICK = 'member.kick',
  MEMBER_BAN = 'member.ban',
  
  COMMAND_EXECUTE = 'command.execute',
  
  GIVEAWAY_START = 'giveaway.start',
  GIVEAWAY_END = 'giveaway.end',
  GIVEAWAY_PARTICIPANT = 'giveaway.participant',
  
  // Später:
  CHANNEL_CREATE = 'channel.create',
  CHANNEL_DELETE = 'channel.delete',
  ROLE_ASSIGN = 'role.assign'
}

export interface IWebhookRetryConfig {
  maxRetries: number
  backoff: 'linear' | 'exponential'
}

export interface IWebhookStats {
  totalCalls: number
  successCalls: number
  failedCalls: number
  lastSuccess?: Date
  lastFailure?: Date
  lastError?: string
}

export interface IBotWebhook extends Document {
  webhookId: string
  botId: string
  url: string
  secret: string
  events: WebhookEvent[]
  active: boolean
  retryConfig: IWebhookRetryConfig
  stats: IWebhookStats
  createdAt: Date
  updatedAt: Date
}

const BotWebhookSchema = new Schema<IBotWebhook>({
  webhookId: {
    type: String,
    required: true,
    unique: true,
    default: () => `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  },
  botId: { type: String, required: true, index: true },
  url: { type: String, required: true },
  secret: { type: String, required: true },
  events: [{
    type: String,
    enum: Object.values(WebhookEvent)
  }],
  active: { type: Boolean, default: true },
  retryConfig: {
    maxRetries: { type: Number, default: 3 },
    backoff: { type: String, enum: ['linear', 'exponential'], default: 'exponential' }
  },
  stats: {
    totalCalls: { type: Number, default: 0 },
    successCalls: { type: Number, default: 0 },
    failedCalls: { type: Number, default: 0 },
    lastSuccess: { type: Date },
    lastFailure: { type: Date },
    lastError: { type: String }
  }
}, { timestamps: true })

BotWebhookSchema.index({ botId: 1, active: 1 })

const BotWebhook = model<IBotWebhook>('BotWebhook', BotWebhookSchema)
export { BotWebhook }
export default BotWebhook
