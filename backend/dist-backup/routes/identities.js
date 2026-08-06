"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const Identity_1 = require("../models/Identity");
const User_1 = require("../models/User");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
// Hilfsfunktion: zufällige UIN generieren (8-stellig)
async function generateUIN() {
    let uin;
    let exists = true;
    while (exists) {
        uin = String(Math.floor(10000000 + Math.random() * 90000000));
        const userExists = await User_1.User.findOne({ uin });
        const identityExists = await Identity_1.Identity.findOne({ uin });
        exists = !!(userExists || identityExists);
    }
    return uin;
}
// GET /api/identities — Alle Identitäten des Users
router.get('/', async (req, res) => {
    try {
        const identities = await Identity_1.Identity.find({ userId: req.userId }).sort({ createdAt: 1 });
        res.json(identities);
    }
    catch (_err) {
        res.status(500).json({ error: 'Serverfehler' });
    }
});
// POST /api/identities — Neue Identität erstellen
router.post('/', async (req, res) => {
    try {
        const { type, username, bio } = req.body;
        if (!['private', 'work', 'anonymous'].includes(type)) {
            res.status(400).json({ error: 'Ungültiger Typ (private/work/anonymous)' });
            return;
        }
        if (!username?.trim()) {
            res.status(400).json({ error: 'Nutzername erforderlich' });
            return;
        }
        // Max 5 Identitäten pro User
        const count = await Identity_1.Identity.countDocuments({ userId: req.userId });
        if (count >= 5) {
            res.status(400).json({ error: 'Maximal 5 Identitäten erlaubt' });
            return;
        }
        // Anonyme Identität: max 1
        if (type === 'anonymous') {
            const anonExists = await Identity_1.Identity.findOne({ userId: req.userId, type: 'anonymous' });
            if (anonExists) {
                res.status(400).json({ error: 'Nur eine anonyme Identität erlaubt' });
                return;
            }
        }
        const uin = await generateUIN();
        const isFirst = count === 0;
        const identity = await Identity_1.Identity.create({
            userId: req.userId,
            type,
            uin,
            username: username.trim(),
            bio: bio?.trim() || '',
            isDefault: isFirst,
            isActive: isFirst,
            settings: {
                notifications: true,
                newChatLimit: type === 'anonymous' ? 10 : 100,
            },
        });
        res.status(201).json(identity);
    }
    catch (_err) {
        res.status(500).json({ error: 'Serverfehler' });
    }
});
// POST /api/identities/:id/switch — Zu Identität wechseln
router.post('/:id/switch', async (req, res) => {
    try {
        const identity = await Identity_1.Identity.findOne({ _id: req.params.id, userId: req.userId });
        if (!identity) {
            res.status(404).json({ error: 'Identität nicht gefunden' });
            return;
        }
        // Alle anderen deaktivieren
        await Identity_1.Identity.updateMany({ userId: req.userId }, { isActive: false });
        identity.isActive = true;
        await identity.save();
        res.json({ ok: true, identity });
    }
    catch (_err) {
        res.status(500).json({ error: 'Serverfehler' });
    }
});
// PATCH /api/identities/:id — Identität bearbeiten
router.patch('/:id', async (req, res) => {
    try {
        const { username, bio, avatar, settings } = req.body;
        const identity = await Identity_1.Identity.findOne({ _id: req.params.id, userId: req.userId });
        if (!identity) {
            res.status(404).json({ error: 'Nicht gefunden' });
            return;
        }
        if (username)
            identity.username = username.trim();
        if (bio !== undefined)
            identity.bio = bio.trim();
        if (avatar !== undefined)
            identity.avatar = avatar;
        if (settings)
            identity.settings = { ...identity.settings, ...settings };
        await identity.save();
        res.json(identity);
    }
    catch (_err) {
        res.status(500).json({ error: 'Serverfehler' });
    }
});
// DELETE /api/identities/:id — Identität löschen
router.delete('/:id', async (req, res) => {
    try {
        const identity = await Identity_1.Identity.findOne({ _id: req.params.id, userId: req.userId });
        if (!identity) {
            res.status(404).json({ error: 'Nicht gefunden' });
            return;
        }
        if (identity.isDefault) {
            res.status(400).json({ error: 'Standard-Identität kann nicht gelöscht werden' });
            return;
        }
        await identity.deleteOne();
        // Falls aktive Identität gelöscht → auf Default wechseln
        if (identity.isActive) {
            await Identity_1.Identity.findOneAndUpdate({ userId: req.userId, isDefault: true }, { isActive: true });
        }
        res.json({ ok: true });
    }
    catch (_err) {
        res.status(500).json({ error: 'Serverfehler' });
    }
});
// GET /api/identities/active — Aktive Identität
router.get('/active', async (req, res) => {
    try {
        const identity = await Identity_1.Identity.findOne({ userId: req.userId, isActive: true });
        if (!identity) {
            // Fallback: Default nehmen
            const def = await Identity_1.Identity.findOne({ userId: req.userId, isDefault: true });
            res.json(def);
            return;
        }
        res.json(identity);
    }
    catch (_err) {
        res.status(500).json({ error: 'Serverfehler' });
    }
});
exports.default = router;
