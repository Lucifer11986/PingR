import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET!
const REFRESH_SECRET = process.env.REFRESH_SECRET!

if (!JWT_SECRET || !REFRESH_SECRET) {
  throw new Error('JWT Secrets fehlen in .env')
}

export function signAccessToken(payload: object) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '15m',
    issuer: 'pingr-api'
  })
}

export function signRefreshToken(payload: object) {
  return jwt.sign(payload, REFRESH_SECRET, {
    expiresIn: '7d',
    issuer: 'pingr-api'
  })
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, JWT_SECRET)
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, REFRESH_SECRET)
}