import { BotPermission } from '../models/BotCommand'

export const DEFAULT_BOT_PERMISSIONS = BotPermission.READ_MESSAGES | BotPermission.SEND_MESSAGES

export function hasBotPermission(bitfield: number, permission: BotPermission): boolean {
  return (bitfield & BotPermission.ADMINISTRATOR) === BotPermission.ADMINISTRATOR
    || (bitfield & permission) === permission
}

const PERMISSIONS: Record<string, BotPermission> = {
  READ_MESSAGES: BotPermission.READ_MESSAGES,
  SEND_MESSAGES: BotPermission.SEND_MESSAGES,
  MANAGE_MESSAGES: BotPermission.MANAGE_MESSAGES,
  MANAGE_MEMBERS: BotPermission.MANAGE_MEMBERS,
  MANAGE_CHANNELS: BotPermission.MANAGE_CHANNELS,
  ADMINISTRATOR: BotPermission.ADMINISTRATOR,
}

export function permissionsToBitfield(value: unknown): number {
  if (!Array.isArray(value)) return DEFAULT_BOT_PERMISSIONS
  const bitfield = value.reduce((sum, item) => sum | (PERMISSIONS[String(item).toUpperCase()] || 0), 0)
  return bitfield || DEFAULT_BOT_PERMISSIONS
}
