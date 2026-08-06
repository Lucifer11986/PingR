import { Schema, model, Document, Types } from 'mongoose'

export interface IUser extends Document {
  uin:                  string
  username:             string
  email:                string
  password:             string
  avatar?:              string
  bio?:                 string
  status:               'online' | 'away' | 'offline'
  statusMessage?:       string
  statusExpiresAt?:     Date
  lastSeen:             Date
  lastDevice?:          string
  lastIP?:              string
  blockedUsers:         Types.ObjectId[]   // 🆕 Blockierte User
  bookmarks:            Types.ObjectId[]   // 🆕 Lesezeichen (Message IDs)
  privacyShowStatus:    'everyone' | 'contacts' | 'nobody'
  privacyShowLastSeen:  'everyone' | 'contacts' | 'nobody'
  privacyShowAvatar:    'everyone' | 'contacts' | 'nobody'
  resetToken?:          string
  resetTokenExpires?:   Date
  isBanned:             boolean
  bannedReason?:        string
  warningCount:         number
  reportCount:          number
  emailVerified?:        boolean
  e2ePublicKey?:         string  // ECDH public key für E2E
  emailVerifyToken?:     string
  emailVerifyExpires?:   Date
  twoFactorEnabled?:    boolean
  twoFactorSecret?:     string
  twoFactorBackup?:     string[]
  timezone?:            string   // z.B. 'Europe/Berlin'
  availability?: {              // Verfügbarkeitsfenster
    enabled:   boolean
    days:      number[]         // 0=So, 1=Mo, ..., 6=Sa
    startTime: string           // 'HH:MM'
    endTime:   string           // 'HH:MM'
    message?:  string           // Nachricht wenn nicht verfügbar
  }
  customSounds?:        any[]
  createdAt:            Date
  legacyUin?:           string   // Beanspruchte ICQ-UIN
  legacyVerified?:      boolean  // Wurde verifiziert (E-Mail oder Screenshot)
  legacyMethod?:        string   // 'email' | 'screenshot' | 'firstcome'
  legacyReserved?:      boolean  // Unter Vorbehalt (firstcome) — kann überschrieben werden
  // ── Admin-Rollen ──────────────────────────────────────────────────────────
  adminRole?:           'superadmin' | 'moderator' | 'support' | 'analyst' | null
  adminInviteToken?:    string   // Einladungstoken für Admin-Zugang
  adminInviteExpires?:  Date
  adminInvitedBy?:      string   // userId des Einladenden
  adminActiveAt?:       Date     // Letzter Admin-Login
  // ── Multi-Identitäten ────────────────────────────────────────────────────
  activeIdentityId?: Types.ObjectId  // Aktive Identität
  identityCount?:    number          // Anzahl Identitäten
  // ── Fake-PIN / Schein-Account ─────────────────────────────────────────────
  fakePin?:           string         // Gehashter Fake-PIN (6-stellig)
  fakeUsername?:      string         // Angezeigter Name im Schein-Account
  fakeStatusMessage?: string         // Status-Nachricht im Schein-Account
}

const UserSchema = new Schema<IUser>({
  uin:               { type: String, required: true, unique: true },
  username:          { type: String, required: true, trim: true, minlength: 1, maxlength: 30 },
  email:             { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:          { type: String, required: true, minlength: 6 },
  avatar:            { type: String },
  bio:               { type: String, maxlength: 200, default: '' },
  status:            { type: String, enum: ['online','away','offline'], default: 'offline' },
  statusMessage:     { type: String, maxlength: 100 },
  statusExpiresAt:   { type: Date },
  lastSeen:          { type: Date, default: Date.now },
  lastDevice:        { type: String },
  lastIP:            { type: String },
  blockedUsers:      [{ type: Schema.Types.ObjectId, ref: 'User' }],
  bookmarks:         [{ type: Schema.Types.ObjectId, ref: 'Message' }],
  privacyShowStatus:   { type: String, enum: ['everyone','contacts','nobody'], default: 'everyone' },
  privacyShowLastSeen: { type: String, enum: ['everyone','contacts','nobody'], default: 'everyone' },
  privacyShowAvatar:   { type: String, enum: ['everyone','contacts','nobody'], default: 'everyone' },
  resetToken:         { type: String },
  resetTokenExpires:  { type: Date },
  isBanned:           { type: Boolean, default: false },
  bannedReason:       { type: String },
  warningCount:       { type: Number, default: 0 },
  reportCount:        { type: Number, default: 0 },
  emailVerified:      { type: Boolean, default: false },
  e2ePublicKey:       { type: String },
  emailVerifyToken:   { type: String },
  emailVerifyExpires: { type: Date },
  twoFactorEnabled:   { type: Boolean, default: false },
  twoFactorSecret:    { type: String },
  twoFactorBackup:    [{ type: String }],
  timezone:           { type: String, default: 'Europe/Berlin' },
  availability: {
    enabled:   { type: Boolean, default: false },
    days:      [{ type: Number }],
    startTime: { type: String, default: '09:00' },
    endTime:   { type: String, default: '22:00' },
    message:   { type: String, default: '' },
  },
  customSounds:       { type: Schema.Types.Mixed, default: [] },
  legacyUin:          { type: String },
  legacyVerified:     { type: Boolean, default: false },
  legacyMethod:       { type: String },
  legacyReserved:     { type: Boolean, default: false },
  // ── Admin-Rollen ──────────────────────────────────────────────────────────
  adminRole:          { type: String, enum: ['superadmin','moderator','support','analyst'], default: null },
  adminInviteToken:   { type: String },
  adminInviteExpires: { type: Date },
  adminInvitedBy:     { type: String },
  adminActiveAt:      { type: Date },
  activeIdentityId:   { type: Schema.Types.ObjectId, ref: 'Identity' },
  identityCount:      { type: Number, default: 0 },
  // ── Fake-PIN / Schein-Account ─────────────────────────────────────────────
  fakePin:            { type: String },
  fakeUsername:       { type: String },
  fakeStatusMessage:  { type: String },
}, { timestamps: true, strict: false })

const User = model<IUser>('User', UserSchema)
export { User }
export default User