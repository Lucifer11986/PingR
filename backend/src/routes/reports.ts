import { Router, Response } from 'express'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { Report } from '../models/Report'
import { User } from '../models/User'
import { sendReportAlert } from '../utils/mailer'

const router = Router()
router.use(authMiddleware)

// POST /api/reports
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { reportedUserId, reportedMessageId, reportedGroupId, reason, description } = req.body
    if (!reason) { res.status(400).json({ error: 'Grund fehlt' }); return }

    const report = await Report.create({
      reporter:        req.userId,
      reportedUser:    reportedUserId,
      reportedMessage: reportedMessageId,
      reportedGroup:   reportedGroupId,
      reason, description, autoDetected: false,
    })

    if (reportedUserId) {
      const user = await User.findByIdAndUpdate(
        reportedUserId, { $inc: { reportCount: 1 } }, { new: true }
      )
      if (user && user.reportCount >= 5 && user.warningCount === 0) {
        await User.findByIdAndUpdate(reportedUserId, { $inc: { warningCount: 1 } })
      }
      if (user && user.reportCount >= 10 && !user.isBanned) {
        await User.findByIdAndUpdate(reportedUserId, {
          isBanned: true,
          bannedReason: 'Automatisch gesperrt aufgrund mehrfacher Meldungen.',
        })
      }
      // E-Mail an Admin
      sendReportAlert({
        reporterName: 'Nutzer',
        reportedName: user?.username || reportedUserId,
        reason,
        content: description || '(kein Kommentar)',
      }).catch(() => {})
    }

    res.status(201).json({ ok: true, reportId: report._id })
  } catch (_err) {
    res.status(500).json({ error: 'Serverfehler' })
  }
})

// GET /api/reports (Admin)
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const reports = await Report.find({ status: 'open' })
      .populate('reporter', 'username uin')
      .populate('reportedUser', 'username uin email isBanned reportCount warningCount')
      .populate('reportedMessage', 'content type sender')
      .sort({ createdAt: -1 }).limit(100)
    res.json(reports)
  } catch (_err) {
    res.status(500).json({ error: 'Serverfehler' })
  }
})

// PATCH /api/reports/:id/dismiss
router.patch('/:id/dismiss', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await Report.findByIdAndUpdate(req.params.id, { status: 'dismissed' })
    res.json({ ok: true })
  } catch (_err) {
    res.status(500).json({ error: 'Serverfehler' })
  }
})

export default router