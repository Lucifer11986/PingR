import { Request, Response, NextFunction } from 'express'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { User } from '../models/User'

export type AdminRole = 'superadmin' | 'moderator' | 'support' | 'analyst'

export interface AdminRequest extends Request {
  adminRole?: AdminRole
  adminUserId?: string
}

const JWT_SECRET = process.env.JWT_SECRET
const ADMIN_SECRET = process.env.ADMIN_SECRET

if (!JWT_SECRET) throw new Error('JWT_SECRET fehlt')
if (!ADMIN_SECRET) throw new Error('ADMIN_SECRET fehlt')
if (ADMIN_SECRET.length < 32) console.warn('⚠️ ADMIN_SECRET sollte mindestens 32 zufällige Zeichen haben')

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

export const ROLE_PERMISSIONS: Record<AdminRole, string[]> = {
  superadmin: ['*'],
  moderator: ['stats', 'charts', 'users:read', 'users:moderate', 'security:read', 'reports', 'claims', 'broadcast'],
  support: ['stats', 'users:read'],
  analyst: ['stats', 'charts'],
}

export async function adminAuth(req: AdminRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const suppliedSecret = String(req.headers['x-admin-secret'] || '')
    if (suppliedSecret && safeEqual(suppliedSecret, ADMIN_SECRET)) {
      req.adminRole = 'superadmin'
      next()
      return
    }

    const staffToken = String(req.headers['x-staff-token'] || '')
    if (!staffToken) {
      res.status(401).json({ error: 'Keine Admin-Berechtigung' })
      return
    }

    const payload = jwt.verify(staffToken, JWT_SECRET, { algorithms: ['HS256'], issuer: 'nokki-staff' }) as jwt.JwtPayload
    if (typeof payload.userId !== 'string' || payload.purpose !== 'staff') {
      res.status(401).json({ error: 'Ungültiger Staff-Token' })
      return
    }

    const staff = await User.findOne({
      _id: payload.userId,
      adminRole: { $in: ['moderator', 'support', 'analyst'] },
      adminInviteToken: staffToken,
      adminInviteExpires: { $gt: new Date() },
    }).select('adminRole').lean()

    if (!staff?.adminRole) {
      res.status(403).json({ error: 'Staff-Zugang wurde entfernt oder ist abgelaufen' })
      return
    }

    req.adminUserId = payload.userId
    req.adminRole = staff.adminRole as AdminRole
    next()
  } catch (_error) {
    res.status(401).json({ error: 'Authentifizierung fehlgeschlagen' })
  }
}

export function requireAdminPermission(permission: string) {
  return (req: AdminRequest, res: Response, next: NextFunction): void => {
    const role = req.adminRole
    if (!role) {
      res.status(401).json({ error: 'Nicht authentifiziert' })
      return
    }
    const permissions = ROLE_PERMISSIONS[role] || []
    if (!permissions.includes('*') && !permissions.includes(permission)) {
      res.status(403).json({ error: 'Keine Berechtigung für diese Aktion' })
      return
    }
    next()
  }
}

export function adminPermissionForRequest(req: AdminRequest, res: Response, next: NextFunction): void {
  const method = req.method.toUpperCase()
  const path = req.path
  let permission = 'superadmin'

  if (path === '/stats' || path === '/activity') permission = 'stats'
  else if (path === '/charts') permission = 'charts'
  else if (method === 'GET' && (/^\/users(?:\/[^/]+\/messages)?$/.test(path) || path === '/registrations')) permission = 'users:read'
  else if (['/ban-user', '/unban-user', '/verify-user'].includes(path)) permission = 'users:moderate'
  else if (method === 'GET' && path === '/security-logs') permission = 'security:read'
  else if (path === '/reports' || path === '/generate-report' || path === '/mark-reported') permission = 'reports'
  else if (path.startsWith('/claims')) permission = 'claims'
  else if (path === '/broadcast') permission = 'broadcast'

  requireAdminPermission(permission)(req, res, next)
}
