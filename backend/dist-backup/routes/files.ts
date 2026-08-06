import { Router, Response } from 'express'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { upload } from '../middleware/upload'

const router = Router()
router.use(authMiddleware)

// POST /api/files/upload  – allgemeiner Datei-Upload (gibt URL zurück)
router.post('/upload', upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) { res.status(400).json({ error: 'Keine Datei' }); return }
    res.json({
      url: `/uploads/${req.file.filename}`,
      name: req.file.originalname,
      size: req.file.size,
      mime: req.file.mimetype,
    })
  } catch {
    res.status(500).json({ error: 'Upload fehlgeschlagen' })
  }
})

export default router
