import { Schema, model, Document, Types } from 'mongoose'

export interface IReaction {
  emoji:    string
  userId:   Types.ObjectId
  username: string
}

export interface IMessage extends Document {
  conversationId: Types.ObjectId
  sender:         Types.ObjectId
  content:        string
  type:           'text' | 'image' | 'file' | 'voice'
  fileUrl?:       string
  fileName?:      string
  duration?:      number
  expiresAt?:     Date
  deliverAt?:     Date        // ⏳ Zeitkapsel: erst ab diesem Zeitpunkt zugestellt
  delivered:      boolean     // Wurde bereits zugestellt?
  edited:         boolean
  editedAt?:      Date
  deleted:        boolean
  flagged:        boolean
  replyTo?:       Types.ObjectId
  readBy:         Types.ObjectId[]
  seenSilently:   Types.ObjectId[]
  reactions:      IReaction[]
  botId?:         string
  botName?:       string
  isBotMessage?:  boolean
  isTestMessage?: boolean
  createdAt:      Date
}

const MessageSchema = new Schema<IMessage>({
  conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
  sender:         { type: Schema.Types.ObjectId, ref: 'User', required: true },
  content:        { type: String, default: '' },
  type:           { type: String, enum: ['text', 'image', 'file', 'voice'], default: 'text' },
  fileUrl:        { type: String },
  fileName:       { type: String },
  duration:       { type: Number },
  expiresAt:      { type: Date, index: { expireAfterSeconds: 0 } },
  deliverAt:      { type: Date, index: true },   // Index für effizienten Cron-Job
  delivered:      { type: Boolean, default: true }, // false = Zeitkapsel noch ausstehend
  edited:         { type: Boolean, default: false },
  editedAt:       { type: Date },
  deleted:        { type: Boolean, default: false },
  flagged:        { type: Boolean, default: false },
  replyTo:        { type: Schema.Types.ObjectId, ref: 'Message' },
  readBy:         [{ type: Schema.Types.ObjectId, ref: 'User' }],
  seenSilently:   [{ type: Schema.Types.ObjectId, ref: 'User' }],
  reactions: [{
    emoji:    { type: String, required: true },
    userId:   { type: Schema.Types.ObjectId, ref: 'User' },
    username: { type: String },
  }],
  botId:         { type: String, index: true },
  botName:       { type: String, maxlength: 40 },
  isBotMessage:  { type: Boolean, default: false },
  isTestMessage: { type: Boolean, default: false },
}, { timestamps: true })

MessageSchema.index({ conversationId: 1, createdAt: 1 })

const Message = model<IMessage>('Message', MessageSchema)
export { Message }
export default Message
