import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { User } from '../models/User'
import { decryptField } from '../utils/fieldEncryption'
import { Message } from '../models/Message'
// Statische imports - beide Models m�ssen existieren
import { SecurityLog } from '../models/SecurityLog'

const router = Router()

// ── Admin-Rollen-Definition ─────────────────────────────────────────────────
export type AdminRole = 'superadmin' | 'moderator' | 'support' | 'analyst'

export const ROLE_PERMISSIONS: Record<AdminRole, string[]> = {
  superadmin: ['*'],  // Alles
  moderator:  ['stats','users','security','reports','claims','broadcast'],
  support:    ['stats','users'],
  analyst:    ['stats','charts'],
}

// Gibt die Rolle aus dem Request zurück (superadmin wenn ADMIN_SECRET, sonst aus DB)
export async function getAdminRole(req: Request): Promise<AdminRole | null> {
  const secret = req.headers['x-admin-secret'] as string
  if (secret && secret === process.env.ADMIN_SECRET) return 'superadmin'
  const staffToken = req.headers['x-staff-token'] as string
  if (!staffToken) return null
  const user = await User.findOne({ adminInviteToken: null, adminRole: { $ne: null } })
  // Suche per JWT-ähnlichem Token
  const jwt = require('jsonwebtoken')
  try {
    const payload = jwt.verify(staffToken, process.env.JWT_SECRET || 'secret') as any
    const staff = await User.findById(payload.userId)
    if (!staff || !staff.adminRole) return null
    return staff.adminRole as AdminRole
  } catch { return null }
}

function adminAuth(req: Request, res: Response, next: () => void): void {
  const secret     = req.headers['x-admin-secret'] as string
  const staffToken = req.headers['x-staff-token']  as string
  if (!secret && !staffToken) { res.status(403).json({ error: 'Zugriff verweigert' }); return }
  if (secret && secret === process.env.ADMIN_SECRET) { next(); return }
  if (staffToken) {
    const jwt = require('jsonwebtoken')
    try {
      jwt.verify(staffToken, process.env.JWT_SECRET || 'secret')
      next(); return
    } catch { res.status(403).json({ error: 'Token ungültig' }); return }
  }
  res.status(403).json({ error: 'Zugriff verweigert' })
}
router.use((req, res, next) => adminAuth(req, res, next))

// -- GET /api/admin/stats -----------------------------------------------------
router.get('/stats', async (_req: Request, res: Response): Promise<void> => {
  try {
    // Step 1: User-Stats (immer verf�gbar)
    const allUsers = await User.find({})
      .select('status lastDevice isBanned warningCount')
      .lean()

    const total   = allUsers.length
    const online  = allUsers.filter((u: any) => u.status === 'online').length
    const away    = allUsers.filter((u: any) => u.status === 'away').length
    const banned  = allUsers.filter((u: any) => u.isBanned === true).length
    const mobile  = allUsers.filter((u: any) =>
      String(u.lastDevice || '').toLowerCase().includes('mobile')
    ).length
    const warned  = allUsers.filter((u: any) => (u.warningCount || 0) > 0).length

    // Step 2: Security-Stats (try/catch damit ein Fehler hier nicht alles kaputt macht)
    let unreportedCritical = 0, csamCount = 0, extremismCount = 0
    let terrorCount = 0, flaggedCount = 0, totalLogs = 0, openReports = 0

    try {
      totalLogs = await SecurityLog.countDocuments()
      unreportedCritical = await SecurityLog.countDocuments({
        eventType: { $in: ['csam', 'extremism', 'terrorism'] },
        reportedToBka: false,
      })
      csamCount       = await SecurityLog.countDocuments({ eventType: 'csam' })
      extremismCount  = await SecurityLog.countDocuments({ eventType: 'extremism' })
      terrorCount     = await SecurityLog.countDocuments({ eventType: 'terrorism' })
      flaggedCount    = await SecurityLog.countDocuments({ eventType: 'flagged_review' })
    } catch (secErr) {
      console.error('[Stats] SecurityLog error (non-fatal):', secErr)
    }

    try {
      const { Report: ReportModel } = require('../models/Report')
      openReports = await ReportModel.countDocuments({ status: 'open' })
    } catch (repErr) {
      console.error('[Stats] Report error (non-fatal):', repErr)
    }

    const response = {
      users: { total, online, away, offline: total - online - away, banned, mobile, warned },
      security: { totalEvents: totalLogs, unreportedCritical, csam: csamCount, extremism: extremismCount, terrorism: terrorCount, flagged: flaggedCount },
      reports: { open: openReports },
    }

    console.log('[Stats] Response:', JSON.stringify(response))
    res.json(response)

  } catch (err) {
    console.error('[Stats] Fatal error:', err)
    res.status(500).json({ error: String(err) })
  }
})

// -- GET /api/admin/users -----------------------------------------------------
router.get('/users', async (req: Request, res: Response): Promise<void> => {
  try {
    const page  = Math.max(1, parseInt(String(req.query.page  || '1')))
    const limit = Math.min(100, parseInt(String(req.query.limit || '25')))
    const q     = String(req.query.q || '').trim()
    const filter: Record<string, unknown> = {}
    if (q) {
      filter.$or = [
        { username: { $regex: q, $options: 'i' } },
        { email:    { $regex: q, $options: 'i' } },
        { uin:      { $regex: q, $options: 'i' } },
      ]
    }
    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-password -resetToken -resetTokenExpires')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ])
    const usersWithFlags = (users as any[]).map((u: any) => ({
      ...u,
      isMobile: String(u.lastDevice || '').toLowerCase().includes('mobile'),
    }))
    res.json({ users: usersWithFlags, total, page, pages: Math.ceil(total / limit) })
  } catch (err) {
    console.error('[Users] error:', err)
    res.status(500).json({ error: String(err) })
  }
})

// -- GET /api/admin/users/:id/messages ---------------------------------------
router.get('/users/:id/messages', async (req: Request, res: Response): Promise<void> => {
  try {
    const messages = await Message.find({ sender: req.params.id, deleted: false })
      .populate('sender', 'username uin')
      .sort({ createdAt: -1 }).limit(50).lean()
    res.json(messages)
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// -- GET /api/admin/security-logs ---------------------------------------------
router.get('/security-logs', async (_req: Request, res: Response): Promise<void> => {
  try {
    const logs = await SecurityLog.find().sort({ timestamp: -1 }).limit(200).lean()
    res.json({ total: logs.length, unreported: (logs as any[]).filter((l: any) => !l.reportedToBka).length, logs })
  } catch (_err) {
    res.json({ total: 0, unreported: 0, logs: [] })
  }
})

// -- POST /api/admin/generate-report ------------------------------------------
router.post('/generate-report', async (req: Request, res: Response): Promise<void> => {
  try {
    let { logIds, markAsReported } = req.body
    if (!logIds || logIds.length === 0) {
      const logs = await SecurityLog.find({
        eventType: { $in: ['csam','extremism','terrorism'] }, reportedToBka: false,
      }).select('_id').lean()
      logIds = (logs as any[]).map((l: any) => l._id.toString())
    }
    if (logIds.length === 0) { res.json({ message: 'Keine F�lle.', report: null }); return }
    const { generateLawEnforcementReport } = require('../utils/securityLogger')
    const report = await generateLawEnforcementReport(logIds)
    if (markAsReported) {
      await SecurityLog.updateMany({ _id: { $in: logIds } }, { reportedToBka: true, reportedAt: new Date() })
    }
    res.json({ success: true, incidentCount: logIds.length, report })
  } catch (err) { res.status(500).json({ error: String(err) }) }
})

// -- POST /api/admin/mark-reported --------------------------------------------
router.post('/mark-reported', async (req: Request, res: Response): Promise<void> => {
  try {
    const { logIds, reference } = req.body
    await SecurityLog.updateMany(
      { _id: { $in: logIds } },
      { reportedToBka: true, reportedAt: new Date(), reportReference: reference }
    )
    res.json({ ok: true })
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// -- GET /api/admin/reports ----------------------------------------------------
router.get('/reports', async (_req: Request, res: Response): Promise<void> => {
  try {
    const { Report: ReportModel } = require('../models/Report')
    const reports = await ReportModel.find({ status: 'open' })
      .populate('reporter',       'username uin')
      .populate('reportedUser',   'username uin email isBanned reportCount warningCount')
      .populate('reportedMessage','content type')
      .sort({ createdAt: -1 }).limit(100).lean()
    res.json(reports)
  } catch (_err) { res.json([]) }
})

// -- POST /api/admin/ban-user --------------------------------------------------
router.post('/ban-user', async (req: Request, res: Response): Promise<void> => {
  try {
    await User.findByIdAndUpdate(req.body.userId, { isBanned: true, bannedReason: req.body.reason || 'Versto�' })
    res.json({ ok: true })
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// -- POST /api/admin/unban-user ------------------------------------------------
router.post('/unban-user', async (req: Request, res: Response): Promise<void> => {
  try {
    await User.findByIdAndUpdate(req.body.userId, { isBanned: false, bannedReason: undefined, warningCount: 0 })
    res.json({ ok: true })
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// -- POST /api/admin/reset-user-password --------------------------------------
router.post('/reset-user-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, newPassword } = req.body
    if (!userId || !newPassword || newPassword.length < 6) {
      res.status(400).json({ error: 'Ung�ltige Daten' }); return
    }
    const hashed = await bcrypt.hash(newPassword, 12)
    const user = await User.findByIdAndUpdate(userId, { password: hashed }, { new: true }).select('username uin')
    if (!user) { res.status(404).json({ error: 'Nicht gefunden' }); return }
    res.json({ ok: true, message: `Passwort f�r ${(user as any).username} zur�ckgesetzt` })
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// -- POST /api/admin/broadcast -------------------------------------------------
router.post('/broadcast', async (req: Request, res: Response): Promise<void> => {
  try {
    const { message } = req.body
    if (!message?.trim()) { res.status(400).json({ error: 'Nachricht fehlt' }); return }
    const socketServer = require('../socket/socketServer')
    socketServer.getIO().emit('system_broadcast', {
      content: message.trim(), timestamp: new Date().toISOString(),
    })
    console.log('[Broadcast] Sent:', message.trim())
    res.json({ ok: true })
  } catch (err) {
    console.error('[Broadcast] error:', err)
    res.status(500).json({ error: String(err) })
  }
})

// -- GET /api/admin/registrations ---------------------------------------------
router.get('/registrations', async (_req: Request, res: Response): Promise<void> => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const users = await User.find({ createdAt: { $gte: thirtyDaysAgo } })
      .select('createdAt username uin').sort({ createdAt: 1 }).lean()
    const byDay: Record<string, number> = {}
    ;(users as any[]).forEach((u: any) => {
      const day = new Date(u.createdAt).toISOString().split('T')[0]
      byDay[day] = (byDay[day] || 0) + 1
    })
    res.json({ total: users.length, byDay, recent: (users as any[]).slice(-10).reverse() })
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// -- GET /api/admin/debug -----------------------------------------------------
router.get('/debug', async (_req: Request, res: Response): Promise<void> => {
  const result: Record<string, unknown> = { timestamp: new Date().toISOString() }
  try { result.userCount = await User.countDocuments() } catch(e) { result.userError = String(e) }
  try { result.logCount  = await SecurityLog.countDocuments() } catch(e) { result.logError = String(e) }
  try { const { Report: RM } = require('../models/Report'); result.repCount = await RM.countDocuments() } catch(e) { result.repError = String(e) }
  res.json(result)
})

// -- DELETE /api/admin/security-logs/:id --------------------------------------
router.delete('/security-logs/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    await SecurityLog.findByIdAndDelete(req.params.id)
    res.json({ ok: true })
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// -- DELETE /api/admin/security-logs � Alle l�schen --------------------------
router.delete('/security-logs', async (req: Request, res: Response): Promise<void> => {
  try {
    const { ids } = req.body
    if (ids && ids.length > 0) {
      await SecurityLog.deleteMany({ _id: { $in: ids } })
    } else {
      await SecurityLog.deleteMany({})
    }
    res.json({ ok: true })
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// -- POST /api/admin/verify-user ----------------------------------------------
router.post('/verify-user', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.body
    await User.findByIdAndUpdate(userId, {
      emailVerified: true, emailVerifyToken: undefined, emailVerifyExpires: undefined,
    })
    res.json({ ok: true })
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})


// -- Legacy Claims Admin-Routen -----------------------------------------------

// GET /api/admin/claims — ausstehende + optional alle Claims (?all=1)
router.get('/claims', async (req: Request, res: Response): Promise<void> => {
  try {
    const { LegacyClaim } = require('../models/LegacyClaim')
    const filter = (req.query as any).all === '1'
      ? {}
      : { status: { $in: ['pending', 'email_sent', 'approved'] } }
    const claims = await LegacyClaim.find(filter)
      .populate('userId', 'username uin email')
      .sort({ createdAt: -1 }).limit(100).lean()
    res.json(claims)
  } catch (_err) { res.json([]) }
})

// POST /api/admin/claims/:id/approve � Claim genehmigen
router.post('/claims/:id/approve', async (req: Request, res: Response): Promise<void> => {
  try {
    const { LegacyClaim } = require('../models/LegacyClaim')
    const { note } = req.body
    const claim = await LegacyClaim.findById(req.params.id).populate('userId', 'username')
    if (!claim) { res.status(404).json({ error: 'Nicht gefunden' }); return }
    claim.status     = 'approved'
    claim.adminNote  = note || ''
    claim.reviewedAt = new Date()
    await claim.save()
    await User.findByIdAndUpdate(claim.userId, {
      uin:            claim.requestedUin,   // ICQ-UIN wird neue Haupt-UIN
      legacyUin:      claim.requestedUin,
      legacyVerified: true,
      legacyMethod:   claim.proofType,
      legacyReserved: false,
    })
    console.log(`[Admin] Claim f�r UIN #${claim.requestedUin} genehmigt`)
    res.json({ ok: true })
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// POST /api/admin/claims/:id/reject � Claim ablehnen
router.post('/claims/:id/reject', async (req: Request, res: Response): Promise<void> => {
  try {
    const { LegacyClaim } = require('../models/LegacyClaim')
    const { note } = req.body
    const claim = await LegacyClaim.findById(req.params.id)
    if (!claim) { res.status(404).json({ error: 'Nicht gefunden' }); return }
    claim.status     = 'rejected'
    claim.adminNote  = note || 'Abgelehnt'
    claim.reviewedAt = new Date()
    await claim.save()
    res.json({ ok: true })
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// POST /api/admin/claims/:id/release — Vorbehalt (firstcome) aufheben
router.post('/claims/:id/release', async (req: Request, res: Response): Promise<void> => {
  try {
    const { LegacyClaim } = require('../models/LegacyClaim')
    const claim = await LegacyClaim.findById(req.params.id)
    if (!claim) { res.status(404).json({ error: 'Nicht gefunden' }); return }
    claim.reserved = false
    await claim.save()
    await User.findByIdAndUpdate(claim.userId, {
      legacyVerified: true,
      legacyReserved: false,
    })
    res.json({ ok: true, message: 'Vorbehalt aufgehoben — UIN dauerhaft zugewiesen' })
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// DELETE /api/admin/users/:id � User vollst�ndig l�schen
router.delete('/users/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const uid  = req.params.id
    const user = await User.findById(uid).select('username uin email')
    if (!user) { res.status(404).json({ error: 'User nicht gefunden' }); return }
    const { Conversation } = require('../models/Conversation')
    const { Contact }      = require('../models/Contact')
    const { LegacyClaim }  = require('../models/LegacyClaim')
    await Promise.all([
      Message.updateMany({ sender: uid }, { deleted: true, content: '', fileUrl: undefined }),
      Conversation.updateMany({ participants: uid }, { $pull: { participants: uid } }),
      Contact.deleteMany({ $or: [{ user: uid }, { owner: uid }] }),
      LegacyClaim.deleteMany({ userId: uid }),
    ])
    await User.findByIdAndDelete(uid)
    console.log(`[Admin] User ${(user as any).username} (#${(user as any).uin}) vollst�ndig gel�scht`)
    res.json({ ok: true, message: `User ${(user as any).username} wurde vollst�ndig gel�scht` })
  } catch (err) { res.status(500).json({ error: String(err) }) }
})

// -- POST /api/admin/disable-2fa � Notfall: 2FA f�r User deaktivieren ---------
router.post('/disable-2fa', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.body
    if (!userId) { res.status(400).json({ error: 'userId fehlt' }); return }
    const user = await User.findByIdAndUpdate(userId, {
      twoFactorEnabled: false,
      twoFactorSecret:  undefined,
      twoFactorBackup:  undefined,
    }, { new: true }).select('username uin')
    if (!user) { res.status(404).json({ error: 'User nicht gefunden' }); return }
    console.log(`[Admin] 2FA deaktiviert f�r ${(user as any).username}`)
    res.json({ ok: true, message: `2FA f�r ${(user as any).username} deaktiviert` })
  } catch (err) { res.status(500).json({ error: String(err) }) }
})

// -- GET /api/admin/charts – Statistiken für Statistiken-Tab ---------------
router.get('/charts', async (_req: Request, res: Response): Promise<void> => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const sevenDaysAgo  = new Date(Date.now() -  7 * 24 * 60 * 60 * 1000)

    // Totals
    const [totalUsers, totalMessages, totalGroups, activeToday] = await Promise.all([
      User.countDocuments(),
      Message.countDocuments({ deleted: false }),
      (async () => {
        try {
          const { Conversation } = require('../models/Conversation')
          return await Conversation.countDocuments({ isGroup: true })
        } catch { return 0 }
      })(),
      User.countDocuments({ lastSeen: { $gte: new Date(Date.now() - 24*60*60*1000) } }),
    ])

    // Registrierungen der letzten 30 Tage (nach Tag gruppiert)
    const regRaw = await User.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ])

    // Nachrichten der letzten 7 Tage (nach Tag gruppiert)
    const msgRaw = await Message.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo }, deleted: false } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ])

    // Nachrichten-Typen
    const msgTypes = await Message.aggregate([
      { $match: { deleted: false } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ])

    // Top aktive Nutzer (30 Tage)
    const topUsersRaw = await Message.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo }, deleted: false } },
      { $group: { _id: '$sender', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $project: { count: 1, username: '$user.username', uin: '$user.uin' } },
    ])

    // Größte Gruppen
    let topGroups: any[] = []
    try {
      const { Conversation } = require('../models/Conversation')
      topGroups = await Conversation.aggregate([
        { $match: { isGroup: true } },
        { $project: { name: '$groupName', memberCount: { $size: '$participants' } } },
        { $sort: { memberCount: -1 } },
        { $limit: 5 },
      ])
    } catch { /* Conversation model optional */ }

    // Geräte-Verteilung
    const allDevices = await User.find({}).select('lastDevice').lean()
    const mobileCount  = (allDevices as any[]).filter((u: any) =>
      String(u.lastDevice || '').toLowerCase().includes('mobile')).length
    const desktopCount = allDevices.length - mobileCount

    res.json({
      totals: { totalUsers, totalMessages, totalGroups, activeToday },
      registrations: regRaw,
      messages:      msgRaw,
      messageTypes:  msgTypes,
      topUsers:      topUsersRaw,
      topGroups,
      devices: { desktop: desktopCount, mobile: mobileCount },
    })
  } catch (err) {
    console.error('[Charts] error:', err)
    res.status(500).json({ error: String(err) })
  }
})


// ── Staff-Verwaltung ──────────────────────────────────────────────────────────

// GET /api/admin/staff — Alle Staff-Mitglieder auflisten
router.get('/staff', async (req: Request, res: Response): Promise<void> => {
  try {
    const role = await getAdminRole(req)
    if (role !== 'superadmin') { res.status(403).json({ error: 'Nur Superadmin' }); return }
    const staff = await User.find({ adminRole: { $ne: null } })
      .select('username email adminRole adminActiveAt adminInvitedBy createdAt')
      .lean()
    res.json(staff)
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// POST /api/admin/staff/invite — Mitarbeiter einladen
router.post('/staff/invite', async (req: Request, res: Response): Promise<void> => {
  try {
    const role = await getAdminRole(req)
    if (role !== 'superadmin') { res.status(403).json({ error: 'Nur Superadmin' }); return }

    const { email, adminRole } = req.body
    if (!email || !adminRole) { res.status(400).json({ error: 'E-Mail und Rolle erforderlich' }); return }
    const validRoles = ['moderator', 'support', 'analyst']
    if (!validRoles.includes(adminRole)) { res.status(400).json({ error: 'Ungültige Rolle' }); return }

    // Nutzer suchen
    const user = await User.findOne({ email: email.toLowerCase().trim() })
    if (!user) { res.status(404).json({ error: 'Kein Nutzer mit dieser E-Mail gefunden' }); return }

    const jwt = require('jsonwebtoken')
    const staffToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'secret', { expiresIn: '365d' })

    await User.findByIdAndUpdate(user._id, {
      adminRole,
      adminInviteToken:  staffToken,
      adminInviteExpires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    })

    const appUrl = process.env.APP_URL || 'https://lumestack.de'
    res.json({
      ok:        true,
      message:   `${user.username} wurde als ${adminRole} eingeladen`,
      staffToken,
      adminUrl:  `${appUrl}/admin.html`,
      username:  user.username,
    })
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// DELETE /api/admin/staff/:id — Mitarbeiter entfernen
router.delete('/staff/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const role = await getAdminRole(req)
    if (role !== 'superadmin') { res.status(403).json({ error: 'Nur Superadmin' }); return }
    await User.findByIdAndUpdate(req.params.id, {
      adminRole:         null,
      adminInviteToken:  null,
      adminInviteExpires: null,
    })
    res.json({ ok: true })
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// PATCH /api/admin/staff/:id/role — Rolle ändern
router.patch('/staff/:id/role', async (req: Request, res: Response): Promise<void> => {
  try {
    const role = await getAdminRole(req)
    if (role !== 'superadmin') { res.status(403).json({ error: 'Nur Superadmin' }); return }
    const { adminRole } = req.body
    const validRoles = ['moderator', 'support', 'analyst']
    if (!validRoles.includes(adminRole)) { res.status(400).json({ error: 'Ungültige Rolle' }); return }
    await User.findByIdAndUpdate(req.params.id, { adminRole })
    res.json({ ok: true })
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// GET /api/admin/my-role — Eigene Rolle abfragen (für Staff-Login)
router.get('/my-role', async (req: Request, res: Response): Promise<void> => {
  try {
    const role = await getAdminRole(req)
    res.json({ role, permissions: role ? ROLE_PERMISSIONS[role] : [] })
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

export default router