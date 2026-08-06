"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyTOTP = verifyTOTP;
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const auth_1 = require("../middleware/auth");
const User_1 = require("../models/User");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
// ── TOTP Implementierung ──────────────────────────────────────────────────────
function generateSecret() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let s = '';
    const b = crypto_1.default.randomBytes(20);
    for (let i = 0; i < 32; i++)
        s += chars[b[i % 20] % 32];
    return s;
}
function base32Decode(str) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = 0, value = 0;
    const out = [];
    for (const c of str.toUpperCase().replace(/=+$/, '')) {
        value = (value << 5) | chars.indexOf(c);
        bits += 5;
        if (bits >= 8) {
            out.push((value >>> (bits - 8)) & 255);
            bits -= 8;
        }
    }
    return Buffer.from(out);
}
function verifyTOTP(secret, token) {
    const now = Math.floor(Date.now() / 1000 / 30);
    for (const delta of [-1, 0, 1]) {
        const time = now + delta;
        const key = base32Decode(secret);
        const buf = Buffer.alloc(8);
        buf.writeUInt32BE(0, 0);
        buf.writeUInt32BE(time, 4);
        const hmac = crypto_1.default.createHmac('sha1', key).update(buf).digest();
        const offset = hmac[19] & 0xf;
        const code = (((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3]) % 1000000;
        if (String(code).padStart(6, '0') === token)
            return true;
    }
    return false;
}
// ── GET /api/2fa/setup ────────────────────────────────────────────────────────
router.get('/setup', async (req, res) => {
    try {
        const user = await User_1.User.findById(req.userId).select('username');
        if (!user) {
            res.status(404).json({ error: 'Nicht gefunden' });
            return;
        }
        const secret = generateSecret();
        const issuer = 'PingR';
        const account = encodeURIComponent(`${user.username}@pingr`);
        const otpauth = `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauth)}`;
        const backupCodes = Array.from({ length: 8 }, () => crypto_1.default.randomBytes(4).toString('hex').toUpperCase());
        await User_1.User.findByIdAndUpdate(req.userId, {
            twoFactorSecret: secret,
            twoFactorBackup: backupCodes.map(c => crypto_1.default.createHash('sha256').update(c).digest('hex')),
            twoFactorEnabled: false,
        });
        res.json({ secret, qrUrl, backupCodes, otpauth });
    }
    catch (err) {
        res.status(500).json({ error: String(err) });
    }
});
// ── POST /api/2fa/verify-setup ───────────────────────────────────────────────
router.post('/verify-setup', async (req, res) => {
    try {
        const { token } = req.body;
        const user = await User_1.User.findById(req.userId).select('twoFactorSecret');
        if (!user || !user.twoFactorSecret) {
            res.status(400).json({ error: '2FA-Setup nicht gestartet' });
            return;
        }
        if (!verifyTOTP(user.twoFactorSecret, String(token))) {
            res.status(400).json({ error: 'Ungültiger Code' });
            return;
        }
        await User_1.User.findByIdAndUpdate(req.userId, { twoFactorEnabled: true });
        res.json({ ok: true, message: '2FA aktiviert!' });
    }
    catch (err) {
        res.status(500).json({ error: String(err) });
    }
});
// ── POST /api/2fa/disable ────────────────────────────────────────────────────
router.post('/disable', async (req, res) => {
    try {
        const { token } = req.body;
        const user = await User_1.User.findById(req.userId).select('twoFactorSecret twoFactorEnabled');
        if (!user || !user.twoFactorEnabled) {
            res.status(400).json({ error: '2FA nicht aktiv' });
            return;
        }
        if (!verifyTOTP(user.twoFactorSecret, String(token))) {
            res.status(400).json({ error: 'Ungültiger Code' });
            return;
        }
        await User_1.User.findByIdAndUpdate(req.userId, {
            twoFactorEnabled: false,
            twoFactorSecret: undefined,
            twoFactorBackup: undefined,
        });
        res.json({ ok: true, message: '2FA deaktiviert.' });
    }
    catch (err) {
        res.status(500).json({ error: String(err) });
    }
});
exports.default = router;
