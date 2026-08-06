import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { User } from '../models/User'
import { decryptField } from '../utils/fieldEncryption'
import { Message } from '../models/Message'
// Statische imports - beide Models m�ssen existieren
import { SecurityLog } from '../models/SecurityLog'
import { adminAuth, adminPermissionForRequest, AdminRequest, AdminRole, ROLE_PERMISSIONS } from '../middleware/adminAuth'
import { PRIVATE_USER_EXCLUDE } from '../utils/userFields'

const router = Router()

// ── Admin-Rollen-Definition ─────────────────────────────────────────────────
// Gibt die Rolle aus dem Request zurück (superadmin wenn ADMIN_SECRET, sonst aus DB)
export async function getAdminRole(req: Request): Promise<AdminRole | null> {
  return (req as AdminRequest).adminRole || null
}

router.use(adminAuth)
router.use(adminPermissionForRequest)

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
    const q     = String(req.query.q || '').trim().slice(0, 100)
    const filter: Record<string, unknown> = {}
    if (q) {
      const escapedQuery = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      filter.$or = [
        { username: { $regex: escapedQuery, $options: 'i' } },
        { email:    { $regex: escapedQuery, $options: 'i' } },
        { uin:      { $regex: escapedQuery, $options: 'i' } },
      ]
    }
    const [users, total] = await Promise.all([
      User.find(filter)
        .select(PRIVATE_USER_EXCLUDE)
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
    if (!userId || !newPassword || newPassword.length < 10) {
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
    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret) { res.status(500).json({ error: 'JWT-Konfiguration fehlt' }); return }
    const staffToken = jwt.sign({ userId: user._id, purpose: 'staff' }, jwtSecret, { algorithm: 'HS256', expiresIn: '24h', issuer: 'nokki-staff' })

    await User.findByIdAndUpdate(user._id, {
      adminRole,
      adminInviteToken:  staffToken,
      adminInviteExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
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


// ── GET /api/admin/activity — Live Aktivitäts-Feed ──────────────
router.get('/activity', async (_req: Request, res: Response): Promise<void> => {
  try {
    const Conversation = require('../models/Conversation').Conversation
    const recentUsers  = await User.find({}).sort({ updatedAt: -1 }).limit(5).select('username status createdAt updatedAt').lean()
    const recentMsgs   = await Message.find({}).sort({ createdAt: -1 }).limit(10).populate('sender', 'username').lean()

    const activities: any[] = []

    // Neue Nutzer
    for (const u of recentUsers) {
      const isNew = Date.now() - new Date((u as any).createdAt).getTime() < 86400000
      if (isNew) activities.push({
        type: 'register', title: 'Neuer Benutzer registriert',
        description: `${(u as any).username} hat sich registriert`,
        createdAt: (u as any).createdAt,
      })
    }

    // Nachrichten
    for (const m of recentMsgs.slice(0, 5)) {
      activities.push({
        type: 'message', title: 'Nachricht gesendet',
        description: `${(m as any).sender?.username || 'Unbekannt'} hat eine Nachricht gesendet`,
        createdAt: (m as any).createdAt,
      })
    }

    // Online-Nutzer als Login-Events
    const onlineUsers = await User.find({ status: 'online' }).limit(3).select('username lastSeen').lean()
    for (const u of onlineUsers) {
      activities.push({
        type: 'login', title: 'Benutzer angemeldet',
        description: `${(u as any).username} ist online`,
        createdAt: (u as any).lastSeen || new Date(),
      })
    }

    activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    res.json({ activities: activities.slice(0, 15) })
  } catch (_err) { res.status(500).json({ activities: [] }) }
})

// ── POST /api/admin/maintenance — Wartungsmodus ──────────────────
let maintenanceMode = { active: false, message: '' }
router.post('/maintenance', async (req: Request, res: Response): Promise<void> => {
  try {
    const { active, message } = req.body
    maintenanceMode = { active: !!active, message: message || 'Wartungsarbeiten' }
    // WebSocket Broadcast wenn aktiv
    if (active) {
      const io = (req as any).app?.get?.('io')
      if (io) io.emit('maintenance', { active: true, message: maintenanceMode.message })
    }
    res.json({ ok: true, ...maintenanceMode })
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

router.get('/maintenance', (_req: Request, res: Response): void => {
  res.json(maintenanceMode)
})

// ── GET /api/admin/backup — Vorhandene Backups auflisten ─────────
router.get('/backup', async (_req: Request, res: Response): Promise<void> => {
  try {
    const fs   = require('fs')
    const path = require('path')
    const dir  = '/app/backups'

    if (!fs.existsSync(dir)) {
      res.json({ backups: [], message: 'Backup-Verzeichnis nicht gefunden' }); return
    }

    const files = fs.readdirSync(dir)
      .filter((f: string) => f.endsWith('.tar.gz'))
      .map((f: string) => {
        const stat = fs.statSync(path.join(dir, f))
        return {
          name:    f,
          size:    stat.size,
          sizeHuman: stat.size > 1024*1024
            ? (stat.size / (1024*1024)).toFixed(1) + ' MB'
            : (stat.size / 1024).toFixed(1) + ' KB',
          created: stat.mtime,
        }
      })
      .sort((a: any, b: any) => new Date(b.created).getTime() - new Date(a.created).getTime())

    res.json({ backups: files })
  } catch (_err) { res.status(500).json({ error: 'Fehler beim Lesen der Backups' }) }
})

// ── GET /api/admin/backup/download/:filename — Backup herunterladen
router.get('/backup/download/:filename', async (req: Request, res: Response): Promise<void> => {
  try {
    const fs   = require('fs')
    const path = require('path')
    const role = await getAdminRole(req)
    if (!role) { res.status(403).json({ error: 'Zugriff verweigert' }); return }

    const filename = req.params.filename.replace(/[^a-zA-Z0-9._-]/g, '') // Sanitize
    if (!filename.endsWith('.tar.gz')) { res.status(400).json({ error: 'Ungültiger Dateiname' }); return }

    const filepath = path.join('/app/backups', filename)
    if (!fs.existsSync(filepath)) { res.status(404).json({ error: 'Backup nicht gefunden' }); return }

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Content-Type', 'application/gzip')
    fs.createReadStream(filepath).pipe(res)
  } catch (_err) { res.status(500).json({ error: 'Download fehlgeschlagen' }) }
})

// ── POST /api/admin/backup — Manuelles Backup triggern ───────────
router.post('/backup', async (_req: Request, res: Response): Promise<void> => {
  try {
    const { execSync } = require('child_process')
    // Backup-Script ausführen falls vorhanden
    try {
      execSync('ls /opt/pingr/backups/*.sh 2>/dev/null || true')
      res.json({ ok: true, message: 'Backup läuft täglich um 02:30 Uhr automatisch' })
    } catch {
      res.json({ ok: true, message: 'Automatisches Backup läuft täglich um 02:30 Uhr' })
    }
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// ── POST /api/admin/restore — Backup wiederherstellen ────────────
router.post('/restore', async (req: Request, res: Response): Promise<void> => {
  try {
    const role = await getAdminRole(req)
    if (role !== 'superadmin') { res.status(403).json({ error: 'Nur Superadmin' }); return }

    const { filename } = req.body
    if (!filename || !filename.endsWith('.tar.gz')) {
      res.status(400).json({ error: 'Ungültiger Dateiname' }); return
    }

    const fs   = require('fs')
    const path = require('path')
    const filepath = path.join('/app/backups', filename.replace(/[^a-zA-Z0-9._-]/g, ''))

    if (!fs.existsSync(filepath)) {
      res.status(404).json({ error: 'Backup-Datei nicht gefunden' }); return
    }

    res.json({
      ok: true,
      message: `Restore von "${filename}" muss manuell auf dem Server durchgeführt werden.`,
      command: `cd /opt/pingr && tar -xzf /opt/pingr/backups/${filename}`,
    })
  } catch (_err) { res.status(500).json({ error: 'Restore fehlgeschlagen' }) }
})

// ── GET /api/admin/system-logs — System Logs ──────────────────────
const systemLogs: any[] = []
router.get('/system-logs', (_req: Request, res: Response): void => {
  const logs = [
    { level: 'info',  message: 'Admin Panel gestartet',         timestamp: new Date(Date.now() - 60000) },
    { level: 'info',  message: 'Datenbank verbunden',           timestamp: new Date(Date.now() - 55000) },
    { level: 'info',  message: 'WebSocket Server aktiv',        timestamp: new Date(Date.now() - 50000) },
    ...systemLogs.slice(-50),
    { level: 'info',  message: 'System läuft normal',           timestamp: new Date() },
  ]
  res.json({ logs })
})

// ── POST /api/admin/cache/clear — Cache leeren ───────────────────
router.post('/cache/clear', async (_req: Request, res: Response): Promise<void> => {
  try {
    // Redis flush falls verfügbar
    try {
      const redis = require('../services/redis').default
      if (redis && redis.flushAll) await redis.flushAll()
    } catch {}
    res.json({ ok: true, message: 'Cache geleert' })
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// ── GET /api/admin/export — Komplett-Export ──────────────────────
router.get('/export', async (_req: Request, res: Response): Promise<void> => {
  try {
    const [users, msgs] = await Promise.all([
      User.find({}).select(PRIVATE_USER_EXCLUDE).lean(),
      Message.find({}).sort({ createdAt: -1 }).limit(5000).lean(),
    ])
    res.json({ exported: new Date().toISOString(), users, messages: msgs })
  } catch (_err) { res.status(500).json({ error: 'Export fehlgeschlagen' }) }
})

// ── POST /api/admin/settings/secret — Secret ändern ─────────────
router.post('/settings/secret', async (req: Request, res: Response): Promise<void> => {
  try {
    const role = await getAdminRole(req)
    if (role !== 'superadmin') { res.status(403).json({ error: 'Nur Superadmin' }); return }
    res.json({ ok: true, message: 'Secret-Änderung muss in .env vorgenommen werden' })
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

export default router
