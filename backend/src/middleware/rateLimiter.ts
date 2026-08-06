/**
 * Rate Limiter – Schutz gegen Spam und Cybermobbing
 * Begrenzt die Anzahl von Nachrichten pro User pro Zeitfenster
 */
import { Response, NextFunction } from 'express'
import { AuthRequest } from './auth'

// In-Memory Store (in Produktion: Redis nutzen)
const messageCount = new Map<string, { count: number; resetAt: number }>()

const MAX_MESSAGES_PER_MINUTE = 30   // Max Nachrichten pro Minute
const MAX_MESSAGES_PER_SECOND = 3    // Max Nachrichten pro Sekunde (Burst-Schutz)

const burstCount = new Map<string, { count: number; resetAt: number }>()

export function messageLimiter(req: AuthRequest, res: Response, next: NextFunction): void {
  const userId = req.userId
  if (!userId) { next(); return }

  const now = Date.now()

  // ── Burst-Schutz (pro Sekunde) ──
  const burst = burstCount.get(userId)
  if (!burst || now > burst.resetAt) {
    burstCount.set(userId, { count: 1, resetAt: now + 1000 })
  } else {
    burst.count++
    if (burst.count > MAX_MESSAGES_PER_SECOND) {
      res.status(429).json({
        error: 'Bitte etwas langsamer. Du sendest zu viele Nachrichten auf einmal.',
        retryAfter: Math.ceil((burst.resetAt - now) / 1000),
      })
      return
    }
  }

  // ── Minuten-Limit ──
  const entry = messageCount.get(userId)
  if (!entry || now > entry.resetAt) {
    messageCount.set(userId, { count: 1, resetAt: now + 60000 })
  } else {
    entry.count++
    if (entry.count > MAX_MESSAGES_PER_MINUTE) {
      res.status(429).json({
        error: `Du hast das Nachrichtenlimit (${MAX_MESSAGES_PER_MINUTE}/min) erreicht. Bitte warte kurz.`,
        retryAfter: Math.ceil((entry.resetAt - now) / 1000),
      })
      return
    }
  }

  next()
}

// Cleanup alter Einträge alle 5 Minuten
setInterval(() => {
  const now = Date.now()
  messageCount.forEach((v, k) => { if (now > v.resetAt) messageCount.delete(k) })
  burstCount.forEach((v, k) => { if (now > v.resetAt) burstCount.delete(k) })
}, 5 * 60 * 1000)