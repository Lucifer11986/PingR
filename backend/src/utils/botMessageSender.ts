import crypto from 'crypto'
import bcrypt from 'bcrypt'
import { User } from '../models/User'

export async function getBotSystemUserId(): Promise<any> {
  const existing = await User.findOne({ username: 'nokki_system' }).select('_id')
  if (existing) return existing._id

  const password = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12)
  const user = await User.findOneAndUpdate(
    { email: 'system-bot@nokki.local' },
    { $setOnInsert: {
      uin: `9${Date.now().toString().slice(-8)}`,
      username: 'nokki_system',
      email: 'system-bot@nokki.local',
      password,
      status: 'offline',
      emailVerified: true,
    } },
    { upsert: true, new: true }
  )
  return user._id
}
