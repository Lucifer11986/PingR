import Redis from 'ioredis'
import { logSecurityEvent, logError } from './logger'

let redisClient: Redis | null = null

// ✅ KEY PREFIXES (gegen LRU Eviction)
const AUTO_REPLY_PREFIX = 'autoreply:'
const BLACKLIST_PREFIX = 'blacklist:'
const RATE_LIMIT_PREFIX = 'ratelimit:'

export function getRedis(): Redis {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
    
    redisClient = new Redis(redisUrl, {
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000)
        return delay
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
    })

    redisClient.on('connect', () => {
      console.log('✅ Redis connected')
    })

    redisClient.on('error', (err) => {
      console.error('❌ Redis error:', err)
      logError('Redis connection error', err)
    })

    redisClient.on('ready', () => {
      console.log('✅ Redis ready')
    })
  }

  return redisClient
}

// Auto-Reply Rate-Limiting Helper
export async function checkAutoReplyRateLimit(
  identityId: string,
  conversationId: string
): Promise<boolean> {
  const redis = getRedis()
  const key = `${AUTO_REPLY_PREFIX}${identityId}:${conversationId}`  // ✅ PREFIX
  
  // Versuche Key zu setzen (NX = nur wenn nicht existiert)
  const result = await redis.set(key, '1', 'EX', 600, 'NX')
  
  if (result === 'OK') {
    // ✅ LOGGING: Auto-Reply Trigger
    logSecurityEvent({
      type: 'autoreply_trigger',
      identityId,
      details: { conversationId }
    })
    return true  // Rate-Limit NICHT aktiv
  } else {
    // ✅ LOGGING: Rate-Limit Hit
    logSecurityEvent({
      type: 'rate_limit_hit',
      identityId,
      details: { conversationId, type: 'autoreply' }
    })
    return false  // Rate-Limit AKTIV
  }
}

// Cleanup bei Server-Shutdown
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit()
    redisClient = null
    console.log('✅ Redis connection closed')
  }
}