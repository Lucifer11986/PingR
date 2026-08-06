"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const auth_1 = require("../middleware/auth");
const rateLimiter_1 = require("../middleware/rateLimiter");
const contentFilter_1 = require("../utils/contentFilter");
const securityLogger_1 = require("../utils/securityLogger");
const Message_1 = require("../models/Message");
const Conversation_1 = require("../models/Conversation");
const Report_1 = require("../models/Report");
const User_1 = require("../models/User");
const upload_1 = require("../middleware/upload");
const socketServer_1 = require("../socket/socketServer");
const mongoose_1 = require("mongoose");
const redis_1 = require("../utils/redis");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
const TIMER_OPTIONS = {
    '30s': 30, '5m': 5 * 60, '1h': 60 * 60, '1d': 24 * 60 * 60, '7d': 7 * 24 * 60 * 60,
};
function getExpiresAt(timer) {
    if (!timer || !TIMER_OPTIONS[timer])
        return undefined;
    return new Date(Date.now() + TIMER_OPTIONS[timer] * 1000);
}
function getDeliverAt(deliverAt) {
    if (!deliverAt)
        return undefined;
    const d = new Date(deliverAt);
    if (isNaN(d.getTime()) || d <= new Date())
        return undefined;
    return d;
}
async function checkBan(userId, res) {
    const user = await User_1.User.findById(userId).select('isBanned bannedReason');
    if (user?.isBanned) {
        res.status(403).json({ error: `Konto gesperrt: ${user.bannedReason}` });
        return true;
    }
    return false;
}
// ── STATISCHE ROUTEN zuerst (vor /:id Wildcards) ──────────────
// GET /api/messages/search — Volltextsuche
router.get('/search', async (req, res) => {
    try {
        const { q, conversationId } = req.query;
        if (!q || q.length < 2) {
            res.json([]);
            return;
        }
        const filter = {
            content: { $regex: q, $options: 'i' }, deleted: false,
        };
        if (conversationId) {
            filter.conversationId = new mongoose_1.Types.ObjectId(conversationId);
        }
        else {
            const convs = await Conversation_1.Conversation.find({ participants: req.userId }).select('_id');
            filter.conversationId = { $in: convs.map(c => c._id) };
        }
        const messages = await Message_1.Message.find(filter)
            .populate('sender', '-password')
            .sort({ createdAt: -1 }).limit(30);
        res.json(messages);
    }
    catch (_err) {
        res.status(500).json({ error: 'Serverfehler' });
    }
});
// POST /api/messages/forward
router.post('/forward', rateLimiter_1.messageLimiter, async (req, res) => {
    // GET /api/messages/:conversationId — Nachrichten einer Conversation laden
    router.get("/:conversationId", async (req, res) => {
        try {
            const { conversationId } = req.params;
            const userId = req.userId;
            // Prüfe ob User Zugriff auf Conversation hat
            const conv = await Conversation_1.Conversation.findOne({
                _id: conversationId,
                participants: userId
            });
            if (!conv) {
                res.status(404).json({ error: "Conversation nicht gefunden" });
                return;
            }
            // Lade Nachrichten
            const messages = await Message_1.Message.find({
                conversationId,
                deleted: false
            })
                .populate("sender", "username avatar")
                .sort({ createdAt: -1 })
                .limit(100);
            res.json(messages.reverse());
        }
        catch (error) {
            console.error("GET messages error:", error);
            res.status(500).json({ error: "Server error" });
        }
    });
    try {
        if (await checkBan(req.userId, res))
            return;
        const { messageId, targetConversationId } = req.body;
        if (!messageId || !targetConversationId) {
            res.status(400).json({ error: 'messageId und targetConversationId erforderlich' });
            return;
        }
        const original = await Message_1.Message.findById(messageId);
        if (!original) {
            res.status(404).json({ error: 'Nachricht nicht gefunden' });
            return;
        }
        const message = await Message_1.Message.create({
            conversationId: targetConversationId, sender: req.userId,
            content: original.content, type: original.type,
            fileUrl: original.fileUrl, fileName: original.fileName,
            readBy: [req.userId],
        });
        const populated = await message.populate('sender', '-password');
        await Conversation_1.Conversation.findByIdAndUpdate(targetConversationId, { lastMessage: message._id, updatedAt: new Date() });
        (0, socketServer_1.getIO)().to(`conv:${targetConversationId}`).emit('new_message', populated);
        res.status(201).json(populated);
    }
    catch (_err) {
        res.status(500).json({ error: 'Serverfehler' });
    }
});
// POST /api/messages/upload
router.post('/upload', rateLimiter_1.messageLimiter, upload_1.upload.single('file'), async (req, res) => {
    try {
        if (await checkBan(req.userId, res))
            return;
        if (!req.file) {
            res.status(400).json({ error: 'Keine Datei' });
            return;
        }
        const fc = (0, contentFilter_1.filterFilename)(req.file.originalname);
        if (fc.blocked) {
            res.status(400).json({ error: fc.reason });
            return;
        }
        const { conversationId, duration, timer } = req.body;
        const isImage = req.file.mimetype.startsWith('image/');
        const isVoice = req.file.mimetype.startsWith('audio/');
        const message = await Message_1.Message.create({
            conversationId, sender: req.userId, content: '',
            type: isVoice ? 'voice' : isImage ? 'image' : 'file',
            fileUrl: `/uploads/${req.file.filename}`,
            fileName: req.file.originalname,
            duration: isVoice && duration ? parseFloat(duration) : undefined,
            readBy: [req.userId], expiresAt: getExpiresAt(timer),
        });
        const populated = await message.populate('sender', '-password');
        await Conversation_1.Conversation.findByIdAndUpdate(conversationId, { lastMessage: message._id, updatedAt: new Date() });
        (0, socketServer_1.getIO)().to(`conv:${conversationId}`).emit('new_message', populated);
        res.status(201).json(populated);
    }
    catch (_err) {
        res.status(500).json({ error: 'Upload fehlgeschlagen' });
    }
});
// POST /api/messages (Text-Nachricht senden)
router.post('/', rateLimiter_1.messageLimiter, async (req, res) => {
    try {
        if (await checkBan(req.userId, res))
            return;
        const { conversationId, content, type = 'text', timer, replyToId, deliverAt: rawDeliverAt, metadata } = req.body;
        const deliverAtDate = getDeliverAt(rawDeliverAt);
        const isTimeCapsule = !!deliverAtDate;
        if (!conversationId || !content) {
            res.status(400).json({ error: 'conversationId und content erforderlich' });
            return;
        }
        const fr = (0, contentFilter_1.filterContent)(content);
        if (fr.blocked) {
            if (['child_safety', 'extremism_certain', 'terrorism_certain'].includes(fr.category || '')) {
                await (0, securityLogger_1.logSecurityEvent)({
                    userId: req.userId, content,
                    eventType: fr.category === 'child_safety' ? 'csam' : fr.category === 'terrorism_certain' ? 'terrorism' : 'extremism',
                    legalBasis: fr.legalBasis || '',
                    conversationId, ipAddress: req.ip, userAgent: req.headers['user-agent'],
                }).catch(() => { });
                await User_1.User.findByIdAndUpdate(req.userId, { $inc: { warningCount: 1 } });
            }
            res.status(400).json({ error: fr.reason, blocked: true, category: fr.category });
            return;
        }
        const message = await Message_1.Message.create({
            conversationId, sender: req.userId, content, type,
            readBy: [req.userId], expiresAt: getExpiresAt(timer),
            replyTo: replyToId || undefined, flagged: fr.flagged || false,
            deliverAt: deliverAtDate,
            delivered: !isTimeCapsule,
            metadata,
        });
        if (fr.flagged) {
            await (0, securityLogger_1.logSecurityEvent)({
                userId: req.userId, content, eventType: 'flagged_review',
                legalBasis: fr.legalBasis || '§130 prüfungsbedürftig',
                conversationId, messageId: message._id.toString(), ipAddress: req.ip,
            }).catch(() => { });
        }
        const populated = await message.populate([
            { path: 'sender', select: '-password' }, { path: 'replyTo' }
        ]);
        // Zeitkapsel: Conversation NICHT updaten und NICHT per Socket senden
        if (!isTimeCapsule) {
            await Conversation_1.Conversation.findByIdAndUpdate(conversationId, { lastMessage: message._id, updatedAt: new Date() });
            (0, socketServer_1.getIO)().to(`conv:${conversationId}`).emit('new_message', populated);
            // 🔒 SECURITY FIX: Auto-Reply mit Redis Rate-Limiting
            try {
                const conv = await Conversation_1.Conversation.findById(conversationId);
                if (conv && !conv.isGroup) {
                    const { Identity } = require('../models/Identity');
                    // ✅ SPAM-SCHUTZ 1: Keine Auto-Reply auf Auto-Reply
                    if (metadata?.isAutoReply) {
                        console.log('[Auto-Reply] Skipped: incoming message is already auto-reply');
                    }
                    else {
                        // Finde die andere Partei
                        const otherId = conv.participants.find((p) => String(p) !== req.userId);
                        if (otherId) {
                            const otherIdent = await Identity.findOne({ userId: otherId, isActive: true });
                            if (otherIdent?.settings?.quietHoursFrom && otherIdent?.settings?.autoReply) {
                                const now = new Date();
                                const h = now.getHours() * 60 + now.getMinutes();
                                const [fh, fm] = otherIdent.settings.quietHoursFrom.split(':').map(Number);
                                const [th, tm] = (otherIdent.settings.quietHoursTo || '08:00').split(':').map(Number);
                                const from = fh * 60 + fm;
                                const to = th * 60 + tm;
                                const inQH = from > to ? (h >= from || h < to) : (h >= from && h < to);
                                if (inQH) {
                                    // ✅ SPAM-SCHUTZ 2: Redis Rate-Limiting (10 Minuten)
                                    const canSend = await (0, redis_1.checkAutoReplyRateLimit)(otherIdent._id.toString(), conversationId);
                                    if (canSend) {
                                        const autoMsg = await Message_1.Message.create({
                                            conversationId,
                                            sender: otherId,
                                            content: otherIdent.settings.autoReply,
                                            type: 'text',
                                            readBy: [otherId],
                                            metadata: { isAutoReply: true },
                                        });
                                        const autoPopulated = await autoMsg.populate('sender', '-password');
                                        await Conversation_1.Conversation.findByIdAndUpdate(conversationId, {
                                            lastMessage: autoMsg._id,
                                            updatedAt: new Date(),
                                        });
                                        (0, socketServer_1.getIO)().to(`conv:${conversationId}`).emit('new_message', autoPopulated);
                                        console.log(`[Auto-Reply] Sent for identity ${otherIdent._id}`);
                                    }
                                    else {
                                        console.log(`[Auto-Reply] Rate-limited (Redis key exists)`);
                                    }
                                }
                            }
                        }
                    }
                }
            }
            catch (e) {
                console.error('[Auto-Reply] Error:', e);
            }
        }
        res.status(201).json(populated);
    }
    catch (_err) {
        res.status(500).json({ error: 'Serverfehler' });
    }
}); // ── DYNAMISCHE ROUTEN /:id ────────────────────────────────────
// GET /api/messages?conversationId=...
router.get('/', async (req, res) => {
    try {
        const conversationId = req.query.conversationId;
        if (!conversationId) {
            res.status(400).json({ error: 'conversationId erforderlich' });
            return;
        }
        const messages = await Message_1.Message.find({ conversationId, deleted: false })
            .populate([
            { path: 'sender', select: '-password' },
            { path: 'replyTo', populate: { path: 'sender', select: 'username avatar' } }
        ]).sort({ createdAt: 1 });
        res.json(messages);
    }
    catch (_err) {
        res.status(500).json({ error: 'Serverfehler' });
    }
});
// PATCH /api/messages/:id/read
router.patch('/:id/read', async (req, res) => {
    try {
        const message = await Message_1.Message.findByIdAndUpdate(req.params.id, { $addToSet: { readBy: req.userId } }, { new: true }).populate('sender', '-password');
        if (!message) {
            res.status(404).json({ error: 'Nicht gefunden' });
            return;
        }
        (0, socketServer_1.getIO)().to(`conv:${message.conversationId}`).emit('message_read', {
            messageId: message._id, conversationId: message.conversationId, userId: req.userId,
        });
        res.json({ ok: true });
    }
    catch (_err) {
        res.status(500).json({ error: 'Serverfehler' });
    }
});
// PATCH /api/messages/:id/read-silent
router.patch('/:id/read-silent', async (req, res) => {
    try {
        await Message_1.Message.findByIdAndUpdate(req.params.id, { $addToSet: { seenSilently: req.userId } });
        res.json({ ok: true });
    }
    catch (_err) {
        res.status(500).json({ error: 'Serverfehler' });
    }
});
// PATCH /api/messages/:id/edit
router.patch('/:id/edit', async (req, res) => {
    try {
        const { content } = req.body;
        if (!content?.trim()) {
            res.status(400).json({ error: 'Inhalt fehlt' });
            return;
        }
        const fr = (0, contentFilter_1.filterContent)(content);
        if (fr.blocked) {
            res.status(400).json({ error: fr.reason });
            return;
        }
        const message = await Message_1.Message.findById(req.params.id).populate('sender', '-password');
        if (!message) {
            res.status(404).json({ error: 'Nicht gefunden' });
            return;
        }
        if (message.sender._id.toString() !== req.userId) {
            res.status(403).json({ error: 'Nicht erlaubt' });
            return;
        }
        if (Date.now() - new Date(message.createdAt).getTime() > 5 * 60 * 1000) {
            res.status(403).json({ error: 'Bearbeitungsfenster abgelaufen' });
            return;
        }
        message.content = content.trim();
        message.edited = true;
        message.editedAt = new Date();
        await message.save();
        (0, socketServer_1.getIO)().to(`conv:${message.conversationId}`).emit('message_edited', message);
        res.json(message);
    }
    catch (_err) {
        res.status(500).json({ error: 'Serverfehler' });
    }
});
// DELETE /api/messages/:id
router.delete('/:id', async (req, res) => {
    try {
        const message = await Message_1.Message.findById(req.params.id).populate('sender', '-password');
        if (!message) {
            res.status(404).json({ error: 'Nicht gefunden' });
            return;
        }
        if (message.sender._id.toString() !== req.userId) {
            res.status(403).json({ error: 'Nicht erlaubt' });
            return;
        }
        // Datei vom Server löschen (DSGVO: keine verwaisten Uploads)
        if (message.fileUrl) {
            try {
                const filePath = path_1.default.join('/app/uploads', path_1.default.basename(message.fileUrl));
                if (fs_1.default.existsSync(filePath)) {
                    fs_1.default.unlinkSync(filePath);
                }
            }
            catch (_fe) { /* Datei bereits gelöscht oder nicht gefunden */ }
        }
        message.deleted = true;
        message.content = '';
        message.fileUrl = undefined;
        message.fileName = undefined;
        await message.save();
        (0, socketServer_1.getIO)().to(`conv:${message.conversationId}`).emit('message_deleted', {
            messageId: message._id, conversationId: message.conversationId,
        });
        res.json({ ok: true });
    }
    catch (_err) {
        res.status(500).json({ error: 'Serverfehler' });
    }
});
// POST /api/messages/:id/reaction
router.post('/:id/reaction', async (req, res) => {
    try {
        const { emoji } = req.body;
        const message = await Message_1.Message.findById(req.params.id).populate('sender', '-password');
        if (!message) {
            res.status(404).json({ error: 'Nicht gefunden' });
            return;
        }
        const i = message.reactions.findIndex(r => r.userId.toString() === req.userId && r.emoji === emoji);
        if (i >= 0)
            message.reactions.splice(i, 1);
        else
            message.reactions.push({ emoji, userId: new mongoose_1.Types.ObjectId(req.userId), username: '' });
        await message.save();
        (0, socketServer_1.getIO)().to(`conv:${message.conversationId}`).emit('reaction_added', message);
        res.json(message);
    }
    catch (_err) {
        res.status(500).json({ error: 'Serverfehler' });
    }
});
// POST /api/messages/:id/report
router.post('/:id/report', async (req, res) => {
    try {
        const { reason, description } = req.body;
        if (!reason) {
            res.status(400).json({ error: 'Grund fehlt' });
            return;
        }
        let message = null;
        try {
            message = await Message_1.Message.findById(req.params.id);
        }
        catch (_err) {
            res.status(404).json({ error: 'Nachricht nicht gefunden' });
            return;
        }
        if (!message) {
            res.status(404).json({ error: 'Nachricht nicht gefunden' });
            return;
        }
        await Report_1.Report.create({
            reporter: req.userId,
            reportedUser: message.sender,
            reportedMessage: message._id,
            reason: reason,
            description: description || '',
            autoDetected: false,
            status: 'open',
        });
        await User_1.User.findByIdAndUpdate(message.sender, { $inc: { reportCount: 1 } });
        res.json({ ok: true, message: 'Meldung erfolgreich eingereicht' });
    }
    catch (err) {
        console.error('Report error:', err);
        res.status(500).json({ error: 'Serverfehler beim Melden' });
    }
});
// GET /api/messages/capsules/pending
router.get('/capsules/pending', async (req, res) => {
    try {
        const messages = await Message_1.Message.find({
            sender: req.userId,
            delivered: false,
            deleted: false,
            deliverAt: { $gt: new Date() },
        }).populate('sender', '-password').sort({ deliverAt: 1 });
        res.json(messages);
    }
    catch (_err) {
        res.status(500).json({ error: 'Serverfehler' });
    }
});
// DELETE /api/messages/capsules/:id
router.delete('/capsules/:id', async (req, res) => {
    try {
        const message = await Message_1.Message.findById(req.params.id);
        if (!message) {
            res.status(404).json({ error: 'Nicht gefunden' });
            return;
        }
        if (message.sender.toString() !== req.userId) {
            res.status(403).json({ error: 'Nicht erlaubt' });
            return;
        }
        if (message.delivered) {
            res.status(400).json({ error: 'Bereits zugestellt' });
            return;
        }
        message.deleted = true;
        await message.save();
        res.json({ ok: true });
    }
    catch (_err) {
        res.status(500).json({ error: 'Serverfehler' });
    }
});
exports.default = router;
