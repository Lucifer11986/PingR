import { Router, Response } from 'express'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { Contact } from '../models/Contact'
import { User } from '../models/User'

const router = Router()
router.use(authMiddleware)

// GET /api/contacts
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Aktive Identity aus Middleware
  const identityFilter: any = req.activeIdentityId
    ? { $or: [
        { owner: req.userId, identityId: req.activeIdentityId },
        { owner: req.userId, identityId: { $exists: false } },
      ]}
    : { owner: req.userId }

  const contacts = await Contact.find(identityFilter)
      .populate('user', '-password')
      .sort({ addedAt: -1 })
    res.json(contacts)
  } catch (_err) {
    res.status(500).json({ error: 'Serverfehler' })
  }
})

// POST /api/contacts  – Kontakt per UIN hinzufügen
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { uin } = req.body
    if (!uin) { res.status(400).json({ error: 'UIN fehlt' }); return }

    const targetUser = await User.findOne({ uin })
    if (!targetUser) { res.status(404).json({ error: 'UIN nicht gefunden' }); return }
    if (targetUser._id.toString() === req.userId) {
      res.status(400).json({ error: 'Du kannst dich nicht selbst hinzufügen' }); return
    }

    const exists = await Contact.findOne({ owner: req.userId, user: targetUser._id })
    if (exists) { res.status(409).json({ error: 'Kontakt bereits vorhanden' }); return }

    const contact = await Contact.create({
      owner:      req.userId,
      user:       targetUser._id,
      identityId: req.activeIdentityId || undefined,
    })
    const populated = await contact.populate('user', '-password')
    res.status(201).json(populated)
  } catch (_err) {
    res.status(500).json({ error: 'Serverfehler' })
  }
})

// DELETE /api/contacts/:id
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await Contact.findOneAndDelete({ _id: req.params.id, owner: req.userId })
    res.json({ ok: true })
  } catch (_err) {
    res.status(500).json({ error: 'Serverfehler' })
  }
})

export default router
