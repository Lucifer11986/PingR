import Conversation from '../models/Conversation'
import { Channel } from '../models/Channel'

export type BotTarget =
  | { kind: 'conversation'; document: any }
  | { kind: 'channel'; document: any }

export async function findBotTarget(targetId: string): Promise<BotTarget | null> {
  const conversation = await Conversation.findById(targetId).catch(() => null)
  if (conversation) return { kind: 'conversation', document: conversation }

  const channel = await Channel.findById(targetId).catch(() => null)
  if (channel) return { kind: 'channel', document: channel }
  return null
}

const ids = (values: any[] = []) => values.map(value => value?.toString()).filter(Boolean)

export function canViewBotTarget(target: BotTarget, userId: string): boolean {
  const doc = target.document
  if (target.kind === 'channel') {
    return doc.isPublic || doc.owner?.toString() === userId || ids(doc.admins).includes(userId) || ids(doc.subscribers).includes(userId)
  }
  return ids(doc.participants).includes(userId) || ids(doc.admins).includes(userId)
}

export function canManageBotTarget(target: BotTarget, userId: string): boolean {
  const doc = target.document
  if (target.kind === 'channel') {
    return doc.owner?.toString() === userId || ids(doc.admins).includes(userId)
  }
  return ids(doc.admins).includes(userId)
}

export async function addBotToTarget(target: BotTarget, botObjectId: any): Promise<void> {
  if (target.kind !== 'conversation') return
  const existing = ids(target.document.bots)
  if (!existing.includes(botObjectId.toString())) {
    target.document.bots = [...(target.document.bots || []), botObjectId]
    await target.document.save()
  }
}

export async function removeBotFromTarget(target: BotTarget, botObjectId: any): Promise<void> {
  if (target.kind !== 'conversation') return
  target.document.bots = (target.document.bots || []).filter((id: any) => id.toString() !== botObjectId.toString())
  await target.document.save()
}
