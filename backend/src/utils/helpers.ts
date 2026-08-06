import crypto from 'crypto'
import { User } from './userRef'

export function generateToken(length = 32): string {
  return crypto.randomBytes(length).toString('hex')
}

export async function generateUIN(): Promise<string> {
  let uin = ''
  let exists = true
  while (exists) {
    const length = Math.random() < 0.5 ? 8 : 9
    const min = Math.pow(10, length - 1)
    const max = Math.pow(10, length) - 1
    uin = (Math.floor(Math.random() * (max - min + 1)) + min).toString()
    const found = await User.findOne({ uin })
    exists = !!found
  }
  return uin
}