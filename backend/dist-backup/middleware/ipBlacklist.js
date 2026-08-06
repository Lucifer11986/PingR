"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordFailedAttempt = recordFailedAttempt;
exports.clearAttempts = clearAttempts;
exports.checkIPBlacklist = checkIPBlacklist;
// In-Memory Store für fehlgeschlagene Login-Versuche
// Key: IP-Adresse, Value: { count, firstAttempt, blocked }
const attempts = new Map();
const MAX_ATTEMPTS = 5; // Max fehlgeschlagene Versuche
const WINDOW_MS = 15 * 60 * 1000; // 15 Minuten Fenster
const BLOCK_DURATION = 60 * 60 * 1000; // 1 Stunde blockiert
function getIP(req) {
    return String(req.ip ||
        (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
        req.socket?.remoteAddress ||
        'unknown').replace('::ffff:', '');
}
function recordFailedAttempt(ip) {
    const now = Date.now();
    const data = attempts.get(ip);
    if (!data || now - data.firstAt > WINDOW_MS) {
        attempts.set(ip, { count: 1, firstAt: now });
        return;
    }
    data.count++;
    if (data.count >= MAX_ATTEMPTS) {
        data.blockedUntil = now + BLOCK_DURATION;
        console.warn(`[Security] IP ${ip} blockiert nach ${data.count} fehlgeschlagenen Versuchen`);
    }
    attempts.set(ip, data);
}
function clearAttempts(ip) {
    attempts.delete(ip);
}
function checkIPBlacklist(req, res, next) {
    const ip = getIP(req);
    const data = attempts.get(ip);
    const now = Date.now();
    if (data?.blockedUntil && now < data.blockedUntil) {
        const remainMin = Math.ceil((data.blockedUntil - now) / 60000);
        res.status(429).json({
            error: `Zu viele Fehlversuche. Bitte in ${remainMin} Minute(n) erneut versuchen.`,
            blockedUntil: data.blockedUntil,
        });
        return;
    }
    // Abgelaufene Blocks aufräumen
    if (data?.blockedUntil && now >= data.blockedUntil) {
        attempts.delete(ip);
    }
    next();
}
// Cleanup Job: alle 30 min alte Einträge löschen
setInterval(() => {
    const now = Date.now();
    for (const [ip, data] of attempts.entries()) {
        if (now - data.firstAt > WINDOW_MS * 2)
            attempts.delete(ip);
    }
}, 30 * 60 * 1000);
