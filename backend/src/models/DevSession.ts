import mongoose, { Schema, Document } from 'mongoose'

export interface IDevSession extends Document {
  userId: mongoose.Types.ObjectId
  tokenHash: string
  expiresAt: Date
  createdAt: Date
  lastUsedAt: Date
  userAgent?: string
  ip?: string
}

const DevSessionSchema = new Schema<IDevSession>({
  userId:     { type: Schema.Types.ObjectId, ref: 'DevUser', required: true, index: true },
  tokenHash:  { type: String, required: true, unique: true, select: false },
  expiresAt:  { type: Date, required: true, index: { expires: 0 } },
  createdAt:  { type: Date, default: Date.now },
  lastUsedAt: { type: Date, default: Date.now },
  userAgent:  { type: String, maxlength: 500 },
  ip:         { type: String, maxlength: 100 },
})

export default mongoose.model<IDevSession>('DevSession', DevSessionSchema)
