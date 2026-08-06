"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const Message_1 = require("../models/Message");
const Conversation_1 = require("../models/Conversation");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
// GET /api/export/:conversationId?format=txt|json
router.get('/:conversationId', async (req, res) => {
    try {
        const { conversationId } = req.params;
        const format = req.query.format || 'txt';
        // Prüfen ob User Mitglied ist
        const conv = await Conversation_1.Conversation.findOne({
            _id: conversationId,
            participants: req.userId,
        }).populate('participants', 'username uin');
        if (!conv) {
            res.status(404).json({ error: 'Nicht gefunden' });
            return;
        }
        const messages = await Message_1.Message.find({
            conversationId,
            deleted: false,
        })
            .populate('sender', 'username uin')
            .sort({ createdAt: 1 })
            .limit(10000)
            .lean();
        const convName = conv.isGroup
            ? conv.groupName
            : `Chat_${conversationId.slice(-6)}`;
        const filename = `PingR_${convName}_${new Date().toISOString().slice(0, 10)}`;
        if (format === 'json') {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
            res.json({
                conversation: {
                    id: conversationId,
                    name: convName,
                    exportedAt: new Date().toISOString(),
                },
                messages: messages.map((m) => ({
                    id: m._id,
                    sender: m.sender?.username || 'Unbekannt',
                    content: m.content || '',
                    type: m.type,
                    createdAt: m.createdAt,
                    edited: m.edited || false,
                })),
            });
            return;
        }
        // TXT Format
        const lines = [
            `PingR Chat-Export`,
            `Gespräch: ${convName}`,
            `Exportiert: ${new Date().toLocaleString('de-DE')}`,
            `Nachrichten: ${messages.length}`,
            `${'─'.repeat(60)}`,
            '',
        ];
        messages.forEach((m) => {
            const sender = m.sender?.username || 'Unbekannt';
            const time = new Date(m.createdAt).toLocaleString('de-DE', {
                day: '2-digit', month: '2-digit', year: '2-digit',
                hour: '2-digit', minute: '2-digit',
            });
            const content = m.deleted ? '[Nachricht gelöscht]'
                : m.type === 'voice' ? '[Sprachnachricht]'
                    : m.type === 'file' ? `[Datei: ${m.fileName || ''}]`
                        : m.content || '';
            lines.push(`[${time}] ${sender}: ${content}`);
            if (m.edited)
                lines[lines.length - 1] += ' (bearbeitet)';
        });
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.txt"`);
        res.send(lines.join('\n'));
    }
    catch (err) {
        res.status(500).json({ error: String(err) });
    }
});
exports.default = router;
