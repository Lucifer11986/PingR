"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const Report_1 = require("../models/Report");
const User_1 = require("../models/User");
const mailer_1 = require("../utils/mailer");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
// POST /api/reports
router.post('/', async (req, res) => {
    try {
        const { reportedUserId, reportedMessageId, reportedGroupId, reason, description } = req.body;
        if (!reason) {
            res.status(400).json({ error: 'Grund fehlt' });
            return;
        }
        const report = await Report_1.Report.create({
            reporter: req.userId,
            reportedUser: reportedUserId,
            reportedMessage: reportedMessageId,
            reportedGroup: reportedGroupId,
            reason, description, autoDetected: false,
        });
        if (reportedUserId) {
            const user = await User_1.User.findByIdAndUpdate(reportedUserId, { $inc: { reportCount: 1 } }, { new: true });
            if (user && user.reportCount >= 5 && user.warningCount === 0) {
                await User_1.User.findByIdAndUpdate(reportedUserId, { $inc: { warningCount: 1 } });
            }
            if (user && user.reportCount >= 10 && !user.isBanned) {
                await User_1.User.findByIdAndUpdate(reportedUserId, {
                    isBanned: true,
                    bannedReason: 'Automatisch gesperrt aufgrund mehrfacher Meldungen.',
                });
            }
            // E-Mail an Admin
            (0, mailer_1.sendReportAlert)({
                reporterName: 'Nutzer',
                reportedName: user?.username || reportedUserId,
                reason,
                content: description || '(kein Kommentar)',
            }).catch(() => { });
        }
        res.status(201).json({ ok: true, reportId: report._id });
    }
    catch (_err) {
        res.status(500).json({ error: 'Serverfehler' });
    }
});
// GET /api/reports (Admin)
router.get('/', async (req, res) => {
    try {
        const reports = await Report_1.Report.find({ status: 'open' })
            .populate('reporter', 'username uin')
            .populate('reportedUser', 'username uin email isBanned reportCount warningCount')
            .populate('reportedMessage', 'content type sender')
            .sort({ createdAt: -1 }).limit(100);
        res.json(reports);
    }
    catch (_err) {
        res.status(500).json({ error: 'Serverfehler' });
    }
});
// PATCH /api/reports/:id/dismiss
router.patch('/:id/dismiss', async (req, res) => {
    try {
        await Report_1.Report.findByIdAndUpdate(req.params.id, { status: 'dismissed' });
        res.json({ ok: true });
    }
    catch (_err) {
        res.status(500).json({ error: 'Serverfehler' });
    }
});
exports.default = router;
