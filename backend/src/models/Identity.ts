import { Schema, model, Document, Types } from 'mongoose'

export type IdentityType = 'private' | 'work' | 'anonymous'

export interface IIdentity extends Document {
  userId:       Types.ObjectId   // Gehört zu diesem Account
  type:         IdentityType
  uin:          string            // Eigene UIN für diese Identität
  username:     string
  avatar?:      string
  bio?:         string
  status:       'online' | 'away' | 'offline'
  statusMessage?: string
  isDefault:    boolean           // Standard-Identität (erste wird Default)
  isActive:     boolean           // Aktuell ausgewählt
  // Einstellungen pro Identität
  settings: {
    notifications:  boolean       // Push-Notifications an/aus
    quietHoursFrom?: string       // HH:MM — ab wann stumm
    quietHoursTo?:   string       // HH:MM — bis wann stumm
    autoReply?:      string       // Auto-Antwort Text
    newChatLimit?:   number       // Max neue Chats/Tag (anonym)
  }
  createdAt: Date
}

const IdentitySchema = new Schema<IIdentity>({
  userId:    { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type:      { type: String, enum: ['private','work','anonymous'], required: true },
  uin:       { type: String, required: true, unique: true },
  username:  { type: String, required: true, trim: true, maxlength: 30 },
  avatar:    { type: String },
  bio:       { type: String, maxlength: 200, default: '' },
  status:    { type: String, enum: ['online','away','offline'], default: 'offline' },
  statusMessage: { type: String, maxlength: 100 },
  isDefault: { type: Boolean, default: false },
  isActive:  { type: Boolean, default: false },
  settings: {
    notifications:  { type: Boolean, default: true },
    quietHoursFrom: { type: String },
    quietHoursTo:   { type: String },
    autoReply:      { type: String, maxlength: 200 },
    newChatLimit:   { type: Number, default: 20 },
  },
}, { timestamps: true })

const Identity = model<IIdentity>('Identity', IdentitySchema)
export { Identity }
export default Identity