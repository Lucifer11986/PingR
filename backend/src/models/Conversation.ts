import { Schema, model, Document, Types } from 'mongoose'

export interface IConversation extends Document {
  participants:      Types.ObjectId[]   // userId-basiert (Legacy)
  identityParticipants?: Types.ObjectId[] // identityId-basiert (neu)
  isGroup:       boolean
  groupName?:    string
  groupAvatar?:    string
  pinnedMessages?:  string[]
  isPublic?:     boolean
  joinCode?:     string
  admins?:       Types.ObjectId[]
  description?:    string
  adminOnly?:      boolean
  slowMode?:       number
  maxMembers?:     number
  requireApproval?: boolean
  muteList?:       { userId: Types.ObjectId; mutedUntil: Date }[]
  // 🤖 BOT SUPPORT
  bots?:         Types.ObjectId[]  // Array of Bot _id references
  lastMessage?:  Types.ObjectId
  unreadCounts:  Record<string, number>
  // 🔒 SICHERHEIT
  screenshotProtection?: boolean   // Screenshot-Sperre aktiv
  createdAt:     Date
  updatedAt:     Date
}

const ConversationSchema = new Schema<IConversation>({
  participants:         [{ type: Schema.Types.ObjectId, ref: 'User' }],
  identityParticipants: [{ type: Schema.Types.ObjectId, ref: 'Identity' }],
  isGroup:       { type: Boolean, default: false },
  groupName:     { type: String },
  groupAvatar:   { type: String },
  isPublic:      { type: Boolean, default: false },
  joinCode:      { type: String, unique: true, sparse: true },
  admins:        [{ type: Schema.Types.ObjectId, ref: 'User' }],
  description:     { type: String, default: '' },
  adminOnly:       { type: Boolean, default: false },
  slowMode:        { type: Number, default: 0 },
  maxMembers:      { type: Number, default: 100 },
  requireApproval: { type: Boolean, default: false },
  muteList:        [{ userId: { type: Schema.Types.ObjectId, ref: 'User' }, mutedUntil: Date }],
  // 🤖 BOT SUPPORT
  bots:          [{ type: Schema.Types.ObjectId, ref: 'Bot' }],
  lastMessage:   { type: Schema.Types.ObjectId, ref: 'Message' },
  unreadCounts:  { type: Map, of: Number, default: {} },
  // 🔒 SICHERHEIT
  screenshotProtection: { type: Boolean, default: false },
}, { timestamps: true })

const Conversation = model<IConversation>('Conversation', ConversationSchema)

export { Conversation }
export default Conversation