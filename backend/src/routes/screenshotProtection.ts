// /opt/pingr/backend/src/routes/screenshotProtection.ts
import { Router, Response } from 'express'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { Conversation } from '../models/Conversation'

const router = Router()

// PATCH /api/conversations/:id/screenshot-protection
// Schaltet die Screenshot-Sperre für einen Chat an/aus
router.patch('/:id/screenshot-protection', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const conv = await Conversation.findById(req.params.id)
    if (!conv) { res.status(404).json({ error: 'Conversation nicht gefunden' }); return }

    // Nur Teilnehmer dürfen das ändern
    const isParticipant = conv.participants.some(p => p.toString() === req.userId)
    if (!isParticipant) { res.status(403).json({ error: 'Kein Zugriff' }); return }

    const { enabled } = req.body
    await Conversation.findByIdAndUpdate(req.params.id, { screenshotProtection: !!enabled })
    res.json({ ok: true, screenshotProtection: !!enabled })
  } catch (err) {
    console.error('[ScreenshotProtection]', err)
    res.status(500).json({ error: 'Serverfehler' })
  }
})

export default router