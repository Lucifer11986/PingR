"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
exports.logSecurityEvent = logSecurityEvent;
exports.logInfo = logInfo;
exports.logError = logError;
const winston_1 = __importDefault(require("winston"));
// Logger-Konfiguration
exports.logger = winston_1.default.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json()),
    defaultMeta: { service: 'pingr-backend' },
    transports: [
        // Fehler-Log (nur errors)
        new winston_1.default.transports.File({
            filename: '/app/logs/error.log',
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
        // Combined-Log (alles)
        new winston_1.default.transports.File({
            filename: '/app/logs/combined.log',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
        // Security-Log (nur warnings und errors)
        new winston_1.default.transports.File({
            filename: '/app/logs/security.log',
            level: 'warn',
            maxsize: 5242880, // 5MB
            maxFiles: 10,
        }),
    ],
});
// Console-Output nur in Development
if (process.env.NODE_ENV !== 'production') {
    exports.logger.add(new winston_1.default.transports.Console({
        format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.simple()),
    }));
}
// Security Event Logger
function logSecurityEvent(event) {
    exports.logger.warn('SECURITY_EVENT', {
        timestamp: new Date().toISOString(),
        ...event,
    });
}
// Info-Level Logs
function logInfo(message, meta) {
    exports.logger.info(message, meta);
}
// Error-Level Logs
function logError(message, error) {
    exports.logger.error(message, { error: error?.message, stack: error?.stack });
}
