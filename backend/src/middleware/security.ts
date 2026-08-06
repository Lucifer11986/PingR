import { Request, Response, NextFunction } from 'express'

// ── Utility: Prüfen ob Objekt ────────────────────────────────────────────────
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// ── Rekursive Key-Sanitization (KRITISCH für Mongo) ──────────────────────────
function sanitizeObject(obj: unknown, depth = 0): unknown {
  if (depth > 10) return obj

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, depth + 1))
  }

  if (isObject(obj)) {
    const sanitized: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(obj)) {
      // 🔥 WICHTIG: verhindert NoSQL Injection
      if (key.startsWith('$') || key.includes('.')) continue

      sanitized[key] = sanitizeObject(value, depth + 1)
    }

    return sanitized
  }

  return obj
}

// ── Middleware: Request Sanitization ─────────────────────────────────────────
export function sanitizeInput(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body)
  }

  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query) as any
  }

  next()
}

// ── Security Headers (minimal + sinnvoll) ────────────────────────────────────
export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '0')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=()')

  // CSP bewusst restriktiv, aber noch praktikabel
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self'", // KEIN unsafe-inline mehr
      "style-src 'self' 'unsafe-inline'", // CSS oft nötig
      "img-src 'self' data: blob:",
      "connect-src 'self' ws: wss:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'"
    ].join('; ')
  )

  next()
}

// ── Rate Limiter (einfach, aber effektiv) ────────────────────────────────────
const requests = new Map<string, { count: number; last: number }>()

export function rateLimit(max = 100, windowMs = 60_000) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown'
    const now = Date.now()

    const entry = requests.get(ip) || { count: 0, last: now }

    if (now - entry.last > windowMs) {
      entry.count = 0
      entry.last = now
    }

    entry.count++
    requests.set(ip, entry)

    if (entry.count > max) {
      res.status(429).json({ error: 'Too many requests' })
      return
    }

    next()
  }
}

// ── Admin Secret Check ───────────────────────────────────────────────────────
export function validateAdminSecret(req: Request, res: Response, next: NextFunction): void {
  const secret = req.headers['x-admin-secret']

  if (!process.env.ADMIN_SECRET || process.env.ADMIN_SECRET.length < 12) {
    console.warn('⚠️ ADMIN_SECRET unsicher oder nicht gesetzt')
  }

  if (!secret || secret !== process.env.ADMIN_SECRET) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }

  next()
}

// ── Payload Size Check ───────────────────────────────────────────────────────
export function checkPayloadSize(maxKB = 500) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const len = Number(req.headers['content-length'] || 0)

    if (len > maxKB * 1024) {
      res.status(413).json({ error: 'Payload too large' })
      return
    }

    next()
  }
}
