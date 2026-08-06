"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const User_1 = require("../models/User");
const auth_1 = require("../middleware/auth");
const helpers_1 = require("../utils/helpers");
const emailValidator_1 = require("../utils/emailValidator");
const deviceDetector_1 = require("../utils/deviceDetector");
const ipBlacklist_1 = require("../middleware/ipBlacklist");
const fieldEncryption_1 = require("../utils/fieldEncryption");
const mailer_1 = require("../utils/mailer");
const router = (0, express_1.Router)();
// ── TOTP inline ───────────────────────────────────────────────────────────────
function base32Decode(s) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = 0, value = 0;
    const out = [];
    for (const c of s.toUpperCase().replace(/=+$/, '')) {
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
    try {
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
    }
    catch (_e) { }
    return false;
}
function getIP(req) {
    try {
        // x-forwarded-for zuerst — Nginx setzt diesen Header mit der echten Client-IP
        const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
        const realIP = String(req.headers['x-real-ip'] || '').trim();
        const raw = forwarded
            || realIP
            || req.ip
            || req.socket?.remoteAddress
            || 'unknown';
        return raw.replace('::ffff:', '').trim() || 'unknown';
    }
    catch (_e) {
        return 'unknown';
    }
}
// ── GET /api/auth/captcha — CAPTCHA generieren ───────────────────────────────
const captchaStore = new Map();
router.get('/captcha', (req, res) => {
    const a = Math.floor(Math.random() * 10) + 1;
    const b = Math.floor(Math.random() * 10) + 1;
    const id = require('crypto').randomBytes(8).toString('hex');
    captchaStore.set(id, { answer: a + b, expiresAt: Date.now() + 10 * 60 * 1000 });
    // Alte CAPTCHAs aufräumen
    for (const [k, v] of captchaStore.entries()) {
        if (Date.now() > v.expiresAt)
            captchaStore.delete(k);
    }
    res.json({ id, question: `${a} + ${b} = ?` });
});
// ── POST /api/auth/captcha/verify — CAPTCHA prüfen ──────────────────────────
router.post('/captcha/verify', (req, res) => {
    const { id, answer } = req.body;
    const captcha = captchaStore.get(id);
    if (!captcha || Date.now() > captcha.expiresAt) {
        res.status(400).json({ valid: false, error: 'CAPTCHA abgelaufen' });
        return;
    }
    const valid = parseInt(String(answer)) === captcha.answer;
    if (valid)
        captchaStore.delete(id);
    res.json({ valid });
});
// ── POST /api/auth/register ───────────────────────────────────────────────────
router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        if (!username?.trim() || !email?.trim() || !password) {
            res.status(400).json({ error: 'Alle Felder erforderlich' });
            return;
        }
        const emailCheck = (0, emailValidator_1.validateEmail)(email);
        if (!emailCheck.valid) {
            res.status(400).json({ error: emailCheck.reason });
            return;
        }
        if (String(password).length < 6) {
            res.status(400).json({ error: 'Passwort min. 6 Zeichen' });
            return;
        }
        const exists = await User_1.User.findOne({ email: email.toLowerCase().trim() });
        if (exists) {
            res.status(409).json({ error: 'E-Mail bereits vergeben' });
            return;
        }
        let deviceStr = 'desktop | Unbekannt | Unbekannt';
        let ipAddr = 'unknown';
        try {
            const device = (0, deviceDetector_1.detectDevice)(req.headers['user-agent'] || '');
            deviceStr = `${device.deviceType} | ${device.os} | ${device.browser} ${device.browserVersion}`.trim();
            ipAddr = getIP(req);
        }
        catch (_de) { }
        const uin = await (0, helpers_1.generateUIN)();
        const hashed = await bcryptjs_1.default.hash(String(password), 12);
        const user = await User_1.User.create({
            uin,
            username: String(username).trim(),
            email: email.toLowerCase().trim(),
            password: hashed,
            lastDevice: deviceStr,
            lastIP: (0, fieldEncryption_1.encryptField)(ipAddr),
            status: 'offline',
        });
        // Verifizierungs-Token generieren
        const verifyToken = crypto_1.default.randomBytes(32).toString('hex');
        const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
        await User_1.User.findByIdAndUpdate(user._id, {
            emailVerifyToken: verifyToken,
            emailVerifyExpires: verifyExpires,
            emailVerified: false,
        });
        // E-Mail senden (non-blocking, non-fatal)
        (0, mailer_1.sendVerificationEmail)(user.email, user.username, verifyToken, user.uin).then(sent => {
            if (!sent)
                console.log(`[Register] No SMTP configured — verify token: ${verifyToken}`);
        });
        const token = jsonwebtoken_1.default.sign({ userId: user._id }, process.env.JWT_SECRET || 'secret', { expiresIn: '30d' });
        res.status(201).json({
            token,
            emailVerified: false,
            user: { _id: user._id, uin: user.uin, username: user.username, email: user.email, status: user.status, emailVerified: false },
        });
    }
    catch (err) {
        console.error('[Register] Error:', err);
        res.status(500).json({ error: 'Serverfehler bei der Registrierung' });
    }
});
// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', ipBlacklist_1.checkIPBlacklist, async (req, res) => {
    try {
        const { login, password, twoFaCode } = req.body;
        if (!login || !password) {
            res.status(400).json({ error: 'Login und Passwort erforderlich' });
            return;
        }
        // Device + IP ermitteln (non-fatal)
        let deviceStr = 'desktop | Unbekannt | Unbekannt';
        let ipAddr = 'unknown';
        let deviceType = 'desktop';
        let deviceOS = 'Unbekannt';
        let deviceBrowser = 'Unbekannt';
        try {
            const device = (0, deviceDetector_1.detectDevice)(String(req.headers['user-agent'] || ''));
            deviceStr = `${device.deviceType} | ${device.os} | ${device.browser} ${device.browserVersion}`.trim();
            deviceType = device.deviceType;
            deviceOS = device.os;
            deviceBrowser = `${device.browser} ${device.browserVersion}`.trim();
            ipAddr = getIP(req);
        }
        catch (_de) { }
        // User finden
        const loginStr = String(login).trim();
        const isUIN = /^\d+$/.test(loginStr);
        const query = isUIN ? { uin: loginStr } : { email: loginStr.toLowerCase() };
        const user = await User_1.User.findOne(query);
        if (!user) {
            res.status(401).json({ error: 'UIN/E-Mail oder Passwort falsch' });
            return;
        }
        // Passwort prüfen
        const ok = await bcryptjs_1.default.compare(String(password), user.password);
        if (!ok) {
            (0, ipBlacklist_1.recordFailedAttempt)(ipAddr);
            res.status(401).json({ error: 'UIN/E-Mail oder Passwort falsch' });
            return;
        }
        // Gebannt?
        if (user.isBanned) {
            res.status(403).json({ error: `Konto gesperrt: ${user.bannedReason || 'Verstoß gegen AGB'}` });
            return;
        }
        // 2FA prüfen
        if (user.twoFactorEnabled && user.twoFactorSecret) {
            if (!twoFaCode) {
                res.status(200).json({ requires2FA: true });
                return;
            }
            if (!verifyTOTP(String(user.twoFactorSecret), String(twoFaCode))) {
                res.status(401).json({ error: 'Ungültiger 2FA-Code' });
                return;
            }
        }
        // Status + Device + IP aktualisieren
        try {
            await User_1.User.findByIdAndUpdate(user._id, {
                status: 'online',
                lastSeen: new Date(),
                lastDevice: deviceStr,
                lastIP: ipAddr,
            });
        }
        catch (_ue) {
            console.error('[Login] User update error (non-fatal):', _ue);
        }
        // Login-History (vollständig optional)
        try {
            const { LoginHistory } = require('../models/LoginHistory');
            LoginHistory.create({
                userId: user._id, ipAddress: ipAddr,
                device: deviceType, os: deviceOS, browser: deviceBrowser,
                timestamp: new Date(), success: true,
            });
        }
        catch (_lhe) { /* optional */ }
        const token = jsonwebtoken_1.default.sign({ userId: user._id }, process.env.JWT_SECRET || 'secret', { expiresIn: '30d' });
        (0, ipBlacklist_1.clearAttempts)(ipAddr);
        // Login-Alert: bei neuer IP, nur wenn Gerät nicht als vertrauenswürdig markiert
        try {
            const lastIP = user.lastIP;
            const trustedToken = req.body.trustedDeviceToken;
            const trustedDevices = user.trustedDevices || [];
            const isTrusted = trustedToken && trustedDevices.includes(trustedToken);
            if (!isTrusted && lastIP && lastIP !== 'unknown' && lastIP !== ipAddr && user.email) {
                (0, mailer_1.sendLoginAlert)({
                    email: user.email,
                    username: user.username,
                    ip: ipAddr,
                    device: deviceType,
                    os: deviceOS,
                    browser: deviceBrowser,
                    time: new Date(),
                }).catch(() => { });
            }
        }
        catch (_ae) { }
        console.log(`[Login] OK: ${user.username} | ${ipAddr} | ${deviceStr}`);
        res.json({
            token,
            user: {
                _id: user._id,
                uin: user.uin,
                username: user.username,
                email: user.email,
                status: 'online',
                avatar: user.avatar || null,
            },
        });
    }
    catch (err) {
        console.error('[Login] FATAL Error:', err);
        res.status(500).json({ error: 'Serverfehler beim Login. Bitte erneut versuchen.' });
    }
});
// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', auth_1.authMiddleware, async (req, res) => {
    try {
        const user = await User_1.User.findById(req.userId).select('-password -twoFactorSecret -twoFactorBackup');
        if (!user) {
            res.status(404).json({ error: 'Nicht gefunden' });
            return;
        }
        res.json(user);
    }
    catch (_err) {
        res.status(500).json({ error: 'Serverfehler' });
    }
});
// ── POST /api/auth/forgot-password ───────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            res.status(400).json({ error: 'E-Mail fehlt' });
            return;
        }
        const user = await User_1.User.findOne({ email: String(email).toLowerCase() });
        if (!user) {
            res.json({ message: 'Falls registriert, erhältst du einen Reset-Code.' });
            return;
        }
        const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
        const resetToken = crypto_1.default.createHash('sha256').update(resetCode).digest('hex');
        await User_1.User.findByIdAndUpdate(user._id, {
            resetToken,
            resetTokenExpires: new Date(Date.now() + 15 * 60 * 1000),
        });
        const isDev = process.env.NODE_ENV !== 'production';
        res.json({ message: 'Reset-Code generiert.', ...(isDev && { resetCode }) });
    }
    catch (_err) {
        res.status(500).json({ error: 'Serverfehler' });
    }
});
// ── POST /api/auth/reset-password ────────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
    try {
        const { email, resetCode, newPassword } = req.body;
        if (!email || !resetCode || !newPassword || String(newPassword).length < 6) {
            res.status(400).json({ error: 'Ungültige Daten' });
            return;
        }
        const resetToken = crypto_1.default.createHash('sha256').update(String(resetCode)).digest('hex');
        const user = await User_1.User.findOne({
            email: String(email).toLowerCase(),
            resetToken,
            resetTokenExpires: { $gt: new Date() },
        });
        if (!user) {
            res.status(400).json({ error: 'Code ungültig oder abgelaufen' });
            return;
        }
        await User_1.User.findByIdAndUpdate(user._id, {
            password: await bcryptjs_1.default.hash(String(newPassword), 12),
            resetToken: undefined,
            resetTokenExpires: undefined,
        });
        res.json({ message: 'Passwort geändert.' });
    }
    catch (_err) {
        res.status(500).json({ error: 'Serverfehler' });
    }
});
// ── PATCH /api/auth/change-password ──────────────────────────────────────────
router.patch('/change-password', auth_1.authMiddleware, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword || String(newPassword).length < 6) {
            res.status(400).json({ error: 'Ungültige Daten' });
            return;
        }
        const user = await User_1.User.findById(req.userId);
        if (!user || !(await bcryptjs_1.default.compare(String(currentPassword), user.password))) {
            res.status(401).json({ error: 'Aktuelles Passwort falsch' });
            return;
        }
        await User_1.User.findByIdAndUpdate(req.userId, {
            password: await bcryptjs_1.default.hash(String(newPassword), 12),
        });
        res.json({ message: 'Passwort geändert.' });
    }
    catch (_err) {
        res.status(500).json({ error: 'Serverfehler' });
    }
});
// ── DELETE /api/auth/account ──────────────────────────────────────────────────
router.delete('/account', auth_1.authMiddleware, async (req, res) => {
    try {
        const uid = req.userId;
        // Alle Daten des Users vollständig löschen (DSGVO-konform)
        try {
            const { Message } = require('../models/Message');
            const { Conversation } = require('../models/Conversation');
            const { Contact } = require('../models/Contact');
            const { Report } = require('../models/Report');
            await Promise.all([
                // Nachrichten anonymisieren (Inhalt löschen, Sender anonymisieren)
                Message.updateMany({ sender: uid }, { deleted: true, content: '', fileUrl: undefined, fileName: undefined }),
                // Aus allen Conversations entfernen
                Conversation.updateMany({ participants: uid }, { $pull: { participants: uid } }),
                // Kontakte vollständig löschen
                Contact.deleteMany({ $or: [{ user: uid }, { owner: uid }] }),
                // Reports löschen
                Report.deleteMany({ reporter: uid }).catch(() => { }),
            ]);
        }
        catch (_ce) {
            console.error('[DeleteAccount] Cleanup error (non-fatal):', _ce);
        }
        // User vollständig aus der Datenbank löschen
        // Damit wird die E-Mail-Adresse und UIN wieder frei
        await User_1.User.findByIdAndDelete(uid);
        console.log(`[DeleteAccount] User ${uid} vollständig gelöscht`);
        res.json({ ok: true });
    }
    catch (err) {
        console.error('[DeleteAccount] Error:', err);
        res.status(500).json({ error: 'Fehler beim Löschen' });
    }
});
// ── DELETE /api/auth/account/force — Admin: User komplett löschen ─────────────
// (Für bereits soft-gelöschte Users die die E-Mail blockieren)
router.delete('/account/cleanup-deleted', auth_1.authMiddleware, async (req, res) => {
    try {
        // Alle bereits anonymisierten (soft-deleted) Users aufräumen
        const deleted = await User_1.User.deleteMany({
            email: { $regex: /^deleted_.*@deleted\.pingr$/ },
            isBanned: true,
            bannedReason: 'Konto gelöscht',
        });
        console.log(`[Cleanup] ${deleted.deletedCount} soft-deleted Users entfernt`);
        res.json({ ok: true, removed: deleted.deletedCount });
    }
    catch (err) {
        res.status(500).json({ error: 'Serverfehler' });
    }
});
// ── GET /api/auth/verify-email?token=xxx ─────────────────────────────────────
router.get('/verify-email', async (req, res) => {
    try {
        const { token } = req.query;
        if (!token) {
            res.status(400).send('Token fehlt');
            return;
        }
        const user = await User_1.User.findOne({
            emailVerifyToken: String(token),
            emailVerifyExpires: { $gt: new Date() },
        });
        if (!user) {
            res.status(400).send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>PingR</title>
        <style>body{font-family:sans-serif;background:#0d0d14;color:#f1f0f8;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}.box{text-align:center;padding:40px;background:#13131f;border-radius:16px;border:1px solid rgba(255,255,255,.1)}</style>
        </head><body><div class="box"><div style="font-size:48px">❌</div><h2>Link ungültig oder abgelaufen</h2>
        <p style="color:#8b8aa8">Bitte fordere einen neuen Link in der App an.</p>
        <a href="/chat" style="color:#4f6ef7">Zurück zur App →</a></div></body></html>`);
            return;
        }
        await User_1.User.findByIdAndUpdate(user._id, {
            emailVerified: true,
            emailVerifyToken: undefined,
            emailVerifyExpires: undefined,
        });
        console.log(`[Auth] E-Mail verifiziert: ${user.username}`);
        res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Verifiziert – PingR</title>
      <meta http-equiv="refresh" content="3;url=/chat">
      <style>body{font-family:sans-serif;background:#0d0d14;color:#f1f0f8;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}.box{text-align:center;padding:40px;background:#13131f;border-radius:16px;border:1px solid rgba(255,255,255,.1)}</style>
      </head><body><div class="box"><div style="font-size:48px">✅</div><h2>E-Mail erfolgreich bestätigt!</h2>
      <p style="color:#8b8aa8">Weiterleitung in 3 Sekunden…</p>
      <a href="/chat" style="color:#4f6ef7">Jetzt zum Chat →</a></div></body></html>`);
    }
    catch (err) {
        console.error('[VerifyEmail]', err);
        res.status(500).send('Serverfehler');
    }
});
// ── POST /api/auth/resend-verification ───────────────────────────────────────
router.post('/resend-verification', auth_1.authMiddleware, async (req, res) => {
    try {
        const user = await User_1.User.findById(req.userId).select('email username emailVerified');
        if (!user) {
            res.status(404).json({ error: 'Nicht gefunden' });
            return;
        }
        if (user.emailVerified) {
            res.json({ message: 'Bereits verifiziert.' });
            return;
        }
        const verifyToken = crypto_1.default.randomBytes(32).toString('hex');
        const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await User_1.User.findByIdAndUpdate(req.userId, { emailVerifyToken: verifyToken, emailVerifyExpires: verifyExpires });
        const sent = await (0, mailer_1.sendVerificationEmail)(user.email, user.username, verifyToken, user.uin);
        if (!sent) {
            console.log(`[ResendVerify] SMTP not configured. Token: ${verifyToken}`);
        }
        res.json({ message: 'Bestätigungsmail gesendet! Bitte überprüfe dein Postfach.' });
    }
    catch (err) {
        console.error('[ResendVerify]', err);
        res.status(500).json({ error: 'Serverfehler' });
    }
});
exports.default = router;
// POST /api/auth/trust-device — Gerät als vertrauenswürdig markieren
router.post('/trust-device', auth_1.authMiddleware, async (req, res) => {
    try {
        const crypto = require('crypto');
        const token = crypto.randomBytes(32).toString('hex');
        const days = parseInt(req.body.days || '30');
        const user = await User_1.User.findById(req.userId);
        if (!user) {
            res.status(404).json({ error: 'Nicht gefunden' });
            return;
        }
        const trusted = [...(user.trustedDevices || []), token].slice(-10);
        await User_1.User.findByIdAndUpdate(req.userId, { trustedDevices: trusted });
        const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
        res.json({ ok: true, token, expires, days });
    }
    catch (_err) {
        res.status(500).json({ error: 'Serverfehler' });
    }
});
