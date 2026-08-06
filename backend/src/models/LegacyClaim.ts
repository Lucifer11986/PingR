import { Schema, model, Document, Types } from 'mongoose'

export interface ILegacyClaim extends Document {
  userId:          Types.ObjectId   // PingR-User der den Claim stellt
  requestedUin:    string           // Die beanspruchte ICQ-UIN
  proofType:       'email' | 'screenshot' | 'firstcome'
  proofEmail?:     string           // E-Mail die damals mit ICQ verknüpft war
  proofScreenshot?: string          // Pfad zum hochgeladenen Screenshot
  emailToken?:     string           // Verifizierungstoken für E-Mail-Methode
  emailTokenExp?:  Date
  status:          'pending' | 'email_sent' | 'approved' | 'rejected' | 'expired'
  adminNote?:      string           // Admin-Kommentar bei Ablehnung
  reviewedBy?:     string           // Admin der bearbeitet hat
  reviewedAt?:     Date
  createdAt:       Date
}

const LegacyClaimSchema = new Schema<ILegacyClaim>({
  userId:           { type: Schema.Types.ObjectId, ref: 'User', required: true },
  requestedUin:     { type: String, required: true, index: true },
  proofType:        { type: String, enum: ['email','screenshot','firstcome'], required: true },
  proofEmail:       { type: String },
  proofScreenshot:  { type: String },
  emailToken:       { type: String, index: true },
  emailTokenExp:    { type: Date },
  status:           { type: String, enum: ['pending','email_sent','approved','rejected','expired'], default: 'pending' },
  adminNote:        { type: String },
  reviewedBy:       { type: String },
  reviewedAt:       { type: Date },
}, { timestamps: true })

// Index damit pro UIN nur ein aktiver Claim existiert
LegacyClaimSchema.index({ requestedUin: 1, status: 1 })
LegacyClaimSchema.index({ userId: 1 })

export const LegacyClaim = model<ILegacyClaim>('LegacyClaim', LegacyClaimSchema)
export default LegacyClaim