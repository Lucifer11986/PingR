import { Request, Response, NextFunction } from 'express'
import jwt, { JwtPayload } from 'jsonwebtoken'
import { logSecurityEvent } from '../utils/logger'

export interface AuthRequest extends Request {
  userId?:          string
  token?:           string
  activeIdentityId?: string
}

export interface JWTPayload extends JwtPayload {
  userId: string
  activeIdentityId?: string
}

// ── ENV Helper (fail fast) ───────────────────────────────────────────────────
function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    console.error(`❌ ENV fehlt: ${name}`)
    process.exit(1)
  }
  return value
}

const JWT_SECRET = requireEnv('JWT_SECRET')

// ── Middleware ───────────────────────────────────────────────────────────────
export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization

  if (!header || !header.startsWith('Bearer ')) {
    // ✅ LOGGING: Auth Fail
    logSecurityEvent({
      type: 'auth_fail',
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      details: { reason: 'Missing or invalid Authorization header' }
    })
    res.status(401).json({ error: 'Nicht autorisiert' })
    return
  }

  const token = header.split(' ')[1]

  try {
    // ✅ CHECK: Token Blacklist (Redis)
    const { getRedis } = require('../utils/redis')
    const blacklisted = await getRedis().get(`blacklist:${token}`)
    if (blacklisted) {
      logSecurityEvent({
        type: 'auth_fail',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        details: { reason: 'Token blacklisted' }
      })
      res.status(401).json({ error: 'Token wurde invalidiert' })
      return
    }

    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: 'nokki-api',
    }) as JWTPayload

    // 🔥 Payload prüfen (kein blindes Vertrauen)
    if (
      !decoded ||
      typeof decoded !== 'object' ||
      typeof decoded.userId !== 'string'
    ) {
      logSecurityEvent({
        type: 'auth_fail',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        details: { reason: 'Invalid JWT payload' }
      })
      res.status(401).json({ error: 'Ungültiger Token' })
      return
    }

    req.userId = decoded.userId
    req.token  = token

    // 🔒 SECURITY FIX: Identity IMMER aus JWT
    if (decoded.activeIdentityId) {
      // ✅ JWT hat Identity → das ist führend
      try {
        const { Identity } = require('../models/Identity')
        
        // Doppelte Validierung: Identity gehört dem User
        const identity = await Identity.findOne({
          _id: decoded.activeIdentityId,
          userId: decoded.userId
        }).lean()

        if (!identity) {
          // JWT hat ungültige Identity (gelöschte Identity o.ä.)
          logSecurityEvent({
            type: 'identity_spoofing_attempt',
            userId: decoded.userId,
            identityId: decoded.activeIdentityId,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            details: { reason: 'JWT contains invalid identity' }
          })
          
          // Fallback: Lade aktive Identity
          const fallbackIdent = await Identity.findOne({ 
            userId: decoded.userId, 
            isActive: true 
          }).lean()
          
          if (fallbackIdent) {
            req.activeIdentityId = fallbackIdent._id.toString()
          }
        } else {
          req.activeIdentityId = identity._id.toString()
        }
      } catch (e) {
        console.error('Identity validation error:', e)
      }
    } else {
      // Legacy-JWT ohne Identity → Fallback
      try {
        const { Identity } = require('../models/Identity')
        const ident = await Identity.findOne({ 
          userId: decoded.userId, 
          isActive: true 
        }).lean()
        
        if (ident) {
          req.activeIdentityId = ident._id.toString()
        }
      } catch (_e) { 
        console.error('Legacy identity loading error:', _e)
      }
    }

    next()
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      logSecurityEvent({
        type: 'auth_fail',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        details: { reason: 'Token expired' }
      })
      res.status(401).json({ error: 'Token abgelaufen' })
      return
    }

    logSecurityEvent({
      type: 'auth_fail',
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      details: { reason: 'Token invalid', error: (err as Error).message }
    })
    res.status(401).json({ error: 'Token ungültig' })
  }
}

export function uploadAccessMiddleware(req: Request, res: Response, next: NextFunction): void {
  try {
    const cookies = String(req.headers.cookie || '').split(';')
    const entry = cookies.find(cookie => cookie.trim().startsWith('nokki_upload_access='))
    const token = entry ? decodeURIComponent(entry.trim().slice('nokki_upload_access='.length)) : ''
    if (!token) { res.status(401).json({ error: 'Dateizugriff erfordert eine Anmeldung' }); return }
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'], issuer: 'nokki-api' }) as JWTPayload
    if (!decoded.userId) { res.status(401).json({ error: 'Ungültiger Dateizugriff' }); return }
    next()
  } catch (_error) {
    res.status(401).json({ error: 'Dateizugriff abgelaufen' })
  }
}

// ── Helper: JWT erstellen mit Identity ───────────────────────────────────────
export function createJWT(userId: string, activeIdentityId?: string, extra: Record<string, unknown> = {}): string {
  const payload: JWTPayload = {
    ...extra,
    userId,
    activeIdentityId,
  }

  return jwt.sign(payload, JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: '1h',
    issuer: 'nokki-api',
  })
}

// ── Helper: Token invalidieren ───────────────────────────────────────────────
export async function invalidateToken(token: string): Promise<void> {
  try {
    const decoded = jwt.decode(token) as JWTPayload
    if (!decoded?.exp) return
    
    const ttl = decoded.exp - Math.floor(Date.now() / 1000)
    if (ttl > 0) {
      const { getRedis } = require('../utils/redis')
      await getRedis().setex(`blacklist:${token}`, ttl, '1')
      
      logSecurityEvent({
        type: 'token_invalidated',
        userId: decoded.userId,
        identityId: decoded.activeIdentityId,
        details: { ttl }
      })
    }
  } catch (e) {
    console.error('Token invalidation error:', e)
  }
}
