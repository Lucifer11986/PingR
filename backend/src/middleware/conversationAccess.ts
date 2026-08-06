import { Types } from 'mongoose'
import { Conversation } from '../models/Conversation'
import ConversationMember from '../models/ConversationMember'

export async function isConversationMember(conversationId: unknown, userId: unknown): Promise<boolean> {
  const conversation = String(conversationId || '')
  const user = String(userId || '')
  if (!Types.ObjectId.isValid(conversation) || !Types.ObjectId.isValid(user)) return false

  const directMember = await Conversation.exists({ _id: conversation, participants: user })
  if (directMember) return true

  const extendedMember = await ConversationMember.exists({
    conversationId: conversation,
    userId: user,
    isActive: true,
  })
  return !!extendedMember
}

export async function canAccessMessageConversation(messageId: unknown, userId: unknown): Promise<boolean> {
  const { Message } = await import('../models/Message')
  if (!Types.ObjectId.isValid(String(messageId || ''))) return false
  const message = await Message.findById(messageId).select('conversationId').lean()
  return !!message && isConversationMember(message.conversationId, userId)
}
