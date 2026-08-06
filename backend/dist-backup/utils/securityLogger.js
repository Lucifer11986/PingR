"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logSecurityEvent = logSecurityEvent;
exports.generateLawEnforcementReport = generateLawEnforcementReport;
const crypto_1 = __importDefault(require("crypto"));
const SecurityLog_1 = require("../models/SecurityLog");
const User_1 = require("../models/User");
const mailer_1 = require("./mailer");
const deviceDetector_1 = require("./deviceDetector");
async function logSecurityEvent(params) {
    const user = await User_1.User.findById(params.userId).select('uin email username');
    if (!user)
        throw new Error('User nicht gefunden');
    const contentHash = crypto_1.default.createHash('sha256').update(params.content).digest('hex');
    const device = (0, deviceDetector_1.detectDevice)(params.userAgent || '');
    const deviceSummary = (0, deviceDetector_1.formatDeviceForLog)(device);
    const log = await SecurityLog_1.SecurityLog.create({
        userId: params.userId,
        userUIN: user.uin,
        userEmail: user.email,
        username: user.username,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        deviceType: device.deviceType,
        deviceOS: device.os,
        deviceBrowser: `${device.browser} ${device.browserVersion}`.trim(),
        deviceSummary,
        eventType: params.eventType,
        legalBasis: params.legalBasis,
        attemptedContent: params.content,
        contentHash,
        conversationId: params.conversationId,
        messageId: params.messageId,
        timestamp: new Date(),
        autoDetected: true,
        reportedToBka: false,
    });
    // E-Mail bei kritischen Ereignissen
    if (['csam', 'extremism', 'terrorism'].includes(params.eventType)) {
        (0, mailer_1.sendCriticalAlert)({
            eventType: params.eventType,
            username: user.username,
            uin: user.uin,
            email: user.email,
            content: params.content,
            legalBasis: params.legalBasis,
            ip: params.ipAddress || 'unbekannt',
        }).catch(() => { });
    }
    return log._id.toString();
}
async function generateLawEnforcementReport(logIds) {
    const logs = await SecurityLog_1.SecurityLog.find({ _id: { $in: logIds } }).sort({ timestamp: 1 });
    if (logs.length === 0)
        throw new Error('Keine Logs gefunden');
    const report = {
        reportMetadata: {
            generatedAt: new Date().toISOString(),
            generatedBy: 'PingR Sicherheitssystem v2',
            platform: 'PingR Instant Messenger',
            legalRef: 'NetzDG § 3 / § 14 TMG / DSGVO Art. 6 Abs. 1 lit. c',
            totalIncidents: logs.length,
        },
        recommendedRecipients: [
            { name: 'Bundeskriminalamt (BKA)', email: 'hinweise@bka.de' },
            { name: 'Bundesnetzagentur', contact: 'bundesnetzagentur.de' },
            { name: 'jugendschutz.net', contact: 'jugendschutz.net', note: 'Für CSAM-Fälle' },
        ],
        suspects: logs.reduce((acc, log) => {
            const key = log.userId.toString();
            if (!acc[key]) {
                acc[key] = {
                    userId: log.userId, uin: log.userUIN,
                    username: log.username, email: log.userEmail,
                    ipAddresses: [],
                    devices: [],
                    incidentCount: 0,
                    firstIncident: log.timestamp,
                    lastIncident: log.timestamp,
                    violations: [],
                };
            }
            const s = acc[key];
            s.incidentCount = s.incidentCount + 1;
            s.lastIncident = log.timestamp;
            if (log.ipAddress && !s.ipAddresses.includes(log.ipAddress))
                s.ipAddresses.push(log.ipAddress);
            if (log.deviceSummary && !s.devices.includes(log.deviceSummary))
                s.devices.push(log.deviceSummary);
            if (!s.violations.includes(log.legalBasis))
                s.violations.push(log.legalBasis);
            return acc;
        }, {}),
        incidents: logs.map(log => ({
            id: log._id,
            timestamp: log.timestamp.toISOString(),
            eventType: log.eventType,
            legalBasis: log.legalBasis,
            userId: log.userId,
            userUIN: log.userUIN,
            username: log.username,
            userEmail: log.userEmail,
            ipAddress: log.ipAddress || 'unbekannt',
            // 🆕 Gerätedaten vollständig
            device: {
                type: log.deviceType || 'unbekannt',
                os: log.deviceOS || 'unbekannt',
                browser: log.deviceBrowser || 'unbekannt',
                summary: log.deviceSummary || 'unbekannt',
                userAgentRaw: log.userAgent || 'unbekannt',
            },
            contentHash: log.contentHash,
            attemptedContent: log.attemptedContent,
            conversationId: log.conversationId,
            messageId: log.messageId,
        })),
        legalStatement: [
            'Dieser Bericht wurde automatisch durch das PingR-Sicherheitssystem erstellt.',
            'Rechtsgrundlage: § 14 TMG (Bestandsdaten), § 15a TMG (Nutzungsdaten), NetzDG § 3.',
            'Gerätedaten werden gem. DSGVO Art. 6 Abs. 1 lit. c gespeichert (rechtliche Verpflichtung).',
            'Alle Zeitstempel in UTC. IP-Adressen und Gerätedaten zum Zeitpunkt des Vorfalls gespeichert.',
            'Kontakt: security@pingr.app',
        ].join(' '),
    };
    const reportJson = JSON.stringify(report);
    await SecurityLog_1.SecurityLog.updateMany({ _id: { $in: logIds } }, { reportPackage: reportJson });
    return report;
}
