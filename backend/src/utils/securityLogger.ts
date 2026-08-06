import crypto from 'crypto'
import { SecurityLog, SecurityEventType } from '../models/SecurityLog'
import { User } from '../models/User'
import { sendCriticalAlert } from './mailer'
import { detectDevice, formatDeviceForLog } from './deviceDetector'

interface LogSecurityEventParams {
  userId:          string
  content:         string
  eventType:       SecurityEventType
  legalBasis:      string
  conversationId?: string
  messageId?:      string
  ipAddress?:      string
  userAgent?:      string
}

export async function logSecurityEvent(params: LogSecurityEventParams): Promise<string> {
  const user = await User.findById(params.userId).select('uin email username')
  if (!user) throw new Error('User nicht gefunden')

  const contentHash = crypto.createHash('sha256').update(params.content).digest('hex')
  const device      = detectDevice(params.userAgent || '')
  const deviceSummary = formatDeviceForLog(device)

  const log = await SecurityLog.create({
    userId:           params.userId,
    userUIN:          user.uin,
    userEmail:        user.email,
    username:         user.username,
    ipAddress:        params.ipAddress,
    userAgent:        params.userAgent,
    deviceType:       device.deviceType,
    deviceOS:         device.os,
    deviceBrowser:    `${device.browser} ${device.browserVersion}`.trim(),
    deviceSummary,
    eventType:        params.eventType,
    legalBasis:       params.legalBasis,
    attemptedContent: params.content,
    contentHash,
    conversationId:   params.conversationId,
    messageId:        params.messageId,
    timestamp:        new Date(),
    autoDetected:     true,
    reportedToBka:    false,
  })

  // E-Mail bei kritischen Ereignissen
  if (['csam', 'extremism', 'terrorism'].includes(params.eventType)) {
    sendCriticalAlert({
      eventType:  params.eventType,
      username:   user.username,
      uin:        user.uin,
      email:      user.email,
      content:    params.content,
      legalBasis: params.legalBasis,
      ip:         params.ipAddress || 'unbekannt',
    }).catch(() => {})
  }

  return log._id.toString()
}

export async function generateLawEnforcementReport(logIds: string[]): Promise<object> {
  const logs = await SecurityLog.find({ _id: { $in: logIds } }).sort({ timestamp: 1 })
  if (logs.length === 0) throw new Error('Keine Logs gefunden')

  const report = {
    reportMetadata: {
      generatedAt: new Date().toISOString(),
      generatedBy: 'Nokki Sicherheitssystem v2',
      platform:    'Nokki Instant Messenger',
      legalRef:    'NetzDG § 3 / § 14 TMG / DSGVO Art. 6 Abs. 1 lit. c',
      totalIncidents: logs.length,
    },
    recommendedRecipients: [
      { name: 'Bundeskriminalamt (BKA)', email: 'hinweise@bka.de' },
      { name: 'Bundesnetzagentur', contact: 'bundesnetzagentur.de' },
      { name: 'jugendschutz.net', contact: 'jugendschutz.net', note: 'Für CSAM-Fälle' },
    ],
    suspects: logs.reduce((acc: Record<string, unknown>, log) => {
      const key = log.userId.toString()
      if (!acc[key]) {
        acc[key] = {
          userId: log.userId, uin: log.userUIN,
          username: log.username, email: log.userEmail,
          ipAddresses: [] as string[],
          devices: [] as string[],
          incidentCount: 0,
          firstIncident: log.timestamp,
          lastIncident:  log.timestamp,
          violations: [] as string[],
        }
      }
      const s = acc[key] as Record<string, unknown>
      s.incidentCount = (s.incidentCount as number) + 1
      s.lastIncident  = log.timestamp
      if (log.ipAddress && !(s.ipAddresses as string[]).includes(log.ipAddress))
        (s.ipAddresses as string[]).push(log.ipAddress)
      if (log.deviceSummary && !(s.devices as string[]).includes(log.deviceSummary))
        (s.devices as string[]).push(log.deviceSummary)
      if (!(s.violations as string[]).includes(log.legalBasis))
        (s.violations as string[]).push(log.legalBasis)
      return acc
    }, {}),
    incidents: logs.map(log => ({
      id:               log._id,
      timestamp:        log.timestamp.toISOString(),
      eventType:        log.eventType,
      legalBasis:       log.legalBasis,
      userId:           log.userId,
      userUIN:          log.userUIN,
      username:         log.username,
      userEmail:        log.userEmail,
      ipAddress:        log.ipAddress || 'unbekannt',
      // 🆕 Gerätedaten vollständig
      device: {
        type:    log.deviceType || 'unbekannt',
        os:      log.deviceOS || 'unbekannt',
        browser: log.deviceBrowser || 'unbekannt',
        summary: log.deviceSummary || 'unbekannt',
        userAgentRaw: log.userAgent || 'unbekannt',
      },
      contentHash:      log.contentHash,
      attemptedContent: log.attemptedContent,
      conversationId:   log.conversationId,
      messageId:        log.messageId,
    })),
    legalStatement: [
      'Dieser Bericht wurde automatisch durch das Nokki-Sicherheitssystem erstellt.',
      'Rechtsgrundlage: § 14 TMG (Bestandsdaten), § 15a TMG (Nutzungsdaten), NetzDG § 3.',
      'Gerätedaten werden gem. DSGVO Art. 6 Abs. 1 lit. c gespeichert (rechtliche Verpflichtung).',
      'Alle Zeitstempel in UTC. IP-Adressen und Gerätedaten zum Zeitpunkt des Vorfalls gespeichert.',
      'Kontakt: privacy@lumestack.de',
    ].join(' '),
  }

  const reportJson = JSON.stringify(report)
  await SecurityLog.updateMany({ _id: { $in: logIds } }, { reportPackage: reportJson })
  return report
}
