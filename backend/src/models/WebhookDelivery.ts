import { Schema, model, Document, Types } from 'mongoose'

export interface IWebhookDeliveryAttempt {
  attempt: number
  startedAt: Date
  completedAt: Date
  durationMs: number
  httpStatus?: number
  error?: string
}

export interface IWebhookDelivery extends Document {
  webhookId: Types.ObjectId
  botId: string
  event: string
  url: string
  status: 'pending' | 'success' | 'failed'
  payloadEncrypted: string
  attempts: IWebhookDeliveryAttempt[]
  replayOf?: Types.ObjectId
  completedAt?: Date
  createdAt: Date
}

const WebhookDeliverySchema = new Schema<IWebhookDelivery>({
  webhookId: { type: Schema.Types.ObjectId, ref: 'BotWebhook', required: true, index: true },
  botId: { type: String, required: true, index: true },
  event: { type: String, required: true, maxlength: 100 },
  url: { type: String, required: true, maxlength: 2048 },
  status: { type: String, enum: ['pending', 'success', 'failed'], default: 'pending', index: true },
  payloadEncrypted: { type: String, required: true, select: false },
  attempts: [{
    attempt: { type: Number, required: true },
    startedAt: { type: Date, required: true },
    completedAt: { type: Date, required: true },
    durationMs: { type: Number, required: true },
    httpStatus: { type: Number },
    error: { type: String, maxlength: 1000 },
  }],
  replayOf: { type: Schema.Types.ObjectId, ref: 'WebhookDelivery' },
  completedAt: { type: Date },
}, { timestamps: { createdAt: true, updatedAt: false } })

WebhookDeliverySchema.index({ webhookId: 1, createdAt: -1 })
WebhookDeliverySchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 })

export default model<IWebhookDelivery>('WebhookDelivery', WebhookDeliverySchema)
