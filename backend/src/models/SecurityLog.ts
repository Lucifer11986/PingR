import { Schema, model, Document, Types } from 'mongoose'

export type SecurityEventType =
  | 'csam' | 'extremism' | 'terrorism' | 'flagged_review' | 'auto_blocked'

export interface ISecurityLog extends Document {
  userId:           Types.ObjectId
  userUIN:          string
  userEmail:        string
  username:         string
  ipAddress?:       string
  userAgent?:       string
  // 🆕 Gerätedaten
  deviceType?:      string   // mobile / desktop / tablet
  deviceOS?:        string   // Windows 10, Android 14, iOS 17...
  deviceBrowser?:   string   // Chrome, Firefox, Safari...
  deviceSummary?:   string   // Zusammenfassung für Behörden
  eventType:        SecurityEventType
  legalBasis:       string
  attemptedContent: string
  contentHash:      string
  conversationId?:  string
  messageId?:       string
  timestamp:        Date
  autoDetected:     boolean
  reportedToBka:    boolean
  reportedAt?:      Date
  reportReference?: string
  notes?:           string
  reportPackage?:   string
}

const SecurityLogSchema = new Schema<ISecurityLog>({
  userId:          { type: Schema.Types.ObjectId, ref: 'User', required: true },
  userUIN:         { type: String, required: true },
  userEmail:       { type: String, required: true },
  username:        { type: String, required: true },
  ipAddress:       { type: String },
  userAgent:       { type: String },
  deviceType:      { type: String },
  deviceOS:        { type: String },
  deviceBrowser:   { type: String },
  deviceSummary:   { type: String },
  eventType:       { type: String, enum: ['csam','extremism','terrorism','flagged_review','auto_blocked'], required: true },
  legalBasis:      { type: String, required: true },
  attemptedContent:{ type: String, required: true },
  contentHash:     { type: String, required: true },
  conversationId:  { type: String },
  messageId:       { type: String },
  timestamp:       { type: Date, default: Date.now, required: true },
  autoDetected:    { type: Boolean, default: true },
  reportedToBka:   { type: Boolean, default: false },
  reportedAt:      { type: Date },
  reportReference: { type: String },
  notes:           { type: String },
  reportPackage:   { type: String },
}, { timestamps: true })

SecurityLogSchema.index({ userId: 1, timestamp: -1 })
SecurityLogSchema.index({ eventType: 1, reportedToBka: 1 })

const SecurityLog = model<ISecurityLog>('SecurityLog', SecurityLogSchema)
export { SecurityLog }
export default SecurityLog