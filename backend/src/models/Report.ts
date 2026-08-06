import { Schema, model, Document, Types } from 'mongoose'

export interface IReport extends Document {
  reporter:         Types.ObjectId
  reportedUser?:    Types.ObjectId
  reportedMessage?: Types.ObjectId
  reportedGroup?:   Types.ObjectId
  reason:           string
  description?:     string
  autoDetected:     boolean
  status:           'open' | 'dismissed' | 'resolved'
  createdAt:        Date
  updatedAt:        Date
}

const ReportSchema = new Schema<IReport>({
  reporter:         { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  reportedUser:     { type: Schema.Types.ObjectId, ref: 'User' },
  reportedMessage:  { type: Schema.Types.ObjectId, ref: 'Message' },
  reportedGroup:    { type: Schema.Types.ObjectId, ref: 'Conversation' },
  reason:           { type: String, required: true, trim: true, maxlength: 200 },
  description:      { type: String, default: '', maxlength: 2000 },
  autoDetected:     { type: Boolean, default: false },
  status:           { type: String, enum: ['open', 'dismissed', 'resolved'], default: 'open', index: true },
}, { timestamps: true })

export const Report = model<IReport>('Report', ReportSchema)
export default Report
