import { Schema, model, Document, Types } from 'mongoose'

export interface IScheduledMessage extends Document {
  sender?:        Types.ObjectId  // Optional für Bot-Timer
  conversationId: Types.ObjectId | string  // String für Bot-Timer
  content?:       string          // Optional für Bot-Timer (haben "message")
  message?:       string          // NEU: Für Bot-Timer
  type:           string
  scheduledFor:   Date
  sent:           boolean
  createdAt:      Date
  // 🤖 BOT FEATURES
  botId?:         string
  scheduleType?:  'once' | 'daily' | 'weekly' | 'monthly' | 'cron'
  cronExpression?: string
  timezone?:      string
  repeat?:        {
    enabled:      boolean
    interval:     'daily' | 'weekly' | 'monthly'
    dayOfWeek?:   number
    dayOfMonth?:  number
    time:         string
  }
  status?:        'pending' | 'sent' | 'failed' | 'cancelled'
  lastSentAt?:    Date
  nextRunAt?:     Date
  failureReason?: string
  createdBy?:     Types.ObjectId
}

const ScheduledMessageSchema = new Schema<IScheduledMessage>({
  sender: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: false  // ← GEÄNDERT: Optional für Bot-Timer
  },
  conversationId: { 
    type: Schema.Types.Mixed,  // ← GEÄNDERT: Mixed für ObjectId oder String
    required: true 
  },
  content: { 
    type: String, 
    required: false  // ← GEÄNDERT: Optional für Bot-Timer
  },
  message: {  // ← NEU: Für Bot-Timer
    type: String,
    required: false
  },
  type: { type: String, default: 'text' },
  scheduledFor: { type: Date, required: false },
  sent: { type: Boolean, default: false },
  
  // 🤖 BOT FEATURES
  botId: {
    type: String,
    index: true
  },
  scheduleType: {
    type: String,
    enum: ['once', 'daily', 'weekly', 'monthly', 'cron']
  },
  cronExpression: {
    type: String
  },
  timezone: {
    type: String,
    default: 'Europe/Berlin'
  },
  repeat: {
    enabled: { type: Boolean, default: false },
    interval: { type: String, enum: ['daily', 'weekly', 'monthly'] },
    dayOfWeek: { type: Number, min: 0, max: 6 },
    dayOfMonth: { type: Number, min: 1, max: 31 },
    time: { type: String }
  },
  status: {
    type: String,
    enum: ['pending', 'sent', 'failed', 'cancelled'],
    default: 'pending',
    index: true
  },
  lastSentAt: {
    type: Date
  },
  nextRunAt: {
    type: Date,
    index: true
  },
  failureReason: {
    type: String
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true })

// Custom Validation: Entweder (sender + content) ODER (botId + message)
ScheduledMessageSchema.pre('validate', function(next) {
  if (this.botId) {
    // Bot-Timer: message required
    if (!this.message) {
      this.invalidate('message', 'message is required for bot scheduled messages')
    }
  } else {
    // User scheduled message: sender + content required
    if (!this.sender) {
      this.invalidate('sender', 'sender is required for user scheduled messages')
    }
    if (!this.content) {
      this.invalidate('content', 'content is required for user scheduled messages')
    }
  }
  next()
})

// Indizes für Performance
ScheduledMessageSchema.index({ botId: 1, status: 1, nextRunAt: 1 })
ScheduledMessageSchema.index({ conversationId: 1, status: 1 })
ScheduledMessageSchema.index({ scheduledFor: 1, sent: 1 })

const ScheduledMessage = model<IScheduledMessage>('ScheduledMessage', ScheduledMessageSchema)
export { ScheduledMessage }
export default ScheduledMessage