import express, { Request, Response } from 'express'
import crypto from 'crypto'
import BotWebhook, { WebhookEvent } from '../models/BotWebhook'
import Bot from '../models/Bot'
import { authMiddleware } from '../middleware/devAuth'
import { validatePublicWebhookUrl } from '../utils/safeWebhookUrl'
import { encryptWebhookSecret } from '../utils/webhookSecret'
import { sendWebhook } from '../utils/webhookTrigger'
import WebhookDelivery from '../models/WebhookDelivery'
import { decryptField } from '../utils/fieldEncryption'
import mongoose from 'mongoose'

const router = express.Router()
const allowedEvents = new Set(Object.values(WebhookEvent))

function publicWebhook(webhook: any) {
  return {
    _id: webhook._id,
    webhookId: webhook.webhookId,
    botId: webhook.botId,
    url: webhook.url,
    events: webhook.events,
    active: webhook.active,
    retryConfig: webhook.retryConfig,
    stats: webhook.stats,
    createdAt: webhook.createdAt,
    updatedAt: webhook.updatedAt,
  }
}

async function ownedBot(botId: string, userId: string) {
  return Bot.findOne({ botId, ownerId: userId })
}

async function validateInput(url: unknown, events: unknown) {
  if (typeof url !== 'string') throw new Error('Webhook-URL fehlt')
  await validatePublicWebhookUrl(url)
  if (!Array.isArray(events) || events.length === 0 || events.length > 20 || events.some(event => !allowedEvents.has(event))) {
    throw new Error('Ungültige Webhook-Events')
  }
}

const createHandler = async (req: Request, res: Response) => {
  try {
    const { botId, url, events } = req.body
    const userId = (req as any).userId
    await validateInput(url, events)
    if (!await ownedBot(botId, userId)) return res.status(403).json({ error: 'Keine Berechtigung für diesen Bot' })
    if (await BotWebhook.countDocuments({ botId }) >= 10) return res.status(409).json({ error: 'Maximal 10 Webhooks pro Bot' })

    const secret = crypto.randomBytes(32).toString('hex')
    const webhook = await BotWebhook.create({ botId, url, events, secret: encryptWebhookSecret(secret), active: true })
    res.status(201).json({ success: true, webhook: publicWebhook(webhook), secret, secretNotice: 'Dieses Secret wird nur einmal angezeigt.' })
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Fehler beim Erstellen' })
  }
}

router.post('/', authMiddleware, createHandler)
router.post('/create', authMiddleware, createHandler)

router.get('/', authMiddleware, async (req: Request, res: Response) => {
  const userId = (req as any).userId
  const botId = String(req.query.botId || '')
  if (!botId) return res.status(400).json({ error: 'botId erforderlich' })
  if (!await ownedBot(botId, userId)) return res.status(403).json({ error: 'Keine Berechtigung' })
  const webhooks = await BotWebhook.find({ botId }).sort({ createdAt: -1 })
  res.json({ success: true, webhooks: webhooks.map(publicWebhook) })
})

router.get('/bot/:botId', authMiddleware, async (req: Request, res: Response) => {
  const userId = (req as any).userId
  if (!await ownedBot(req.params.botId, userId)) return res.status(403).json({ error: 'Keine Berechtigung' })
  const webhooks = await BotWebhook.find({ botId: req.params.botId }).sort({ createdAt: -1 })
  res.json({ success: true, webhooks: webhooks.map(publicWebhook) })
})

async function ownedWebhook(id: string, userId: string) {
  if (!mongoose.isValidObjectId(id)) return null
  const webhook = await BotWebhook.findById(id)
  if (!webhook || !await ownedBot(webhook.botId, userId)) return null
  return webhook
}

function publicDelivery(delivery: any) {
  const attempts = Array.isArray(delivery.attempts) ? delivery.attempts : []
  const lastAttempt = attempts[attempts.length - 1]
  return {
    _id: delivery._id,
    event: delivery.event,
    url: delivery.url,
    status: delivery.status,
    attemptCount: attempts.length,
    attempts,
    lastHttpStatus: lastAttempt?.httpStatus,
    lastError: lastAttempt?.error,
    durationMs: lastAttempt?.durationMs,
    replayOf: delivery.replayOf,
    completedAt: delivery.completedAt,
    createdAt: delivery.createdAt,
  }
}

router.get('/:id/deliveries', authMiddleware, async (req: Request, res: Response) => {
  const webhook = await ownedWebhook(req.params.id, (req as any).userId)
  if (!webhook) return res.status(404).json({ error: 'Webhook nicht gefunden' })
  const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100)
  const status = String(req.query.status || '')
  const query: any = { webhookId: webhook._id }
  if (['pending', 'success', 'failed'].includes(status)) query.status = status
  const [deliveries, total] = await Promise.all([
    WebhookDelivery.find(query).sort({ createdAt: -1 }).limit(limit),
    WebhookDelivery.countDocuments(query),
  ])
  res.json({ success: true, total, retentionDays: 30, deliveries: deliveries.map(publicDelivery) })
})

router.post('/:id/deliveries/:deliveryId/replay', authMiddleware, async (req: Request, res: Response) => {
  const webhook = await ownedWebhook(req.params.id, (req as any).userId)
  if (!webhook) return res.status(404).json({ error: 'Webhook nicht gefunden' })
  if (!webhook.active) return res.status(409).json({ error: 'Webhook ist pausiert' })
  if (!mongoose.isValidObjectId(req.params.deliveryId)) return res.status(404).json({ error: 'Zustellung nicht gefunden' })
  const delivery = await WebhookDelivery.findOne({ _id: req.params.deliveryId, webhookId: webhook._id }).select('+payloadEncrypted')
  if (!delivery) return res.status(404).json({ error: 'Zustellung nicht gefunden oder bereits abgelaufen' })
  try {
    const payload = JSON.parse(decryptField(delivery.payloadEncrypted))
    if (!allowedEvents.has(payload.event) || payload.botId !== webhook.botId) throw new Error('Gespeicherte Zustellung ist ungültig')
    const result = await sendWebhook(webhook, payload, 1, { replayOf: delivery._id.toString() })
    return res.status(result.success ? 200 : 502).json(result)
  } catch (error: any) {
    return res.status(400).json({ error: error.message || 'Zustellung konnte nicht wiederholt werden' })
  }
})

router.patch('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const webhook = await ownedWebhook(req.params.id, (req as any).userId)
    if (!webhook) return res.status(404).json({ error: 'Webhook nicht gefunden' })
    if (req.body.url !== undefined) { await validatePublicWebhookUrl(req.body.url); webhook.url = req.body.url }
    if (req.body.events !== undefined) { await validateInput(webhook.url, req.body.events); webhook.events = req.body.events }
    if (req.body.active !== undefined) webhook.active = req.body.active === true
    await webhook.save()
    res.json({ success: true, webhook: publicWebhook(webhook) })
  } catch (error: any) { res.status(400).json({ error: error.message || 'Fehler beim Aktualisieren' }) }
})

router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  const webhook = await ownedWebhook(req.params.id, (req as any).userId)
  if (!webhook) return res.status(404).json({ error: 'Webhook nicht gefunden' })
  await Promise.all([webhook.deleteOne(), WebhookDelivery.deleteMany({ webhookId: webhook._id })])
  res.json({ success: true })
})

router.post('/:id/test', authMiddleware, async (req: Request, res: Response) => {
  const webhook = await ownedWebhook(req.params.id, (req as any).userId)
  if (!webhook) return res.status(404).json({ error: 'Webhook nicht gefunden' })
  const result = await sendWebhook(webhook, {
    event: WebhookEvent.MESSAGE_CREATE,
    timestamp: new Date(), botId: webhook.botId, conversationId: 'test',
    data: { test: true, message: 'Nokki Webhook-Test' }
  })
  res.status(result.success ? 200 : 502).json(result)
})

router.post('/:id/regenerate-secret', authMiddleware, async (req: Request, res: Response) => {
  const webhook = await ownedWebhook(req.params.id, (req as any).userId)
  if (!webhook) return res.status(404).json({ error: 'Webhook nicht gefunden' })
  const secret = crypto.randomBytes(32).toString('hex')
  webhook.secret = encryptWebhookSecret(secret)
  await webhook.save()
  res.json({ success: true, secret, secretNotice: 'Dieses Secret wird nur einmal angezeigt.' })
})

export default router
