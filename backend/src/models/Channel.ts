import { Schema, model, Document, Types } from 'mongoose'

export interface IChannel extends Document {
  name:          string
  handle:        string          // @handle — unique
  description?:  string
  avatar?:       string
  owner:         Types.ObjectId  // erstellt von
  admins:        Types.ObjectId[]
  subscribers:   Types.ObjectId[] // abonniert von
  isPublic:      boolean
  verified:      boolean
  slowMode:      number
  lastMessage?:  Types.ObjectId
  unreadCounts:  Record<string, number>
  createdAt:     Date
  updatedAt:     Date
}

const ChannelSchema = new Schema<IChannel>({
  name:        { type: String, required: true, trim: true, maxlength: 64 },
  handle:      { type: String, required: true, unique: true, trim: true, lowercase: true, match: /^[a-z0-9_]{3,32}$/ },
  description: { type: String, maxlength: 300, default: '' },
  avatar:      { type: String },
  owner:       { type: Schema.Types.ObjectId, ref: 'User', required: true },
  admins:      [{ type: Schema.Types.ObjectId, ref: 'User' }],
  subscribers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  isPublic:    { type: Boolean, default: true },
  verified:    { type: Boolean, default: false },
  slowMode:    { type: Number, default: 0 },
  lastMessage: { type: Schema.Types.ObjectId, ref: 'Message' },
  unreadCounts:{ type: Map, of: Number, default: {} },
}, { timestamps: true })

// Index für Handle-Suche
ChannelSchema.index({ handle: 1 })
ChannelSchema.index({ name: 'text', handle: 'text', description: 'text' })

const Channel = model<IChannel>('Channel', ChannelSchema)
export { Channel }
export default Channel