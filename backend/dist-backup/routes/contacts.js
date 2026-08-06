"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const Contact_1 = require("../models/Contact");
const User_1 = require("../models/User");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
// GET /api/contacts
router.get('/', async (req, res) => {
    try {
        // Aktive Identity aus Middleware
        const identityFilter = req.activeIdentityId
            ? { $or: [
                    { owner: req.userId, identityId: req.activeIdentityId },
                    { owner: req.userId, identityId: { $exists: false } },
                ] }
            : { owner: req.userId };
        const contacts = await Contact_1.Contact.find(identityFilter)
            .populate('user', '-password')
            .sort({ addedAt: -1 });
        res.json(contacts);
    }
    catch (_err) {
        res.status(500).json({ error: 'Serverfehler' });
    }
});
// POST /api/contacts  – Kontakt per UIN hinzufügen
router.post('/', async (req, res) => {
    try {
        const { uin } = req.body;
        if (!uin) {
            res.status(400).json({ error: 'UIN fehlt' });
            return;
        }
        const targetUser = await User_1.User.findOne({ uin });
        if (!targetUser) {
            res.status(404).json({ error: 'UIN nicht gefunden' });
            return;
        }
        if (targetUser._id.toString() === req.userId) {
            res.status(400).json({ error: 'Du kannst dich nicht selbst hinzufügen' });
            return;
        }
        const exists = await Contact_1.Contact.findOne({ owner: req.userId, user: targetUser._id });
        if (exists) {
            res.status(409).json({ error: 'Kontakt bereits vorhanden' });
            return;
        }
        const contact = await Contact_1.Contact.create({
            owner: req.userId,
            user: targetUser._id,
            identityId: req.activeIdentityId || undefined,
        });
        const populated = await contact.populate('user', '-password');
        res.status(201).json(populated);
    }
    catch (_err) {
        res.status(500).json({ error: 'Serverfehler' });
    }
});
// DELETE /api/contacts/:id
router.delete('/:id', async (req, res) => {
    try {
        await Contact_1.Contact.findOneAndDelete({ _id: req.params.id, owner: req.userId });
        res.json({ ok: true });
    }
    catch (_err) {
        res.status(500).json({ error: 'Serverfehler' });
    }
});
exports.default = router;
