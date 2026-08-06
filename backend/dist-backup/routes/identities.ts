import { Router, Response } from 'express'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { Identity } from '../models/Identity'
import { User } from '../models/User'

const router = Router()
router.use(authMiddleware)

// Hilfsfunktion: zufällige UIN generieren (8-stellig)
async function generateUIN(): Promise<string> {
  let uin: string
  let exists = true
  while (exists) {
    uin = String(Math.floor(10000000 + Math.random() * 90000000))
    const userExists     = await User.findOne({ uin })
    const identityExists = await Identity.findOne({ uin })
    exists = !!(userExists || identityExists)
  }
  return uin!
}

// GET /api/identities — Alle Identitäten des Users
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const identities = await Identity.find({ userId: req.userId }).sort({ createdAt: 1 })
    res.json(identities)
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// POST /api/identities — Neue Identität erstellen
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { type, username, bio } = req.body

    if (!['private','work','anonymous'].includes(type)) {
      res.status(400).json({ error: 'Ungültiger Typ (private/work/anonymous)' }); return
    }
    if (!username?.trim()) {
      res.status(400).json({ error: 'Nutzername erforderlich' }); return
    }

    // Max 5 Identitäten pro User
    const count = await Identity.countDocuments({ userId: req.userId })
    if (count >= 5) {
      res.status(400).json({ error: 'Maximal 5 Identitäten erlaubt' }); return
    }

    // Anonyme Identität: max 1
    if (type === 'anonymous') {
      const anonExists = await Identity.findOne({ userId: req.userId, type: 'anonymous' })
      if (anonExists) {
        res.status(400).json({ error: 'Nur eine anonyme Identität erlaubt' }); return
      }
    }

    const uin      = await generateUIN()
    const isFirst  = count === 0

    const identity = await Identity.create({
      userId:    req.userId,
      type,
      uin,
      username:  username.trim(),
      bio:       bio?.trim() || '',
      isDefault: isFirst,
      isActive:  isFirst,
      settings: {
        notifications: true,
        newChatLimit:  type === 'anonymous' ? 10 : 100,
      },
    })

    res.status(201).json(identity)
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// POST /api/identities/:id/switch — Zu Identität wechseln
router.post('/:id/switch', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const identity = await Identity.findOne({ _id: req.params.id, userId: req.userId })
    if (!identity) { res.status(404).json({ error: 'Identität nicht gefunden' }); return }

    // Alle anderen deaktivieren
    await Identity.updateMany({ userId: req.userId }, { isActive: false })
    identity.isActive = true
    await identity.save()

    res.json({ ok: true, identity })
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// PATCH /api/identities/:id — Identität bearbeiten
router.patch('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { username, bio, avatar, settings } = req.body
    const identity = await Identity.findOne({ _id: req.params.id, userId: req.userId })
    if (!identity) { res.status(404).json({ error: 'Nicht gefunden' }); return }

    if (username) identity.username = username.trim()
    if (bio !== undefined) identity.bio = bio.trim()
    if (avatar !== undefined) identity.avatar = avatar
    if (settings) identity.settings = { ...identity.settings, ...settings }
    await identity.save()

    res.json(identity)
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// DELETE /api/identities/:id — Identität löschen
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const identity = await Identity.findOne({ _id: req.params.id, userId: req.userId })
    if (!identity) { res.status(404).json({ error: 'Nicht gefunden' }); return }
    if (identity.isDefault) {
      res.status(400).json({ error: 'Standard-Identität kann nicht gelöscht werden' }); return
    }

    await identity.deleteOne()

    // Falls aktive Identität gelöscht → auf Default wechseln
    if (identity.isActive) {
      await Identity.findOneAndUpdate(
        { userId: req.userId, isDefault: true },
        { isActive: true }
      )
    }

    res.json({ ok: true })
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// GET /api/identities/active — Aktive Identität
router.get('/active', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const identity = await Identity.findOne({ userId: req.userId, isActive: true })
    if (!identity) {
      // Fallback: Default nehmen
      const def = await Identity.findOne({ userId: req.userId, isDefault: true })
      res.json(def)
      return
    }
    res.json(identity)
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

export default router