"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const auth_1 = require("../middleware/auth");
const User_1 = require("../models/User");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
const MAX_SOUNDS = 10;
const MAX_DURATION = 5; // Sekunden
const MAX_SIZE = 1 * 1024 * 1024; // 1 MB
// Speicherort
const soundsDir = path_1.default.join('/app/uploads/sounds');
if (!fs_1.default.existsSync(soundsDir))
    fs_1.default.mkdirSync(soundsDir, { recursive: true });
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => cb(null, soundsDir),
    filename: (req, file, cb) => {
        const ext = path_1.default.extname(file.originalname).toLowerCase();
        const name = `sound_${req.userId}_${Date.now()}${ext}`;
        cb(null, name);
    },
});
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: MAX_SIZE },
    fileFilter: (_req, file, cb) => {
        const allowed = ['.mp3', '.wav', '.ogg', '.m4a', '.webm'];
        const ext = path_1.default.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext))
            cb(null, true);
        else
            cb(new Error('Nur Audiodateien erlaubt (mp3, wav, ogg, m4a, webm)'));
    },
});
// GET /api/sounds — eigene Sounds abrufen
router.get('/', async (req, res) => {
    try {
        const user = await User_1.User.findById(req.userId).select('customSounds');
        res.json(user?.customSounds || []);
    }
    catch (_err) {
        res.status(500).json({ error: 'Serverfehler' });
    }
});
// POST /api/sounds — Sound hochladen
router.post('/', upload.single('sound'), async (req, res) => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'Keine Datei' });
            return;
        }
        const user = await User_1.User.findById(req.userId).select('customSounds');
        const sounds = user?.customSounds || [];
        if (sounds.length >= MAX_SOUNDS) {
            fs_1.default.unlinkSync(req.file.path);
            res.status(400).json({ error: `Maximal ${MAX_SOUNDS} eigene Sounds erlaubt` });
            return;
        }
        const label = (req.body.label || req.file.originalname).slice(0, 30);
        const newSound = {
            id: `custom_${Date.now()}`,
            label,
            url: `/uploads/sounds/${req.file.filename}`,
            size: req.file.size,
            uploadedAt: new Date(),
        };
        sounds.push(newSound);
        await User_1.User.findByIdAndUpdate(req.userId, { customSounds: sounds });
        res.status(201).json(newSound);
    }
    catch (err) {
        if (req.file && fs_1.default.existsSync(req.file.path))
            fs_1.default.unlinkSync(req.file.path);
        res.status(400).json({ error: err.message || 'Upload fehlgeschlagen' });
    }
});
// DELETE /api/sounds/:id — Sound löschen
router.delete('/:id', async (req, res) => {
    try {
        const user = await User_1.User.findById(req.userId).select('customSounds');
        const sounds = user?.customSounds || [];
        const sound = sounds.find((s) => s.id === req.params.id);
        if (!sound) {
            res.status(404).json({ error: 'Nicht gefunden' });
            return;
        }
        // Datei löschen
        try {
            const filePath = path_1.default.join('/app', sound.url);
            if (fs_1.default.existsSync(filePath))
                fs_1.default.unlinkSync(filePath);
        }
        catch (_e) { }
        const updated = sounds.filter((s) => s.id !== req.params.id);
        await User_1.User.findByIdAndUpdate(req.userId, { customSounds: updated });
        res.json({ ok: true });
    }
    catch (_err) {
        res.status(500).json({ error: 'Serverfehler' });
    }
});
exports.default = router;
