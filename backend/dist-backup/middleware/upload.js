"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.upload = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
// Nur sichere Dateiendungen
const SAFE_EXTENSIONS = new Set([
    '.jpg', '.jpeg', '.png', '.gif', '.webp',
    '.pdf', '.txt', '.zip',
    '.doc', '.docx',
    '.webm', '.ogg', '.mp4', '.wav', '.mp3', '.m4a',
]);
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => cb(null, 'uploads/'),
    filename: (_req, file, cb) => {
        // Dateiendung sanitizen — nur bekannte Endungen erlauben
        const ext = path_1.default.extname(file.originalname).toLowerCase();
        const safeExt = SAFE_EXTENSIONS.has(ext) ? ext : '.bin';
        // Zufälliger Name — kein Bezug zum Original (Datenschutz)
        const uniqueName = `${Date.now()}-${crypto_1.default.randomBytes(12).toString('hex')}${safeExt}`;
        cb(null, uniqueName);
    },
});
const fileFilter = (_req, file, cb) => {
    // MIME-Type prüfen
    const allowed = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf', 'text/plain',
        'application/zip', 'application/x-zip-compressed',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/wav',
        'audio/mpeg', 'audio/mp3', 'audio/x-m4a',
    ];
    // Doppelte Dateiendung blockieren (z.B. malware.php.jpg)
    const originalName = file.originalname || '';
    const dotCount = (originalName.match(/\./g) || []).length;
    if (dotCount > 1) {
        cb(new Error('Dateiname mit mehreren Endungen nicht erlaubt'));
        return;
    }
    if (allowed.includes(file.mimetype)) {
        cb(null, true);
    }
    else {
        cb(new Error(`Dateityp nicht erlaubt: ${file.mimetype}`));
    }
};
exports.upload = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50 MB
        files: 1, // Max 1 Datei pro Request
        fieldSize: 1 * 1024 * 1024, // Max 1 MB für Formular-Felder
    },
});
