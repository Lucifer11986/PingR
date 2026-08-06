import mongoose, { Document, Schema } from 'mongoose'

export interface IConversationMember extends Document {
  conversationId: mongoose.Types.ObjectId
  userId: mongoose.Types.ObjectId
  roles: string[]  // ['admin', 'moderator', 'event-manager', 'member']
  joinedAt: Date
  leftAt?: Date
  isActive: boolean
}

const ConversationMemberSchema = new Schema<IConversationMember>({
  conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  roles: [{ type: String, enum: ['owner', 'admin', 'moderator', 'event-manager', 'member'], default: ['member'] }],
  joinedAt: { type: Date, default: Date.now },
  leftAt: { type: Date },
  isActive: { type: Boolean, default: true }
}, { timestamps: true })

// Compound Index: Ein User kann nur einmal Member pro Conversation sein
ConversationMemberSchema.index({ conversationId: 1, userId: 1 }, { unique: true })

// Index für schnelle Rollen-Abfragen
ConversationMemberSchema.index({ conversationId: 1, roles: 1 })

export default mongoose.model<IConversationMember>('ConversationMember', ConversationMemberSchema)