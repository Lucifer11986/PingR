"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const Report_1 = require("../models/Report");
const User_1 = require("../models/User");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
// POST /api/reports – Inhalt melden
router.post('/', async (req, res) => {
    try {
        const { reportedUserId, reportedMessageId, reportedGroupId, reason, description } = req.body;
        if (!reason) {
            res.status(400).json({ error: 'Grund fehlt' });
            return;
        }
        if (!reportedUserId && !reportedMessageId && !reportedGroupId) {
            res.status(400).json({ error: 'Kein Ziel angegeben' });
            return;
        }
        const report = await Report_1.Report.create({
            reporter: req.userId,
            reportedUser: reportedUserId,
            reportedMessage: reportedMessageId,
            reportedGroup: reportedGroupId,
            reason,
            description,
            autoDetected: false,
        });
        // Gemeldeten User-Counter erhöhen
        if (reportedUserId) {
            const user = await User_1.User.findByIdAndUpdate(reportedUserId, { $inc: { reportCount: 1 } }, { new: true });
            // Auto-Warnung bei vielen Meldungen
            if (user && user.reportCount >= 5 && user.warningCount === 0) {
                await User_1.User.findByIdAndUpdate(reportedUserId, { $inc: { warningCount: 1 } });
            }
            // Auto-Ban bei kritischer Anzahl Meldungen (10+)
            if (user && user.reportCount >= 10 && !user.isBanned) {
                await User_1.User.findByIdAndUpdate(reportedUserId, {
                    isBanned: true,
                    bannedReason: 'Automatisch gesperrt aufgrund mehrfacher Meldungen. Wird überprüft.',
                });
            }
        }
        res.status(201).json({ ok: true, reportId: report._id });
    }
    catch (_err) {
        res.status(500).json({ error: 'Serverfehler' });
    }
});
// GET /api/reports – (Admin) Alle offenen Meldungen
router.get('/', async (req, res) => {
    try {
        const reports = await Report_1.Report.find({ status: 'open' })
            .populate('reporter', 'username uin')
            .populate('reportedUser', 'username uin email isBanned reportCount')
            .populate('reportedMessage', 'content type sender')
            .sort({ createdAt: -1 })
            .limit(100);
        res.json(reports);
    }
    catch (_err) {
        res.status(500).json({ error: 'Serverfehler' });
    }
});
exports.default = router;
