import { Router, Response } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { User } from '../models/User'
import { verifyUpload } from '../middleware/upload'

const router = Router()
router.use(authMiddleware)

const MAX_SOUNDS    = 10
const MAX_DURATION  = 5      // Sekunden
const MAX_SIZE      = 1 * 1024 * 1024  // 1 MB

// Speicherort
const soundsDir = path.join('/app/uploads/sounds')
if (!fs.existsSync(soundsDir)) fs.mkdirSync(soundsDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, soundsDir),
  filename: (req: any, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase()
    const name = `sound_${req.userId}_${Date.now()}${ext}`
    cb(null, name)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.mp3', '.wav', '.ogg', '.m4a', '.webm']
    const ext = path.extname(file.originalname).toLowerCase()
    if (allowed.includes(ext)) cb(null, true)
    else cb(new Error('Nur Audiodateien erlaubt (mp3, wav, ogg, m4a, webm)'))
  },
})

// GET /api/sounds — eigene Sounds abrufen
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.userId).select('customSounds')
    res.json((user as any)?.customSounds || [])
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// POST /api/sounds — Sound hochladen
router.post('/', upload.single('sound'), verifyUpload, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) { res.status(400).json({ error: 'Keine Datei' }); return }

    const user = await User.findById(req.userId).select('customSounds')
    const sounds = (user as any)?.customSounds || []

    if (sounds.length >= MAX_SOUNDS) {
      fs.unlinkSync(req.file.path)
      res.status(400).json({ error: `Maximal ${MAX_SOUNDS} eigene Sounds erlaubt` }); return
    }

    const label = (req.body.label || req.file.originalname).slice(0, 30)
    const newSound = {
      id:       `custom_${Date.now()}`,
      label,
      url:      `/uploads/sounds/${req.file.filename}`,
      size:     req.file.size,
      uploadedAt: new Date(),
    }

    sounds.push(newSound)
    await User.findByIdAndUpdate(req.userId, { customSounds: sounds })

    res.status(201).json(newSound)
  } catch (err: any) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path)
    res.status(400).json({ error: err.message || 'Upload fehlgeschlagen' })
  }
})

// DELETE /api/sounds/:id — Sound löschen
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user   = await User.findById(req.userId).select('customSounds')
    const sounds = (user as any)?.customSounds || []
    const sound  = sounds.find((s: any) => s.id === req.params.id)

    if (!sound) { res.status(404).json({ error: 'Nicht gefunden' }); return }

    // Datei löschen
    try {
      const filePath = path.join('/app', sound.url)
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    } catch (_e) {}

    const updated = sounds.filter((s: any) => s.id !== req.params.id)
    await User.findByIdAndUpdate(req.userId, { customSounds: updated })

    res.json({ ok: true })
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

export default router
