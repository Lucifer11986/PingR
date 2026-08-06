"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mongoose_1 = __importDefault(require("mongoose"));
const router = (0, express_1.Router)();
// Admin-Auth Middleware
function adminAuth(req, res, next) {
    const secret = req.headers['x-admin-secret'];
    if (!secret || secret !== process.env.ADMIN_SECRET) {
        res.status(403).json({ error: 'Zugriff verweigert' });
        return;
    }
    next();
}
router.use((req, res, next) => adminAuth(req, res, next));
// Erlaubte Collections (Sicherheits-Whitelist)
const ALLOWED = [
    'users', 'messages', 'conversations', 'contacts',
    'legacyclaims', 'reports', 'securitylogs', 'polls',
];
// Felder die niemals zurückgegeben werden (Sicherheit)
const HIDDEN_FIELDS = {
    password: 0, emailVerifyToken: 0, emailVerifyExpires: 0,
    resetToken: 0, resetTokenExpires: 0, twoFactorSecret: 0,
    twoFactorBackup: 0, emailToken: 0,
};
function getCollection(name) {
    if (!ALLOWED.includes(name))
        return null;
    return mongoose_1.default.connection.collection(name);
}
// ── GET /api/admin/db/:col — Liste mit Pagination & Suche ─────────────────
router.get('/db/:col', async (req, res) => {
    try {
        const col = getCollection(req.params.col);
        if (!col) {
            res.status(400).json({ error: 'Collection nicht erlaubt' });
            return;
        }
        const page = Math.max(1, parseInt(String(req.query.page || '1')));
        const limit = Math.min(50, parseInt(String(req.query.limit || '20')));
        const q = String(req.query.q || '').trim();
        // Einfache Suche: "feld:wert" → { feld: /wert/i }
        let filter = {};
        if (q) {
            if (q.includes(':')) {
                const [field, ...rest] = q.split(':');
                const val = rest.join(':').trim();
                // Versuche ObjectId
                try {
                    filter[field.trim()] = new mongoose_1.default.Types.ObjectId(val);
                }
                catch {
                    filter[field.trim()] = { $regex: val, $options: 'i' };
                }
            }
            else {
                // Freitextsuche über username, email, content, name
                filter.$or = [
                    { username: { $regex: q, $options: 'i' } },
                    { email: { $regex: q, $options: 'i' } },
                    { content: { $regex: q, $options: 'i' } },
                    { groupName: { $regex: q, $options: 'i' } },
                ];
            }
        }
        const [docs, total] = await Promise.all([
            col.find(filter, { projection: HIDDEN_FIELDS })
                .sort({ createdAt: -1, _id: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .toArray(),
            col.countDocuments(filter),
        ]);
        res.json({ docs, total, page, pages: Math.ceil(total / limit) });
    }
    catch (err) {
        res.status(500).json({ error: String(err) });
    }
});
// ── GET /api/admin/db/:col/:id — Einzelnes Dokument ───────────────────────
router.get('/db/:col/:id', async (req, res) => {
    try {
        const col = getCollection(req.params.col);
        if (!col) {
            res.status(400).json({ error: 'Collection nicht erlaubt' });
            return;
        }
        let id;
        try {
            id = new mongoose_1.default.Types.ObjectId(req.params.id);
        }
        catch {
            id = req.params.id;
        }
        const doc = await col.findOne({ _id: id }, { projection: HIDDEN_FIELDS });
        if (!doc) {
            res.status(404).json({ error: 'Nicht gefunden' });
            return;
        }
        res.json(doc);
    }
    catch (err) {
        res.status(500).json({ error: String(err) });
    }
});
// ── POST /api/admin/db/:col — Neues Dokument anlegen ──────────────────────
router.post('/db/:col', async (req, res) => {
    try {
        const col = getCollection(req.params.col);
        if (!col) {
            res.status(400).json({ error: 'Collection nicht erlaubt' });
            return;
        }
        // Sensible Felder aus Body entfernen
        const body = { ...req.body };
        Object.keys(HIDDEN_FIELDS).forEach(k => delete body[k]);
        delete body._id; // Neue _id generieren lassen
        body.createdAt = new Date();
        body.updatedAt = new Date();
        const result = await col.insertOne(body);
        res.json({ ok: true, insertedId: result.insertedId });
    }
    catch (err) {
        res.status(500).json({ error: String(err) });
    }
});
// ── PUT /api/admin/db/:col/:id — Dokument aktualisieren ───────────────────
router.put('/db/:col/:id', async (req, res) => {
    try {
        const col = getCollection(req.params.col);
        if (!col) {
            res.status(400).json({ error: 'Collection nicht erlaubt' });
            return;
        }
        let id;
        try {
            id = new mongoose_1.default.Types.ObjectId(req.params.id);
        }
        catch {
            id = req.params.id;
        }
        // _id und sensible Felder dürfen nicht überschrieben werden
        const body = { ...req.body };
        delete body._id;
        Object.keys(HIDDEN_FIELDS).forEach(k => delete body[k]);
        body.updatedAt = new Date();
        const result = await col.updateOne({ _id: id }, { $set: body });
        if (!result.matchedCount) {
            res.status(404).json({ error: 'Nicht gefunden' });
            return;
        }
        res.json({ ok: true, modified: result.modifiedCount });
    }
    catch (err) {
        res.status(500).json({ error: String(err) });
    }
});
// ── DELETE /api/admin/db/:col/:id — Dokument löschen ─────────────────────
router.delete('/db/:col/:id', async (req, res) => {
    try {
        const col = getCollection(req.params.col);
        if (!col) {
            res.status(400).json({ error: 'Collection nicht erlaubt' });
            return;
        }
        let id;
        try {
            id = new mongoose_1.default.Types.ObjectId(req.params.id);
        }
        catch {
            id = req.params.id;
        }
        // Sicherheit: Users dürfen nicht direkt aus DB-Explorer gelöscht werden
        // (nur über /api/admin/users/:id mit Cascade)
        if (req.params.col === 'users') {
            res.status(403).json({ error: 'User-Löschung nur über den Nutzer-Tab möglich (mit Cascade)' });
            return;
        }
        const result = await col.deleteOne({ _id: id });
        if (!result.deletedCount) {
            res.status(404).json({ error: 'Nicht gefunden' });
            return;
        }
        res.json({ ok: true });
    }
    catch (err) {
        res.status(500).json({ error: String(err) });
    }
});
exports.default = router;
