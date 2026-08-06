import multer from 'multer'
import path from 'path'
import crypto from 'crypto'
import fs from 'fs/promises'
import { Request, Response, NextFunction } from 'express'

// Nur sichere Dateiendungen
const SAFE_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp',
  '.pdf', '.txt', '.zip',
  '.doc', '.docx',
  '.webm', '.ogg', '.mp4', '.wav', '.mp3', '.m4a',
])

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, 'uploads/'),
  filename: (_req, file, cb) => {
    // Dateiendung sanitizen — nur bekannte Endungen erlauben
    const ext = path.extname(file.originalname).toLowerCase()
    const safeExt = SAFE_EXTENSIONS.has(ext) ? ext : '.bin'
    // Zufälliger Name — kein Bezug zum Original (Datenschutz)
    const uniqueName = `${Date.now()}-${crypto.randomBytes(12).toString('hex')}${safeExt}`
    cb(null, uniqueName)
  },
})

const fileFilter = (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // MIME-Type prüfen
  const allowed = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf', 'text/plain',
    'application/zip', 'application/x-zip-compressed',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/wav',
    'audio/mpeg', 'audio/mp3', 'audio/x-m4a',
  ]

  // Doppelte Dateiendung blockieren (z.B. malware.php.jpg)
  const originalName = file.originalname || ''
  const dotCount = (originalName.match(/\./g) || []).length
  if (dotCount > 1) {
    cb(new Error('Dateiname mit mehreren Endungen nicht erlaubt'))
    return
  }

  if (allowed.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error(`Dateityp nicht erlaubt: ${file.mimetype}`))
  }
}

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize:  50 * 1024 * 1024,  // 50 MB
    files:     1,                  // Max 1 Datei pro Request
    fieldSize: 1 * 1024 * 1024,   // Max 1 MB für Formular-Felder
  },
})

function matchesSignature(data: Buffer, mime: string): boolean {
  const starts = (...bytes: number[]) => bytes.every((byte, index) => data[index] === byte)
  if (mime === 'image/jpeg') return starts(0xff, 0xd8, 0xff)
  if (mime === 'image/png') return starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)
  if (mime === 'image/gif') return ['GIF87a', 'GIF89a'].includes(data.subarray(0, 6).toString('ascii'))
  if (mime === 'image/webp') return data.subarray(0, 4).toString('ascii') === 'RIFF' && data.subarray(8, 12).toString('ascii') === 'WEBP'
  if (mime === 'application/pdf') return data.subarray(0, 5).toString('ascii') === '%PDF-'
  if (mime.includes('zip') || mime.includes('openxmlformats')) return starts(0x50, 0x4b, 0x03, 0x04) || starts(0x50, 0x4b, 0x05, 0x06)
  if (mime === 'application/msword') return starts(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1)
  if (mime === 'text/plain') return !data.includes(0) && data.toString('utf8').length > 0
  if (mime === 'audio/ogg') return data.subarray(0, 4).toString('ascii') === 'OggS'
  if (mime === 'audio/webm') return starts(0x1a, 0x45, 0xdf, 0xa3)
  if (mime === 'audio/wav') return data.subarray(0, 4).toString('ascii') === 'RIFF' && data.subarray(8, 12).toString('ascii') === 'WAVE'
  if (['audio/mpeg', 'audio/mp3'].includes(mime)) return data.subarray(0, 3).toString('ascii') === 'ID3' || (data[0] === 0xff && (data[1] & 0xe0) === 0xe0)
  if (['audio/mp4', 'audio/x-m4a'].includes(mime)) return data.subarray(4, 8).toString('ascii') === 'ftyp'
  return false
}

export async function verifyUpload(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.file) { next(); return }
  try {
    const handle = await fs.open(req.file.path, 'r')
    const buffer = Buffer.alloc(4096)
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0)
    await handle.close()
    if (!matchesSignature(buffer.subarray(0, bytesRead), req.file.mimetype)) {
      await fs.unlink(req.file.path).catch(() => {})
      res.status(400).json({ error: 'Dateiinhalt stimmt nicht mit dem angegebenen Dateityp überein' })
      return
    }
    next()
  } catch (_error) {
    await fs.unlink(req.file.path).catch(() => {})
    res.status(400).json({ error: 'Datei konnte nicht sicher geprüft werden' })
  }
}
