import winston from 'winston'

// Logger-Konfiguration
export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'pingr-backend' },
  transports: [
    // Fehler-Log (nur errors)
    new winston.transports.File({ 
      filename: '/app/logs/error.log', 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Combined-Log (alles)
    new winston.transports.File({ 
      filename: '/app/logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Security-Log (nur warnings und errors)
    new winston.transports.File({ 
      filename: '/app/logs/security.log',
      level: 'warn',
      maxsize: 5242880, // 5MB
      maxFiles: 10,
    }),
  ],
})

// Console-Output nur in Development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }))
}

// Security Event Logger
export function logSecurityEvent(event: {
  type: 'auth_fail' | 'identity_switch' | 'autoreply_trigger' | 'rate_limit_hit' | 'token_invalidated' | 'identity_spoofing_attempt'
  userId?: string
  identityId?: string
  ip?: string
  userAgent?: string
  details?: any
}) {
  logger.warn('SECURITY_EVENT', {
    timestamp: new Date().toISOString(),
    ...event,
  })
}

// Info-Level Logs
export function logInfo(message: string, meta?: any) {
  logger.info(message, meta)
}

// Error-Level Logs
export function logError(message: string, error?: any) {
  logger.error(message, { error: error?.message, stack: error?.stack })
}