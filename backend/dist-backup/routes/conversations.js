"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const contentFilter_1 = require("../utils/contentFilter");
const Conversation_1 = require("../models/Conversation");
const upload_1 = require("../middleware/upload");
const mongoose_1 = require("mongoose");
const crypto_1 = __importDefault(require("crypto"));
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
// GET /api/conversations
router.get('/', async (req, res) => {
    try {
        // Aktive Identity aus Middleware
        const identityId = req.activeIdentityId || null;
        // Filter: nach identityId ODER userId (Rückwärtskompatibilität)
        const filter = identityId
            ? { $or: [
                    { identityParticipants: identityId },
                    { participants: req.userId, identityParticipants: { $size: 0 } },
                    { participants: req.userId, identityParticipants: { $exists: false } },
                ] }
            : { participants: req.userId };
        const convs = await Conversation_1.Conversation.find(filter)
            .populate('participants', '-password')
            .populate('lastMessage')
            .sort({ updatedAt: -1 });
        // FIX: Stelle sicher dass isGroup korrekt gesetzt ist
        // Wenn groupName vorhanden ist, muss isGroup true sein
        const fixed = convs.map((c) => {
            const obj = c.toObject();
            // Korrigiere isGroup falls inkonsistent
            if (obj.groupName && !obj.isGroup) {
                obj.isGroup = true;
            }
            return obj;
        });
        res.json(fixed);
    }
    catch (_err) {
        res.status(500).json({ error: 'Serverfehler' });
    }
});
// POST /api/conversations — 1:1 Chat
router.post('/', async (req, res) => {
    try {
        const { participantId } = req.body;
        if (!participantId) {
            res.status(400).json({ error: 'participantId fehlt' });
            return;
        }
        const meId = new mongoose_1.Types.ObjectId(req.userId);
        const otherId = new mongoose_1.Types.ObjectId(participantId);
        let conv = await Conversation_1.Conversation.findOne({
            isGroup: false,
            participants: { $all: [meId, otherId], $size: 2 },
        }).populate('participants', '-password').populate('lastMessage');
        if (!conv) {
            // Anonym-Profil: Chat-Limit prüfen
            if (req.activeIdentityId) {
                try {
                    const { Identity } = require('../models/Identity');
                    const ident = await Identity.findById(req.activeIdentityId);
                    if (ident?.type === 'anonymous') {
                        const limit = ident.settings?.newChatLimit || 10;
                        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
                        const count = await Conversation_1.Conversation.countDocuments({
                            identityParticipants: req.activeIdentityId, createdAt: { $gte: since }, isGroup: false,
                        });
                        if (count >= limit) {
                            res.status(429).json({ error: `Chat-Limit: max. ${limit} neue Chats/24h für anonyme Identitäten` });
                            return;
                        }
                    }
                }
                catch (_le) { }
            }
            conv = await Conversation_1.Conversation.create({
                participants: [meId, otherId],
                isGroup: false,
                identityParticipants: req.activeIdentityId ? [req.activeIdentityId] : [],
            });
            conv = await conv.populate('participants', '-password');
        }
        res.json(conv);
    }
    catch (_err) {
        res.status(500).json({ error: 'Serverfehler' });
    }
});
// POST /api/conversations/group — Gruppe erstellen
router.post('/group', async (req, res) => {
    try {
        const { groupName, participantIds, isPublic } = req.body;
        const nameCheck = (0, contentFilter_1.filterGroupName)(groupName || '');
        if (nameCheck.blocked) {
            res.status(400).json({ error: nameCheck.reason });
            return;
        }
        const members = [
            new mongoose_1.Types.ObjectId(req.userId),
            ...(participantIds || []).map((id) => new mongoose_1.Types.ObjectId(id)),
        ];
        const joinCode = isPublic ? crypto_1.default.randomBytes(6).toString('hex') : undefined;
        const conv = await Conversation_1.Conversation.create({
            participants: members,
            isGroup: true,
            groupName: groupName.trim(),
            isPublic: !!isPublic,
            joinCode,
            admins: [new mongoose_1.Types.ObjectId(req.userId)],
        });
        const populated = await conv.populate('participants', '-password');
        res.status(201).json(populated);
    }
    catch (_err) {
        res.status(500).json({ error: 'Serverfehler' });
    }
});
// GET /api/conversations/join/:code
router.get('/join/:code', async (req, res) => {
    try {
        const conv = await Conversation_1.Conversation.findOne({ joinCode: req.params.code, isPublic: true })
            .populate('participants', '-password');
        if (!conv) {
            res.status(404).json({ error: 'Gruppe nicht gefunden' });
            return;
        }
        const isMember = conv.participants.some((p) => p._id.toString() === req.userId);
        if (!isMember) {
            conv.participants.push(new mongoose_1.Types.ObjectId(req.userId));
            await conv.save();
            await conv.populate('participants', '-password');
            // Socket: User benachrichtigen dass er einer Gruppe beigetreten ist
            try {
                const { getIO } = require('../socket/socketServer');
                getIO().to(req.userId).emit('group_joined', { conversationId: conv._id });
            }
            catch (_se) { }
        }
        res.json(conv);
    }
    catch (_err) {
        res.status(500).json({ error: 'Serverfehler' });
    }
});
// GET /api/conversations/public
router.get('/public', async (req, res) => {
    try {
        const q = req.query.q;
        const popular = req.query.popular === 'true';
        const filter = { isGroup: true, isPublic: true };
        if (q)
            filter.groupName = { $regex: q, $options: 'i' };
        const groups = await Conversation_1.Conversation.find(filter)
            .populate('participants', 'username avatar status')
            .limit(popular ? 10 : 20)
            .sort(popular ? {} : { updatedAt: -1 });
        // Nach Mitgliederzahl sortieren für "Beliebt"
        const sorted = popular
            ? [...groups].sort((a, b) => b.participants.length - a.participants.length)
            : groups;
        res.json(sorted);
    }
    catch (_err) {
        res.status(500).json({ error: 'Serverfehler' });
    }
});
// GET /api/conversations/:id
router.get('/:id', async (req, res) => {
    try {
        const conv = await Conversation_1.Conversation.findById(req.params.id)
            .populate('participants', '-password')
            .populate('lastMessage');
        if (!conv) {
            res.status(404).json({ error: 'Nicht gefunden' });
            return;
        }
        const isMember = conv.participants.some((p) => p._id.toString() === req.userId);
        if (!isMember) {
            res.status(403).json({ error: 'Kein Mitglied' });
            return;
        }
        const obj = conv.toObject();
        if (obj.groupName && !obj.isGroup)
            obj.isGroup = true;
        res.json(obj);
    }
    catch (_err) {
        res.status(500).json({ error: 'Serverfehler' });
    }
});
// PATCH /api/conversations/:id/settings — Gruppeneinstellungen
router.patch('/:id/settings', async (req, res) => {
    try {
        const { groupName, isPublic, description, adminOnly, slowMode, maxMembers, requireApproval } = req.body;
        const conv = await Conversation_1.Conversation.findById(req.params.id);
        if (!conv) {
            res.status(404).json({ error: 'Nicht gefunden' });
            return;
        }
        const isAdmin = conv.admins?.some((a) => a.toString() === req.userId)
            || conv.participants[0]?.toString() === req.userId;
        if (!isAdmin) {
            res.status(403).json({ error: 'Nur Admins können Einstellungen ändern' });
            return;
        }
        if (groupName?.trim()) {
            const nameCheck = (0, contentFilter_1.filterGroupName)(groupName);
            if (nameCheck.blocked) {
                res.status(400).json({ error: nameCheck.reason });
                return;
            }
            conv.groupName = groupName.trim();
        }
        if (typeof isPublic === 'boolean') {
            conv.isPublic = isPublic;
            if (isPublic && !conv.joinCode) {
                conv.joinCode = crypto_1.default.randomBytes(6).toString('hex');
            }
        }
        if (description !== undefined)
            conv.description = String(description).slice(0, 300);
        if (typeof adminOnly === 'boolean')
            conv.adminOnly = adminOnly;
        if (slowMode !== undefined)
            conv.slowMode = Math.max(0, Number(slowMode));
        if (maxMembers !== undefined)
            conv.maxMembers = Math.min(500, Math.max(2, Number(maxMembers)));
        if (typeof requireApproval === 'boolean')
            conv.requireApproval = requireApproval;
        conv.isGroup = true;
        await conv.save();
        const populated = await conv.populate('participants', '-password');
        const obj = populated.toObject ? populated.toObject() : populated;
        obj.isGroup = true;
        res.json(obj);
    }
    catch (_err) {
        res.status(500).json({ error: 'Serverfehler' });
    }
});
// POST /api/conversations/:id/kick
router.post('/:id/kick', async (req, res) => {
    try {
        const { userId } = req.body;
        const conv = await Conversation_1.Conversation.findById(req.params.id);
        if (!conv) {
            res.status(404).json({ error: 'Nicht gefunden' });
            return;
        }
        const isAdmin = conv.admins?.some((a) => a.toString() === req.userId)
            || conv.participants[0]?.toString() === req.userId;
        if (!isAdmin) {
            res.status(403).json({ error: 'Nur Admins können Mitglieder entfernen' });
            return;
        }
        if (userId === req.userId) {
            res.status(400).json({ error: 'Kannst dich nicht selbst entfernen' });
            return;
        }
        conv.participants = conv.participants.filter((p) => p.toString() !== userId);
        await conv.save();
        const populated = await conv.populate('participants', '-password');
        res.json(populated);
    }
    catch (_err) {
        res.status(500).json({ error: 'Serverfehler' });
    }
});
// POST /api/conversations/:id/promote
router.post('/:id/promote', async (req, res) => {
    try {
        const { userId } = req.body;
        const conv = await Conversation_1.Conversation.findById(req.params.id);
        if (!conv) {
            res.status(404).json({ error: 'Nicht gefunden' });
            return;
        }
        const isAdmin = conv.admins?.some((a) => a.toString() === req.userId)
            || conv.participants[0]?.toString() === req.userId;
        if (!isAdmin) {
            res.status(403).json({ error: 'Nur Admins können befördern' });
            return;
        }
        if (!conv.admins)
            conv.admins = [];
        if (!conv.admins.some((a) => a.toString() === userId)) {
            conv.admins.push(new mongoose_1.Types.ObjectId(userId));
            await conv.save();
        }
        const populated = await conv.populate('participants', '-password');
        res.json(populated);
    }
    catch (_err) {
        res.status(500).json({ error: 'Serverfehler' });
    }
});
// DELETE /api/conversations/:id/leave
router.delete('/:id/leave', async (req, res) => {
    try {
        const conv = await Conversation_1.Conversation.findById(req.params.id);
        if (!conv) {
            res.status(404).json({ error: 'Nicht gefunden' });
            return;
        }
        conv.participants = conv.participants.filter((p) => p.toString() !== req.userId);
        if (conv.admins) {
            conv.admins = conv.admins.filter((a) => a.toString() !== req.userId);
            if (conv.admins.length === 0 && conv.participants.length > 0) {
                conv.admins = [conv.participants[0]];
            }
        }
        await conv.save();
        res.json({ ok: true });
    }
    catch (_err) {
        res.status(500).json({ error: 'Serverfehler' });
    }
});
// PATCH /api/conversations/:id/add (backward compat)
router.patch('/:id/add', async (req, res) => {
    try {
        const { userId } = req.body;
        const conv = await Conversation_1.Conversation.findById(req.params.id);
        if (!conv) {
            res.status(404).json({ error: 'Nicht gefunden' });
            return;
        }
        const maxM = conv.maxMembers || 100;
        if (conv.participants.length >= maxM) {
            res.status(400).json({ error: `Gruppe ist voll (max. ${maxM} Mitglieder)` });
            return;
        }
        if (!conv.participants.some((p) => p.toString() === userId)) {
            conv.participants.push(new mongoose_1.Types.ObjectId(userId));
            await conv.save();
        }
        const populated = await conv.populate('participants', '-password');
        res.json(populated);
    }
    catch (_err) {
        res.status(500).json({ error: 'Serverfehler' });
    }
});
// POST /api/conversations/:id/add — Mitglied hinzufügen (Admin)
router.post('/:id/add', async (req, res) => {
    try {
        const { userId } = req.body;
        const conv = await Conversation_1.Conversation.findById(req.params.id);
        if (!conv) {
            res.status(404).json({ error: 'Nicht gefunden' });
            return;
        }
        const isAdmin = conv.admins?.some((a) => a.toString() === req.userId)
            || conv.participants[0]?.toString() === req.userId;
        if (!isAdmin) {
            res.status(403).json({ error: 'Nur Admins können Mitglieder hinzufügen' });
            return;
        }
        const maxM = conv.maxMembers || 100;
        if (conv.participants.length >= maxM) {
            res.status(400).json({ error: `Gruppe ist voll (max. ${maxM} Mitglieder)` });
            return;
        }
        if (!conv.participants.some((p) => p.toString() === userId)) {
            conv.participants.push(new mongoose_1.Types.ObjectId(userId));
            await conv.save();
        }
        const populated = await conv.populate('participants', '-password');
        res.json(populated);
    }
    catch (_err) {
        res.status(500).json({ error: 'Serverfehler' });
    }
});
// POST /api/conversations/:id/add — Mitglied hinzufügen (mit Admin-Check)
router.post('/:id/add', async (req, res) => {
    try {
        const { userId } = req.body;
        const conv = await Conversation_1.Conversation.findById(req.params.id);
        if (!conv) {
            res.status(404).json({ error: 'Nicht gefunden' });
            return;
        }
        const isAdmin = conv.admins?.some((a) => a.toString() === req.userId)
            || conv.participants[0]?.toString() === req.userId;
        if (!isAdmin) {
            res.status(403).json({ error: 'Nur Admins können Mitglieder hinzufügen' });
            return;
        }
        const maxM = conv.maxMembers || 100;
        if (conv.participants.length >= maxM) {
            res.status(400).json({ error: `Gruppe ist voll (max. ${maxM} Mitglieder)` });
            return;
        }
        if (!conv.participants.some((p) => p.toString() === userId)) {
            conv.participants.push(new mongoose_1.Types.ObjectId(userId));
            await conv.save();
        }
        const populated = await conv.populate('participants', '-password');
        res.json(populated);
    }
    catch (_err) {
        res.status(500).json({ error: 'Serverfehler' });
    }
});
// ── DELETE /api/conversations/:id — Chat löschen (DM) oder Gruppe löschen (Admin) ──
router.delete('/:id', async (req, res) => {
    try {
        const conv = await Conversation_1.Conversation.findOne({ _id: req.params.id, participants: req.userId });
        if (!conv) {
            res.status(404).json({ error: 'Nicht gefunden' });
            return;
        }
        const { Message } = require('../models/Message');
        if (conv.isGroup) {
            // Gruppe: nur Ersteller darf löschen
            const admins = conv.admins || [];
            const isCreator = admins.length === 0
                ? conv.participants[0]?.toString() === req.userId
                : conv.admins[0]?.toString() === req.userId;
            if (!isCreator) {
                res.status(403).json({ error: 'Nur der Gruppen-Ersteller darf die Gruppe löschen' });
                return;
            }
        }
        await Message.deleteMany({ conversationId: req.params.id });
        await Conversation_1.Conversation.findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    }
    catch (err) {
        res.status(500).json({ error: String(err) });
    }
});
// ── PATCH /api/conversations/:id/avatar — Gruppen-Bild hochladen ─────────────
router.patch('/:id/avatar', upload_1.upload.single('avatar'), async (req, res) => {
    try {
        const conv = await Conversation_1.Conversation.findOne({
            _id: req.params.id,
            isGroup: true,
            $or: [{ admins: req.userId }, { participants: req.userId }],
        });
        if (!conv) {
            res.status(404).json({ error: 'Gruppe nicht gefunden' });
            return;
        }
        if (!req.file) {
            res.status(400).json({ error: 'Kein Bild' });
            return;
        }
        const avatarUrl = `/uploads/${req.file.filename}`;
        await Conversation_1.Conversation.findByIdAndUpdate(req.params.id, { groupAvatar: avatarUrl });
        // Socket: alle Mitglieder informieren
        try {
            const { getIO } = require('../socket/socketServer');
            getIO().to(req.params.id).emit('conversation_updated', { conversationId: req.params.id });
        }
        catch (_se) { }
        res.json({ ok: true, avatarUrl });
    }
    catch (err) {
        res.status(500).json({ error: String(err) });
    }
});
// ── POST /api/conversations/:id/pin/:msgId ────────────────────────────────────
router.post('/:id/pin/:msgId', async (req, res) => {
    try {
        const conv = await Conversation_1.Conversation.findOne({ _id: req.params.id, participants: req.userId });
        if (!conv) {
            res.status(404).json({ error: 'Nicht gefunden' });
            return;
        }
        const pins = conv.pinnedMessages || [];
        const msgId = req.params.msgId;
        const idx = pins.indexOf(msgId);
        if (idx === -1) {
            pins.unshift(msgId); // Vorne anhängen
            if (pins.length > 5)
                pins.pop(); // Max 5 angepinnte
        }
        else {
            pins.splice(idx, 1); // Entpinnen
        }
        await Conversation_1.Conversation.findByIdAndUpdate(req.params.id, { pinnedMessages: pins });
        // Socket: alle informieren
        try {
            const { getIO } = require('../socket/socketServer');
            getIO().to(req.params.id).emit('pins_updated', { conversationId: req.params.id, pins });
        }
        catch (_se) { }
        res.json({ ok: true, pins, pinned: idx === -1 });
    }
    catch (err) {
        res.status(500).json({ error: String(err) });
    }
});
// ── GET /api/conversations/:id/pins ──────────────────────────────────────────
router.get('/:id/pins', async (req, res) => {
    try {
        const conv = await Conversation_1.Conversation.findOne({ _id: req.params.id, participants: req.userId })
            .select('pinnedMessages');
        if (!conv) {
            res.status(404).json({ error: 'Nicht gefunden' });
            return;
        }
        const pins = conv.pinnedMessages || [];
        if (!pins.length) {
            res.json([]);
            return;
        }
        const { Message } = require('../models/Message');
        const messages = await Message.find({ _id: { $in: pins }, deleted: false })
            .populate('sender', 'username avatar')
            .lean();
        // Reihenfolge beibehalten
        const sorted = pins
            .map((id) => messages.find((m) => m._id.toString() === id))
            .filter(Boolean);
        res.json(sorted);
    }
    catch (err) {
        res.status(500).json({ error: String(err) });
    }
});
// ── POST /api/conversations/:id/demote — Admin degradieren ───────────────
router.post('/:id/demote', async (req, res) => {
    try {
        const { userId } = req.body;
        const conv = await Conversation_1.Conversation.findById(req.params.id);
        if (!conv) {
            res.status(404).json({ error: 'Nicht gefunden' });
            return;
        }
        const admins = conv.admins || [];
        const isCreator = admins.length === 0
            ? conv.participants[0]?.toString() === req.userId
            : conv.admins[0]?.toString() === req.userId;
        if (!isCreator) {
            res.status(403).json({ error: 'Nur der Gruppen-Ersteller darf Admins entfernen' });
            return;
        }
        conv.admins = (conv.admins || []).filter((a) => a.toString() !== userId);
        await conv.save();
        const populated = await conv.populate('participants', '-password');
        res.json(populated);
    }
    catch (_err) {
        res.status(500).json({ error: 'Serverfehler' });
    }
});
// ── POST /api/conversations/:id/mute — Mitglied stummschalten ────────────
router.post('/:id/mute', async (req, res) => {
    try {
        const { userId, minutes } = req.body;
        const conv = await Conversation_1.Conversation.findById(req.params.id);
        if (!conv) {
            res.status(404).json({ error: 'Nicht gefunden' });
            return;
        }
        const isAdmin = conv.admins?.some((a) => a.toString() === req.userId)
            || conv.participants[0]?.toString() === req.userId;
        if (!isAdmin) {
            res.status(403).json({ error: 'Nur Admins' });
            return;
        }
        const mutedUntil = new Date(Date.now() + Number(minutes) * 60 * 1000);
        if (!conv.muteList)
            conv.muteList = [];
        const existing = conv.muteList.findIndex((m) => m.userId.toString() === String(userId));
        if (existing >= 0) {
            conv.muteList[existing].mutedUntil = mutedUntil;
        }
        else {
            conv.muteList.push({ userId: new mongoose_1.Types.ObjectId(userId), mutedUntil });
        }
        conv.markModified('muteList');
        await conv.save();
        res.json({ ok: true, mutedUntil });
    }
    catch (_err) {
        res.status(500).json({ error: 'Serverfehler' });
    }
});
// ── DELETE /api/conversations/:id/messages — Chat leeren (nur Nachrichten) ─
router.delete('/:id/messages', async (req, res) => {
    try {
        const conv = await Conversation_1.Conversation.findOne({ _id: req.params.id, participants: req.userId });
        if (!conv) {
            res.status(404).json({ error: 'Nicht gefunden' });
            return;
        }
        const isAdmin = conv.admins?.some((a) => a.toString() === req.userId)
            || conv.participants[0]?.toString() === req.userId;
        if (!isAdmin) {
            res.status(403).json({ error: 'Nur Admins' });
            return;
        }
        const { Message } = require('../models/Message');
        await Message.deleteMany({ conversationId: req.params.id });
        conv.lastMessage = undefined;
        await conv.save();
        // Socket: alle informieren
        try {
            const { getIO } = require('../socket/socketServer');
            getIO().to(req.params.id).emit('chat_cleared', { conversationId: req.params.id });
        }
        catch (_se) { }
        res.json({ ok: true });
    }
    catch (_err) {
        res.status(500).json({ error: 'Serverfehler' });
    }
});
exports.default = router;
