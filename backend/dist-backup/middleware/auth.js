"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
exports.createJWT = createJWT;
exports.invalidateToken = invalidateToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const logger_1 = require("../utils/logger");
// ── ENV Helper (fail fast) ───────────────────────────────────────────────────
function requireEnv(name) {
    const value = process.env[name];
    if (!value) {
        console.error(`❌ ENV fehlt: ${name}`);
        process.exit(1);
    }
    return value;
}
const JWT_SECRET = requireEnv('JWT_SECRET');
// ── Middleware ───────────────────────────────────────────────────────────────
async function authMiddleware(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        // ✅ LOGGING: Auth Fail
        (0, logger_1.logSecurityEvent)({
            type: 'auth_fail',
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            details: { reason: 'Missing or invalid Authorization header' }
        });
        res.status(401).json({ error: 'Nicht autorisiert' });
        return;
    }
    const token = header.split(' ')[1];
    try {
        // ✅ CHECK: Token Blacklist (Redis)
        const { getRedis } = require('../utils/redis');
        const blacklisted = await getRedis().get(`blacklist:${token}`);
        if (blacklisted) {
            (0, logger_1.logSecurityEvent)({
                type: 'auth_fail',
                ip: req.ip,
                userAgent: req.headers['user-agent'],
                details: { reason: 'Token blacklisted' }
            });
            res.status(401).json({ error: 'Token wurde invalidiert' });
            return;
        }
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET, {
            algorithms: ['HS256']
        });
        // 🔥 Payload prüfen (kein blindes Vertrauen)
        if (!decoded ||
            typeof decoded !== 'object' ||
            typeof decoded.userId !== 'string') {
            (0, logger_1.logSecurityEvent)({
                type: 'auth_fail',
                ip: req.ip,
                userAgent: req.headers['user-agent'],
                details: { reason: 'Invalid JWT payload' }
            });
            res.status(401).json({ error: 'Ungültiger Token' });
            return;
        }
        req.userId = decoded.userId;
        req.token = token;
        // 🔒 SECURITY FIX: Identity IMMER aus JWT
        if (decoded.activeIdentityId) {
            // ✅ JWT hat Identity → das ist führend
            try {
                const { Identity } = require('../models/Identity');
                // Doppelte Validierung: Identity gehört dem User
                const identity = await Identity.findOne({
                    _id: decoded.activeIdentityId,
                    userId: decoded.userId
                }).lean();
                if (!identity) {
                    // JWT hat ungültige Identity (gelöschte Identity o.ä.)
                    (0, logger_1.logSecurityEvent)({
                        type: 'identity_spoofing_attempt',
                        userId: decoded.userId,
                        identityId: decoded.activeIdentityId,
                        ip: req.ip,
                        userAgent: req.headers['user-agent'],
                        details: { reason: 'JWT contains invalid identity' }
                    });
                    // Fallback: Lade aktive Identity
                    const fallbackIdent = await Identity.findOne({
                        userId: decoded.userId,
                        isActive: true
                    }).lean();
                    if (fallbackIdent) {
                        req.activeIdentityId = fallbackIdent._id.toString();
                    }
                }
                else {
                    req.activeIdentityId = identity._id.toString();
                }
            }
            catch (e) {
                console.error('Identity validation error:', e);
            }
        }
        else {
            // Legacy-JWT ohne Identity → Fallback
            try {
                const { Identity } = require('../models/Identity');
                const ident = await Identity.findOne({
                    userId: decoded.userId,
                    isActive: true
                }).lean();
                if (ident) {
                    req.activeIdentityId = ident._id.toString();
                }
            }
            catch (_e) {
                console.error('Legacy identity loading error:', _e);
            }
        }
        next();
    }
    catch (err) {
        if (err instanceof jsonwebtoken_1.default.TokenExpiredError) {
            (0, logger_1.logSecurityEvent)({
                type: 'auth_fail',
                ip: req.ip,
                userAgent: req.headers['user-agent'],
                details: { reason: 'Token expired' }
            });
            res.status(401).json({ error: 'Token abgelaufen' });
            return;
        }
        (0, logger_1.logSecurityEvent)({
            type: 'auth_fail',
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            details: { reason: 'Token invalid', error: err.message }
        });
        res.status(401).json({ error: 'Token ungültig' });
    }
}
// ── Helper: JWT erstellen mit Identity ───────────────────────────────────────
function createJWT(userId, activeIdentityId) {
    const payload = {
        userId,
        activeIdentityId,
    };
    return jsonwebtoken_1.default.sign(payload, JWT_SECRET, {
        algorithm: 'HS256',
        expiresIn: '1h', // ✅ SECURITY: Kurze TTL (1h statt 7d)
    });
}
// ── Helper: Token invalidieren ───────────────────────────────────────────────
async function invalidateToken(token) {
    try {
        const decoded = jsonwebtoken_1.default.decode(token);
        if (!decoded?.exp)
            return;
        const ttl = decoded.exp - Math.floor(Date.now() / 1000);
        if (ttl > 0) {
            const { getRedis } = require('../utils/redis');
            await getRedis().setex(`blacklist:${token}`, ttl, '1');
            (0, logger_1.logSecurityEvent)({
                type: 'token_invalidated',
                userId: decoded.userId,
                identityId: decoded.activeIdentityId,
                details: { ttl }
            });
        }
    }
    catch (e) {
        console.error('Token invalidation error:', e);
    }
}
