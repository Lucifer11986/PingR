"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRedis = getRedis;
exports.checkAutoReplyRateLimit = checkAutoReplyRateLimit;
exports.closeRedis = closeRedis;
const ioredis_1 = __importDefault(require("ioredis"));
const logger_1 = require("./logger");
let redisClient = null;
// ✅ KEY PREFIXES (gegen LRU Eviction)
const AUTO_REPLY_PREFIX = 'autoreply:';
const BLACKLIST_PREFIX = 'blacklist:';
const RATE_LIMIT_PREFIX = 'ratelimit:';
function getRedis() {
    if (!redisClient) {
        const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
        redisClient = new ioredis_1.default(redisUrl, {
            retryStrategy: (times) => {
                const delay = Math.min(times * 50, 2000);
                return delay;
            },
            maxRetriesPerRequest: 3,
            enableReadyCheck: true,
            lazyConnect: false,
        });
        redisClient.on('connect', () => {
            console.log('✅ Redis connected');
        });
        redisClient.on('error', (err) => {
            console.error('❌ Redis error:', err);
            (0, logger_1.logError)('Redis connection error', err);
        });
        redisClient.on('ready', () => {
            console.log('✅ Redis ready');
        });
    }
    return redisClient;
}
// Auto-Reply Rate-Limiting Helper
async function checkAutoReplyRateLimit(identityId, conversationId) {
    const redis = getRedis();
    const key = `${AUTO_REPLY_PREFIX}${identityId}:${conversationId}`; // ✅ PREFIX
    // Versuche Key zu setzen (NX = nur wenn nicht existiert)
    const result = await redis.set(key, '1', 'EX', 600, 'NX');
    if (result === 'OK') {
        // ✅ LOGGING: Auto-Reply Trigger
        (0, logger_1.logSecurityEvent)({
            type: 'autoreply_trigger',
            identityId,
            details: { conversationId }
        });
        return true; // Rate-Limit NICHT aktiv
    }
    else {
        // ✅ LOGGING: Rate-Limit Hit
        (0, logger_1.logSecurityEvent)({
            type: 'rate_limit_hit',
            identityId,
            details: { conversationId, type: 'autoreply' }
        });
        return false; // Rate-Limit AKTIV
    }
}
// Cleanup bei Server-Shutdown
async function closeRedis() {
    if (redisClient) {
        await redisClient.quit();
        redisClient = null;
        console.log('✅ Redis connection closed');
    }
}
