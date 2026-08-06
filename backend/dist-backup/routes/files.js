"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const upload_1 = require("../middleware/upload");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
// POST /api/files/upload  – allgemeiner Datei-Upload (gibt URL zurück)
router.post('/upload', upload_1.upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'Keine Datei' });
            return;
        }
        res.json({
            url: `/uploads/${req.file.filename}`,
            name: req.file.originalname,
            size: req.file.size,
            mime: req.file.mimetype,
        });
    }
    catch {
        res.status(500).json({ error: 'Upload fehlgeschlagen' });
    }
});
exports.default = router;
