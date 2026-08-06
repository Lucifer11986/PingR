"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const User_1 = require("../models/User");
const Message_1 = require("../models/Message");
const Conversation_1 = require("../models/Conversation");
const router = (0, express_1.Router)();
function adminAuth(req, res, next) {
    if (req.headers['x-admin-secret'] !== process.env.ADMIN_SECRET) {
        res.status(403).json({ error: 'Forbidden' });
        return;
    }
    next();
}
router.use((req, res, next) => adminAuth(req, res, next));
// GET /api/admin/charts — Chartdaten für Dashboard
router.get('/charts', async (_req, res) => {
    try {
        const now = new Date();
        const day30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const day7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        // Registrierungen der letzten 30 Tage nach Tag
        const regPipeline = [
            { $match: { createdAt: { $gte: day30 } } },
            { $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    count: { $sum: 1 },
                } },
            { $sort: { _id: 1 } },
        ];
        const regStats = await User_1.User.aggregate(regPipeline);
        // Nachrichten der letzten 7 Tage nach Tag
        const msgPipeline = [
            { $match: { createdAt: { $gte: day7 }, deleted: false } },
            { $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    count: { $sum: 1 },
                } },
            { $sort: { _id: 1 } },
        ];
        const msgStats = await Message_1.Message.aggregate(msgPipeline);
        // Top aktive Nutzer (meiste Nachrichten)
        const topUsersPipeline = [
            { $match: { createdAt: { $gte: day30 }, deleted: false } },
            { $group: { _id: '$sender', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 },
            { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
            { $unwind: '$user' },
            { $project: { username: '$user.username', uin: '$user.uin', count: 1 } },
        ];
        const topUsers = await Message_1.Message.aggregate(topUsersPipeline);
        // Top Gruppen (meiste Mitglieder)
        const topGroups = await Conversation_1.Conversation.find({ isGroup: true })
            .select('groupName participants groupAvatar')
            .sort({ 'participants.length': -1 })
            .limit(5)
            .lean();
        // Gesamtzahlen
        const [totalUsers, totalMessages, totalGroups, activeToday] = await Promise.all([
            User_1.User.countDocuments(),
            Message_1.Message.countDocuments({ deleted: false }),
            Conversation_1.Conversation.countDocuments({ isGroup: true }),
            User_1.User.countDocuments({
                lastSeen: { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) }
            }),
        ]);
        // Nachrichten-Typen Verteilung
        const typePipeline = [
            { $group: { _id: '$type', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
        ];
        const typeStats = await Message_1.Message.aggregate(typePipeline);
        res.json({
            totals: { totalUsers, totalMessages, totalGroups, activeToday },
            registrations: regStats,
            messages: msgStats,
            topUsers,
            topGroups: topGroups.map((g) => ({
                name: g.groupName,
                members: g.participants?.length || 0,
                avatar: g.groupAvatar,
            })),
            messageTypes: typeStats,
        });
    }
    catch (err) {
        res.status(500).json({ error: String(err) });
    }
});
exports.default = router;
