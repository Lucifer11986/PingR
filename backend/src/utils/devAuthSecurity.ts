import crypto from 'crypto'

export const normalizeDevEmail = (value: unknown) => String(value || '').trim().toLowerCase()
export const validDevEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
export const validDevUsername = (username: string) => /^[a-zA-Z0-9_]{3,30}$/.test(username)
export const validDevPassword = (password: string) => password.length >= 10 && password.length <= 200
export const hashSecret = (value: string) => crypto.createHash('sha256').update(value).digest('hex')
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url')

export function safeReturnPath(value: unknown, fallback = '/dev-login'): string {
  const path = String(value || '')
  return path.startsWith('/') && !path.startsWith('//') ? path : fallback
}
