import mongoose, { Schema, Document } from 'mongoose'

// Unterstützte Plattformen — einfach erweiterbar
export const SUPPORTED_PLATFORMS = [
  { id: 'nokki',     label: 'Nokki',     icon: '💬' },
  { id: 'discord',   label: 'Discord',   icon: '🎮' },
  { id: 'telegram',  label: 'Telegram',  icon: '✈️' },
  { id: 'teamspeak', label: 'TeamSpeak', icon: '🎧' },
  { id: 'slack',     label: 'Slack',     icon: '💼' },
  { id: 'matrix',    label: 'Matrix',    icon: '🔷' },
  { id: 'other',     label: 'Sonstiges', icon: '🤖' },
] as const

export interface IBot extends Document {
  name:            string
  description:     string
  longDescription?: string
  botId:           string
  ownerId:         string
  status:          'active' | 'inactive' | 'pending'
  permissions:     string[]
  platform:        string
  category:        string
  tags:            string[]
  icon:            string
  verified:        boolean
  featured:        boolean
  isNokki:         boolean
  isPublished:     boolean
  reviewStatus?:   'draft' | 'pending' | 'approved' | 'rejected'
  reviewNote?:     string
  commandPrefix:   string
  webhookUrl?:     string
  supportUrl?:     string
  privacyUrl?:     string
  createdAt:       Date
  stats?: {
    totalMessages: number
    apiCalls30d:   number
    messages7d:    number
    lastActive:    string
  }
}

const BotSchema: Schema = new Schema({
  name:            { type: String, required: true, maxlength: 40 },
  description:     { type: String, default: '', maxlength: 160 },
  longDescription: { type: String, default: '', maxlength: 2000 },
  botId:           { type: String, required: true, unique: true },
  ownerId:         { type: Schema.Types.ObjectId, ref: 'DevUser', required: true },
  status:          { type: String, enum: ['active','inactive','pending'], default: 'active' },
  permissions:     [{ type: String }],
  platform:        { type: String, default: 'nokki' },
  category:        { type: String, enum: ['utility','fun','moderation','productivity','games','info','other'], default: 'utility' },
  tags:            [{ type: String }],
  icon:            { type: String, default: '🤖' },
  verified:        { type: Boolean, default: false },
  featured:        { type: Boolean, default: false },
  isNokki:         { type: Boolean, default: false },
  isPublished:     { type: Boolean, default: false },
  reviewStatus:    { type: String, enum: ['draft','pending','approved','rejected'], default: 'draft' },
  reviewNote:      { type: String, maxlength: 500, default: '' },
  commandPrefix:   { type: String, default: '/' },
  webhookUrl:      { type: String },
  supportUrl:      { type: String },
  privacyUrl:      { type: String },
  stats: {
    totalMessages: { type: Number, default: 0 },
    apiCalls30d:   { type: Number, default: 0 },
    messages7d:    { type: Number, default: 0 },
    lastActive:    { type: String, default: 'Nie' },
  },
}, { timestamps: true, strict: false })

const Bot = (mongoose.models.Bot as mongoose.Model<IBot> | undefined)
  || mongoose.model<IBot>('Bot', BotSchema)

export default Bot
