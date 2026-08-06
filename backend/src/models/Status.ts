import mongoose, { Schema, Document } from 'mongoose'

export interface IStatus extends Document {
  userId:     mongoose.Types.ObjectId
  type:       'image' | 'video' | 'text'
  mediaUrl?:  string
  text?:      string
  color?:     string
  duration?:  number        // Video-Länge in Sekunden
  viewers:    mongoose.Types.ObjectId[]
  expiresAt:  Date
  createdAt:  Date
}

const StatusSchema = new Schema<IStatus>({
  userId:    { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type:      { type: String, enum: ['image', 'video', 'text'], required: true },
  mediaUrl:  { type: String },
  text:      { type: String, maxlength: 200 },
  color:     { type: String, default: 'linear-gradient(135deg,#b46a0e,#e8b86d)' },
  duration:  { type: Number },
  viewers:   [{ type: Schema.Types.ObjectId, ref: 'User' }],
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
}, { timestamps: true })

export const Status = mongoose.model<IStatus>('Status', StatusSchema)