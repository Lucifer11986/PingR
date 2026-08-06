import { Router, Response }      from 'express'
import crypto                    from 'crypto'
import path                      from 'path'
import fs                        from 'fs'
import multer                    from 'multer'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { LegacyClaim }           from '../models/LegacyClaim'
import { User }                  from '../models/User'
import nodemailer                from 'nodemailer'

const router = Router()
router.use(authMiddleware)

// Screenshot-Upload konfigurieren
const screenshotDir = '/app/uploads/claims'
if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true })

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, screenshotDir),
    filename:    (req: any, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase()
      cb(null, `claim_${req.userId}_${Date.now()}${ext}`)
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg','.jpeg','.png','.webp','.gif']
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true)
    else cb(new Error('Nur Bilder erlaubt'))
  },
})

// -- Hilfsfunktionen ----------------------------------------------------------

function isValidUIN(uin: string): boolean {
  return /^\d{5,10}$/.test(uin.trim())
}

async function sendClaimEmail(email: string, username: string, uin: string, token: string): Promise<void> {
  const smtpConfigured = !!(process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_HOST)
  if (!smtpConfigured) {
    console.log(`[Claims] E-Mail-Token für ${username} (UIN ${uin}): ${token}`)
    return
  }
  const appUrl = process.env.APP_URL || 'https://lumestack.de'
  const link   = `${appUrl}/api/claims/verify-email?token=${token}`

  const transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  })

  await transporter.sendMail({
    from:    `"PingR Legacy" <${process.env.SMTP_USER}>`,
    to:      email,
    subject: `PingR – ICQ-UIN #${uin} beanspruchen`,
    html: `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#08090f;font-family:-apple-system,sans-serif">
<div style="max-width:520px;margin:40px auto;padding:20px">
  <div style="background:linear-gradient(135deg,#92400e,#d97706);border-radius:16px 16px 0 0;padding:28px;text-align:center">
    <div style="font-size:40px;margin-bottom:8px">📡</div>
    <h1 style="margin:0;color:white;font-size:24px;font-weight:800">ICQ Legacy Claim</h1>
    <p style="margin:4px 0 0;color:rgba(255,255,255,0.75);font-size:12px">PingR – Retro Verifizierung</p>
  </div>
  <div style="background:#0d0f18;border:1px solid rgba(255,255,255,0.07);border-top:none;border-radius:0 0 16px 16px;padding:28px">
    <h2 style="margin:0 0 8px;color:rgba(255,255,255,0.92);font-size:18px">Hey ${username}!</h2>
    <p style="color:rgba(255,255,255,0.5);font-size:13px;line-height:1.65;margin:0 0 20px">
      Du hast beansprucht, der Besitzer der ICQ-UIN <strong style="color:#f59e0b;font-family:monospace;font-size:16px">#${uin}</strong> zu sein.<br><br>
      Wenn du damals Zugriff auf diese E-Mail-Adresse hattest, bestätige deinen Anspruch jetzt:
    </p>
    <div style="text-align:center;margin-bottom:22px">
      <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#b45309,#f59e0b);color:white;padding:13px 32px;border-radius:12px;text-decoration:none;font-weight:700;font-size:14px">
        ✓ UIN #${uin} beanspruchen →
      </a>
    </div>
    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:12px 14px;margin-bottom:20px">
      <p style="margin:0 0 5px;color:rgba(255,255,255,0.3);font-size:11px">Oder diesen Link manuell öffnen:</p>
      <p style="margin:0;word-break:break-all;font-family:monospace;font-size:11px;color:#f59e0b">${link}</p>
    </div>
    <p style="color:rgba(255,255,255,0.25);font-size:12px;margin:0;line-height:1.7">
      ⏱ Dieser Link ist <strong style="color:rgba(255,255,255,0.4)">1 Stunde</strong> gültig.<br>
      ⚠️ Gib <strong>niemals</strong> dein altes ICQ-Passwort auf PingR ein.<br>
      Falls du diesen Claim nicht gestellt hast, ignoriere diese E-Mail.
    </p>
    <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:20px 0"/>
    <p style="color:rgba(255,255,255,0.15);font-size:11px;margin:0;text-align:center">PingR – lumestack.de</p>
  </div>
</div>
</body></html>`,
  })
}

// -- GET /api/claims/mine – eigene Claims abrufen -----------------------------
router.get('/mine', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const claims = await LegacyClaim.find({ userId: req.userId })
      .sort({ createdAt: -1 }).limit(5)
    res.json(claims)
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// -- POST /api/claims – Neuen Claim einreichen --------------------------------
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { uin, proofType, proofEmail } = req.body

    // Validierung
    if (!uin || !isValidUIN(String(uin))) {
      res.status(400).json({ error: 'Ungültige UIN (5-10 Ziffern)' }); return
    }
    if (!['email','firstcome'].includes(proofType)) {
      res.status(400).json({ error: 'Ungültiger Proof-Typ' }); return
    }

    const cleanUIN = String(uin).trim()

    // 1. Prüfen ob die UIN bereits als PingR-UIN vergeben ist
    const existingUser = await User.findOne({ uin: cleanUIN })
    if (existingUser && String(existingUser._id) !== req.userId) {
      res.status(409).json({ error: `UIN #${cleanUIN} ist bereits als PingR-Nummer vergeben.` }); return
    }

    // 2. Prüfen ob ein verifizierter Claim existiert
    const verifiedClaim = await LegacyClaim.findOne({ requestedUin: cleanUIN, status: 'approved' })
    if (verifiedClaim && String(verifiedClaim.userId) !== req.userId) {
      res.status(409).json({ error: `UIN #${cleanUIN} wurde bereits von einem anderen Nutzer verifiziert.` }); return
    }

    // 3. Prüfen ob dieser User schon einen aktiven Claim hat
    const myActiveClaim = await LegacyClaim.findOne({
      userId: req.userId,
      status: { $in: ['pending','email_sent','approved'] }
    })
    if (myActiveClaim) {
      res.status(409).json({ error: 'Du hast bereits einen aktiven Claim. Schließe ihn erst ab.' }); return
    }

    // 4. Prüfen ob UIN bereits beansprucht wird (pending)
    const pendingClaim = await LegacyClaim.findOne({
      requestedUin: cleanUIN,
      status: { $in: ['pending','email_sent'] }
    })
    if (pendingClaim && String(pendingClaim.userId) !== req.userId) {
      res.status(409).json({ error: `UIN #${cleanUIN} wird gerade von einem anderen Nutzer beansprucht.` }); return
    }

    if (proofType === 'email') {
      if (!proofEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(proofEmail)) {
        res.status(400).json({ error: 'Gültige E-Mail-Adresse erforderlich' }); return
      }
      const token    = crypto.randomBytes(32).toString('hex')
      const tokenExp = new Date(Date.now() + 60 * 60 * 1000) // 1 Stunde

      const claim = await LegacyClaim.create({
        userId: req.userId, requestedUin: cleanUIN,
        proofType: 'email', proofEmail: proofEmail.toLowerCase().trim(),
        emailToken: token, emailTokenExp: tokenExp, status: 'email_sent',
      })

      const user = await User.findById(req.userId).select('username')
      await sendClaimEmail(proofEmail, (user as any)?.username || 'Nutzer', cleanUIN, token)

      res.json({ ok: true, status: 'email_sent', claimId: claim._id,
        message: `Bestätigungslink an ${proofEmail} gesendet. Link ist 1 Stunde gültig.` })

    } else if (proofType === 'firstcome') {
      // First-Come-First-Served: direkt approved
      const claim = await LegacyClaim.create({
        userId: req.userId, requestedUin: cleanUIN,
        proofType: 'firstcome', status: 'approved',
        reserved: true,  // Kann von jemandem mit echtem Nachweis überschrieben werden
      })
      // UIN sofort als neue Haupt-UIN setzen (aber als reserviert markiert)
      await User.findByIdAndUpdate(req.userId, {
        uin:            cleanUIN,   // ← PingR-UIN wird auf ICQ-UIN getauscht
        legacyUin:      cleanUIN,
        legacyVerified: false,
        legacyMethod:   'firstcome',
        legacyReserved: true,       // Unter Vorbehalt — kann überschrieben werden
      })
      res.json({ ok: true, status: 'approved', claimId: claim._id,
        message: `UIN #${cleanUIN} wurde dir vorläufig als neue Nummer zugewiesen (First-Come). Kann bei echtem Nachweis überschrieben werden.` })
    }
  } catch (_err) {
    console.error('[Claims POST]', _err)
    res.status(500).json({ error: 'Serverfehler' })
  }
})

// -- POST /api/claims/screenshot – Screenshot-Claim --------------------------
router.post('/screenshot', upload.single('screenshot'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { uin } = req.body
    if (!uin || !isValidUIN(String(uin))) {
      res.status(400).json({ error: 'Ungültige UIN' }); return
    }
    if (!req.file) {
      res.status(400).json({ error: 'Screenshot erforderlich' }); return
    }

    const cleanUIN = String(uin).trim()

    // Prüfungen wie oben
    const verifiedClaim = await LegacyClaim.findOne({ requestedUin: cleanUIN, status: 'approved', proofType: { $ne: 'firstcome' } })
    if (verifiedClaim && String(verifiedClaim.userId) !== req.userId) {
      res.status(409).json({ error: `UIN #${cleanUIN} wurde bereits verifiziert.` }); return
    }

    const myActiveClaim = await LegacyClaim.findOne({ userId: req.userId, status: { $in: ['pending','email_sent'] } })
    if (myActiveClaim) {
      res.status(409).json({ error: 'Du hast bereits einen ausstehenden Claim.' }); return
    }

    const claim = await LegacyClaim.create({
      userId: req.userId, requestedUin: cleanUIN,
      proofType: 'screenshot',
      proofScreenshot: `/uploads/claims/${req.file.filename}`,
      status: 'pending',
    })

    res.json({ ok: true, status: 'pending', claimId: claim._id,
      message: `Screenshot eingereicht. Ein Admin prüft deinen Claim für UIN #${cleanUIN}.` })
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Fehler' })
  }
})

// -- GET /api/claims/verify-email – E-Mail-Token bestätigen ------------------
router.get('/verify-email', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { token } = req.query as { token: string }
    if (!token) { res.status(400).send('Token fehlt'); return }

    const claim = await LegacyClaim.findOne({
      emailToken:    token,
      emailTokenExp: { $gt: new Date() },
      status:        'email_sent',
    }).populate('userId', 'username')

    if (!claim) {
      res.status(400).send(`<!DOCTYPE html><html><body style="background:#08090f;color:white;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center">
        <div><div style="font-size:48px;margin-bottom:16px">❌</div>
        <h2>Link ungültig oder abgelaufen</h2>
        <p style="color:rgba(255,255,255,0.4)">Bitte stelle einen neuen Claim.</p>
        <a href="/chat" style="color:#f59e0b">Zurück zu PingR</a></div></body></html>`)
      return
    }

    // Claim genehmigen
    claim.status = 'approved'
    claim.emailToken = undefined
    await claim.save()

    // Legacy-UIN im User-Profil setzen UND als neue Haupt-UIN übernehmen
    await User.findByIdAndUpdate(claim.userId, {
      uin:            claim.requestedUin,   // ← ICQ-UIN wird neue PingR-UIN
      legacyUin:      claim.requestedUin,
      legacyVerified: true,
      legacyMethod:   'email',
    })

    const username = (claim.userId as any)?.username || 'Nutzer'

    res.send(`<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8">
<title>UIN bestätigt – PingR</title>
<meta http-equiv="refresh" content="5;url=/chat">
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#08090f;color:white;font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}.card{background:#0d0f18;border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:40px;max-width:420px;width:100%;text-align:center}.uin{background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:12px;padding:16px;margin:20px 0;font-family:monospace;font-size:32px;font-weight:900;color:#f59e0b;letter-spacing:3px}.btn{display:inline-block;margin-top:20px;background:linear-gradient(135deg,#b45309,#f59e0b);color:white;padding:12px 28px;border-radius:12px;text-decoration:none;font-weight:700}</style>
</head><body><div class="card">
  <div style="font-size:56px;margin-bottom:12px">🎉</div>
  <h1 style="font-size:22px;margin-bottom:8px">UIN verifiziert!</h1>
  <p style="color:rgba(255,255,255,0.5);font-size:14px">Hey ${username}! Dein Anspruch auf diese ICQ-UIN wurde bestätigt:</p>
  <div class="uin">#${claim.requestedUin}</div>
  <p style="color:rgba(255,255,255,0.4);font-size:13px">Diese UIN ist jetzt deine neue PingR-Nummer. Deine alte automatisch vergebene UIN wurde ersetzt.</p>
  <a href="/chat" class="btn">→ Zu PingR</a>
  <p style="color:rgba(255,255,255,0.2);font-size:11px;margin-top:16px">Weiterleitung in 5 Sekunden…</p>
</div></body></html>`)

  } catch (_err) { res.status(500).send('Serverfehler') }
})

// -- POST /api/claims/:id/assign – Admin: UIN dem Nutzer zuweisen -----------
// Diese Route wird vom Admin nach Screenshot-Genehmigung aufgerufen
// und tauscht die UIN des Nutzers gegen die beanspruchte ICQ-UIN
router.post('/:id/assign', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const claim = await LegacyClaim.findById(req.params.id)
    if (!claim) { res.status(404).json({ error: 'Nicht gefunden' }); return }
    if (claim.status !== 'approved') { res.status(400).json({ error: 'Claim nicht genehmigt' }); return }

    // UIN tauschen
    await User.findByIdAndUpdate(claim.userId, {
      uin:            claim.requestedUin,
      legacyUin:      claim.requestedUin,
      legacyVerified: true,
      legacyMethod:   claim.proofType,
      legacyReserved: false,
    })
    res.json({ ok: true, message: `UIN #${claim.requestedUin} wurde dem Nutzer als neue Nummer zugewiesen.` })
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// -- DELETE /api/claims/:id – eigenen Claim zurückziehen ---------------------
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const claim = await LegacyClaim.findOne({ _id: req.params.id, userId: req.userId })
    if (!claim) { res.status(404).json({ error: 'Nicht gefunden' }); return }
    if (claim.status === 'approved') {
      const user = await User.findById(req.userId)
      if (user) {
        const updateData: any = { legacyUin: undefined, legacyVerified: false, legacyMethod: undefined, legacyReserved: false }
        // UIN nur zurücksetzen wenn es die ICQ-UIN war (d.h. UIN wurde getauscht)
        if (user.uin === claim.requestedUin) {
          // Neue zufällige UIN generieren
          const newUin = String(Math.floor(10000000 + Math.random() * 90000000))
          updateData.uin = newUin
        }
        await User.findByIdAndUpdate(req.userId, updateData)
      }
    }
    await claim.deleteOne()
    res.json({ ok: true })
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

export default router