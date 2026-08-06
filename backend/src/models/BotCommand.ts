import { Schema, model, Document, Types } from 'mongoose'

export enum BotPermission {
  READ_MESSAGES = 1 << 0,      // 1
  SEND_MESSAGES = 1 << 1,      // 2
  MANAGE_MESSAGES = 1 << 2,    // 4
  MANAGE_MEMBERS = 1 << 3,     // 8
  MANAGE_CHANNELS = 1 << 4,    // 16
  ADMINISTRATOR = 1 << 5       // 32
}

export interface ICommandOption {
  name: string
  type: 'string' | 'number' | 'user' | 'role' | 'channel' | 'boolean'
  description: string
  required: boolean
  choices?: { name: string, value: any }[]
  default?: any
}

export interface IBotCommand extends Document {
  commandId: string
  name: string
  description: string
  category: 'moderation' | 'fun' | 'utility' | 'admin'
  requiredPermissions: number[]
  requiredRoles?: string[]
  options: ICommandOption[]
  interactive?: boolean
  cooldown?: number
  allowedChannels?: string[]
  enabled: boolean
  usageCount: number
  createdAt: Date
}

const CommandOptionSchema = new Schema<ICommandOption>({
  name: { type: String, required: true },
  type: { type: String, enum: ['string', 'number', 'user', 'role', 'channel', 'boolean'], required: true },
  description: { type: String, required: true },
  required: { type: Boolean, default: false },
  choices: [{
    name: String,
    value: Schema.Types.Mixed
  }],
  default: { type: Schema.Types.Mixed }
}, { _id: false })

const BotCommandSchema = new Schema<IBotCommand>({
  commandId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, enum: ['moderation', 'fun', 'utility', 'admin'], required: true },
  requiredPermissions: [{ type: Number }],
  requiredRoles: [{ type: String }],
  options: [CommandOptionSchema],
  interactive: { type: Boolean, default: false },
  cooldown: { type: Number, default: 0 },
  allowedChannels: [{ type: String }],
  enabled: { type: Boolean, default: true },
  usageCount: { type: Number, default: 0 }
}, { timestamps: true })

BotCommandSchema.index({ category: 1, enabled: 1 })
BotCommandSchema.index({ name: 1 })

const BotCommand = model<IBotCommand>('BotCommand', BotCommandSchema)
export { BotCommand }
export default BotCommand
