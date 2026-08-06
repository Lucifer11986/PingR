import { Schema, model, Document, Types } from 'mongoose'

export interface ILoginHistory extends Document {
  userId:    Types.ObjectId
  ipAddress: string
  device:    string
  os:        string
  browser:   string
  timestamp: Date
  success:   boolean
}

const LoginHistorySchema = new Schema<ILoginHistory>({
  userId:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
  ipAddress: { type: String },
  device:    { type: String },
  os:        { type: String },
  browser:   { type: String },
  // TTL: automatische Löschung nach 90 Tagen (DSGVO-konform)
  timestamp: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 90 },
  success:   { type: Boolean, default: true },
}, { timestamps: false })

LoginHistorySchema.index({ userId: 1, timestamp: -1 })

export const LoginHistory = model<ILoginHistory>('LoginHistory', LoginHistorySchema)
export default LoginHistory