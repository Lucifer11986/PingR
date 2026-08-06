import { Router, Request, Response } from 'express'
import path from 'path'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { upload, verifyUpload } from '../middleware/upload'
import { Status } from '../models/Status'
import User from '../models/User'

const router = Router()
router.use(authMiddleware)

// -- POST /api/status - Status hochladen --------------------------
router.post('/', upload.single('media'), verifyUpload, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!
    const { type, text, color } = req.body

    // Validierung
    if (!type || !['image', 'video', 'text'].includes(type)) {
      res.status(400).json({ error: 'Ungültiger Status-Typ' }); return
    }
    if (type === 'text' && !text?.trim()) {
      res.status(400).json({ error: 'Text erforderlich' }); return
    }
    if ((type === 'image' || type === 'video') && !req.file) {
      res.status(400).json({ error: 'Datei erforderlich' }); return
    }

    // Video-Dauer prüfen (max 60 Sekunden - wird clientseitig geprüft, hier als Fallback)
    let mediaUrl: string | undefined
    let duration: number | undefined

    if (req.file) {
      mediaUrl = `/uploads/${req.file.filename}`
      // Größe prüfen
      if (type === 'video' && req.file.size > 50 * 1024 * 1024) {
        res.status(400).json({ error: 'Video darf max. 50 MB groß sein' }); return
      }
    }

    // Maximale 1 aktiver Status pro User - alten löschen
    await Status.deleteMany({
      userId,
      expiresAt: { $gt: new Date() }
    })

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h

    const status = await Status.create({
      userId,
      type,
      mediaUrl,
      text:      text?.trim(),
      color:     color || 'linear-gradient(135deg,#b46a0e,#e8b86d)',
      duration,
      viewers:   [],
      expiresAt,
    })

    res.status(201).json({ success: true, status })
  } catch (err) {
    console.error('[status] POST error:', err)
    res.status(500).json({ error: 'Fehler beim Hochladen' })
  }
})

// -- GET /api/status - Status aller Kontakte laden -----------------
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!

    // Kontakte des Users laden
    const user = await User.findById(userId).select('contacts').lean()
    const contactIds = (user as any)?.contacts || []

    // Eigener Status + Kontakt-Status (nur aktive, nicht abgelaufen)
    const statuses = await Status.find({
      userId: { $in: [userId, ...contactIds] },
      expiresAt: { $gt: new Date() },
    })
      .populate('userId', 'username avatar uin')
      .sort({ createdAt: -1 })
      .lean()

    // Nach User gruppieren
    const grouped: Record<string, any> = {}
    for (const s of statuses) {
      const uid = (s.userId as any)._id.toString()
      if (!grouped[uid]) {
        grouped[uid] = {
          user:      s.userId,
          statuses:  [],
          isOwn:     uid === userId,
          hasUnread: false,
        }
      }
      const isViewed = s.viewers.some((v: any) => v.toString() === userId)
      if (!isViewed && uid !== userId) grouped[uid].hasUnread = true
      grouped[uid].statuses.push({
        ...s,
        isViewed,
      })
    }

    // Sortierung: eigener zuerst, dann ungesehen, dann gesehen
    const result = Object.values(grouped).sort((a: any, b: any) => {
      if (a.isOwn) return -1
      if (b.isOwn) return 1
      if (a.hasUnread && !b.hasUnread) return -1
      if (!a.hasUnread && b.hasUnread) return 1
      return 0
    })

    res.json({ statuses: result })
  } catch (err) {
    console.error('[status] GET error:', err)
    res.status(500).json({ error: 'Fehler beim Laden' })
  }
})

// -- POST /api/status/:id/view - Als gesehen markieren ------------
router.post('/:id/view', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!
    await Status.findByIdAndUpdate(req.params.id, {
      $addToSet: { viewers: userId }
    })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Fehler' })
  }
})

// -- DELETE /api/status/:id - Status löschen ----------------------
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!
    const status = await Status.findById(req.params.id)
    if (!status) { res.status(404).json({ error: 'Nicht gefunden' }); return }
    if (status.userId.toString() !== userId) {
      res.status(403).json({ error: 'Keine Berechtigung' }); return
    }
    await status.deleteOne()
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Löschen' })
  }
})

export default router
