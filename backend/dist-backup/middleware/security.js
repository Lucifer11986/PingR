"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeInput = sanitizeInput;
exports.securityHeaders = securityHeaders;
exports.rateLimit = rateLimit;
exports.validateAdminSecret = validateAdminSecret;
exports.checkPayloadSize = checkPayloadSize;
// ── Utility: Prüfen ob Objekt ────────────────────────────────────────────────
function isObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
// ── Rekursive Key-Sanitization (KRITISCH für Mongo) ──────────────────────────
function sanitizeObject(obj, depth = 0) {
    if (depth > 10)
        return obj;
    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item, depth + 1));
    }
    if (isObject(obj)) {
        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
            // 🔥 WICHTIG: verhindert NoSQL Injection
            if (key.startsWith('$') || key.includes('.'))
                continue;
            sanitized[key] = sanitizeObject(value, depth + 1);
        }
        return sanitized;
    }
    return obj;
}
// ── Middleware: Request Sanitization ─────────────────────────────────────────
function sanitizeInput(req, _res, next) {
    if (req.body && typeof req.body === 'object') {
        req.body = sanitizeObject(req.body);
    }
    if (req.query && typeof req.query === 'object') {
        req.query = sanitizeObject(req.query);
    }
    next();
}
// ── Security Headers (minimal + sinnvoll) ────────────────────────────────────
function securityHeaders(_req, res, next) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    // CSP bewusst restriktiv, aber noch praktikabel
    res.setHeader('Content-Security-Policy', [
        "default-src 'self'",
        "script-src 'self'", // KEIN unsafe-inline mehr
        "style-src 'self' 'unsafe-inline'", // CSS oft nötig
        "img-src 'self' data: blob:",
        "connect-src 'self' ws: wss:",
        "frame-ancestors 'none'"
    ].join('; '));
    next();
}
// ── Rate Limiter (einfach, aber effektiv) ────────────────────────────────────
const requests = new Map();
function rateLimit(max = 100, windowMs = 60000) {
    return (req, res, next) => {
        const ip = req.ip || req.socket.remoteAddress || 'unknown';
        const now = Date.now();
        const entry = requests.get(ip) || { count: 0, last: now };
        if (now - entry.last > windowMs) {
            entry.count = 0;
            entry.last = now;
        }
        entry.count++;
        requests.set(ip, entry);
        if (entry.count > max) {
            res.status(429).json({ error: 'Too many requests' });
            return;
        }
        next();
    };
}
// ── Admin Secret Check ───────────────────────────────────────────────────────
function validateAdminSecret(req, res, next) {
    const secret = req.headers['x-admin-secret'];
    if (!process.env.ADMIN_SECRET || process.env.ADMIN_SECRET.length < 12) {
        console.warn('⚠️ ADMIN_SECRET unsicher oder nicht gesetzt');
    }
    if (!secret || secret !== process.env.ADMIN_SECRET) {
        res.status(403).json({ error: 'Forbidden' });
        return;
    }
    next();
}
// ── Payload Size Check ───────────────────────────────────────────────────────
function checkPayloadSize(maxKB = 500) {
    return (req, res, next) => {
        const len = Number(req.headers['content-length'] || 0);
        if (len > maxKB * 1024) {
            res.status(413).json({ error: 'Payload too large' });
            return;
        }
        next();
    };
}
