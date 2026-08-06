"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const User_1 = require("../models/User");
const Message_1 = require("../models/Message");
const Conversation_1 = require("../models/Conversation");
const router = (0, express_1.Router)();
// GET /api/public/stats — Live-Statistiken für die Landing Page (kein Auth nötig)
router.get('/stats', async (_req, res) => {
    try {
        const [totalUsers, online, totalMessages, totalGroups] = await Promise.all([
            User_1.User.countDocuments(),
            User_1.User.countDocuments({ status: 'online' }),
            Message_1.Message.countDocuments({ deleted: false }),
            Conversation_1.Conversation.countDocuments({ isGroup: true }),
        ]);
        res.set('Cache-Control', 'public, max-age=30');
        res.json({ totalUsers, online, totalMessages, totalGroups });
    }
    catch {
        res.json({ totalUsers: 0, online: 0, totalMessages: 0, totalGroups: 0 });
    }
});
exports.default = router;
