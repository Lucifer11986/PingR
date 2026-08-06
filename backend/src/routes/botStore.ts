import express, { Request, Response } from 'express'
import Bot from '../models/Bot'
import BotInstallation from '../models/BotInstallation'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { addBotToTarget, canManageBotTarget, canViewBotTarget, findBotTarget, removeBotFromTarget } from '../utils/botAccess'
import { permissionsToBitfield } from '../utils/botPermissions'

const router = express.Router()
const BOT_VISIBLE = [{ isPublished: true }, { isNokki: true }]

// ── GET /api/bot-store/public ─────────────────────────────────────────────────
router.get('/public', async (req: Request, res: Response) => {
  try {
    const { category, search, sort = 'featured' } = req.query
    const visibility = BOT_VISIBLE
    const filter: any = { status: 'active', $or: visibility }
    if (category && category !== 'all') filter.category = category
    const { platform } = req.query
    if (platform && platform !== 'all') filter.platform = platform
    if (search) {
      filter.$and = [{ $or: visibility }, { $or: [
        { name:        { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags:        { $in: [new RegExp(String(search), 'i')] } },
      ] }]
      delete filter.$or
    }
    let sortObj: any = { featured: -1, isNokki: -1, verified: -1, createdAt: -1 }
    if (sort === 'newest') sortObj = { createdAt: -1 }
    if (sort === 'name')   sortObj = { name: 1 }

    const bots = await Bot.find(filter).populate('ownerId', 'username').sort(sortObj).limit(100).lean()
    const botsWithStats = await Promise.all(bots.map(async (bot: any) => {
      const installs = await BotInstallation.countDocuments({ botId: bot.botId, active: true })
      return {
        id: bot._id.toString(), name: bot.name, description: bot.description,
        longDescription: bot.longDescription || '', botId: bot.botId,
        ownerName: bot.ownerId?.username || 'Nokki',
        category: bot.category || 'utility', tags: bot.tags || [],
        verified: bot.verified || false, featured: bot.featured || false,
        isNokki: bot.isNokki || false, icon: bot.icon || '🤖',
        installs, commandPrefix: bot.commandPrefix || '/',
        permissions: bot.permissions || [], supportUrl: bot.supportUrl || '', createdAt: bot.createdAt,
      }
    }))
    res.json({ success: true, bots: botsWithStats, count: botsWithStats.length })
  } catch (err) {
    console.error('[BotStore]', err)
    res.status(500).json({ error: 'Fehler beim Laden der Bots' })
  }
})

// ── GET /api/bot-store/featured ───────────────────────────────────────────────
router.get('/featured', async (_req: Request, res: Response) => {
  try {
    const bots = await Bot.find({ status: 'active', featured: true, $or: BOT_VISIBLE })
      .populate('ownerId', 'username').sort({ isNokki: -1 }).limit(6).lean()
    const result = await Promise.all(bots.map(async (bot: any) => ({
      id: bot._id.toString(), name: bot.name, description: bot.description,
      botId: bot.botId, ownerName: bot.ownerId?.username || 'Nokki',
      category: bot.category || 'utility', tags: bot.tags || [],
      verified: bot.verified || false, featured: true, isNokki: bot.isNokki || false,
      icon: bot.icon || '🤖',
      installs: await BotInstallation.countDocuments({ botId: bot.botId, active: true }),
    })))
    res.json({ success: true, bots: result })
  } catch { res.status(500).json({ error: 'Fehler' }) }
})

// ── GET /api/bot-store/categories ─────────────────────────────────────────────
router.get('/categories', async (_req: Request, res: Response) => {
  try {
    const defs = [
      { id:'all',          label:'Alle Bots',    icon:'🤖' },
      { id:'utility',      label:'Utility',       icon:'🔧' },
      { id:'moderation',   label:'Moderation',    icon:'🛡️' },
      { id:'fun',          label:'Fun & Games',   icon:'🎮' },
      { id:'productivity', label:'Produktivität', icon:'📋' },
      { id:'info',         label:'Info & News',   icon:'📰' },
      { id:'games',        label:'Spiele',        icon:'🎲' },
      { id:'other',        label:'Sonstiges',     icon:'📦' },
    ]
    const categories = await Promise.all(defs.map(async d => ({
      ...d,
      count: d.id === 'all'
        ? await Bot.countDocuments({ status: 'active', $or: [{ isPublished: true }, { isNokki: true }] })
        : await Bot.countDocuments({ status: 'active', category: d.id, $or: [{ isPublished: true }, { isNokki: true }] }),
    })))
    res.json({ success: true, categories })
  } catch { res.status(500).json({ error: 'Fehler' }) }
})

// ── POST /api/bot-store/install (mit conversationId im Body) ──────────────────
// WICHTIG: Diese spezifischen Routen VOR /:botId definieren!
router.post('/install', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { botId, conversationId, channelName = 'Gruppe', channelType = 'group', permissions } = req.body
    if (!botId || !conversationId) { res.status(400).json({ error: 'botId und conversationId fehlen' }); return }
    const target = await findBotTarget(conversationId)
    if (!target) { res.status(404).json({ error: 'Gruppe oder Kanal nicht gefunden' }); return }
    if (!req.userId || !canManageBotTarget(target, req.userId)) { res.status(403).json({ error: 'Nur Gruppenadmins oder Kanalbesitzer können Bots installieren' }); return }
    const bot = await Bot.findOne({ botId, status: 'active', $or: BOT_VISIBLE })
    if (!bot) { res.status(404).json({ error: 'Bot nicht gefunden' }); return }
    const existing = await BotInstallation.findOne({ botId, channelId: conversationId })
    if (existing) {
      if (existing.active) { res.status(409).json({ error: 'Bot bereits installiert' }); return }
      existing.active = true; existing.installedBy = req.userId as any; existing.permissions = permissionsToBitfield(permissions); await existing.save()
    } else {
      await BotInstallation.create({
        botId, channelId: conversationId, channelName, channelType,
        installedBy: req.userId, active: true, permissions: permissionsToBitfield(permissions),
      })
    }
    await addBotToTarget(target, bot._id)
    res.json({ success: true, message: `${bot.name} erfolgreich installiert` })
  } catch (err) {
    console.error('[BotStore install]', err)
    res.status(500).json({ error: 'Fehler bei der Installation' })
  }
})

// ── GET /api/bot-store/installed/:conversationId ──────────────────────────────
// WICHTIG: Vor /:botId definieren!
router.get('/installed/:conversationId', authMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const { conversationId } = _req.params
    const target = await findBotTarget(conversationId)
    if (!target) { res.status(404).json({ error: 'Gruppe oder Kanal nicht gefunden' }); return }
    if (!_req.userId || !canViewBotTarget(target, _req.userId)) { res.status(403).json({ error: 'Kein Zugriff auf diese Unterhaltung' }); return }
    const installations = await BotInstallation.find({ channelId: conversationId, active: true }).lean()
    const botIds = installations.map((i: any) => i.botId)
    const bots = await Bot.find({ botId: { $in: botIds } }).lean()
    res.json({ success: true, bots: bots.map((b: any) => ({
      id: b._id.toString(), name: b.name, botId: b.botId,
      icon: b.icon || '🤖', description: b.description,
    }))})
  } catch { res.status(500).json({ error: 'Fehler' }) }
})

// ── GET /api/bot-store/:botId ─────────────────────────────────────────────────
router.get('/:botId', async (req: Request, res: Response) => {
  try {
    const bot = await Bot.findOne({ botId: req.params.botId, status: 'active', $or: [{ isPublished: true }, { isNokki: true }] })
      .populate('ownerId', 'username').lean() as any
    if (!bot) { res.status(404).json({ error: 'Bot nicht gefunden' }); return }
    const installs = await BotInstallation.countDocuments({ botId: bot.botId, active: true })
    res.json({ success: true, bot: {
      id: bot._id.toString(), name: bot.name, description: bot.description,
      longDescription: bot.longDescription || '', botId: bot.botId,
      ownerName: bot.ownerId?.username || 'Nokki',
      category: bot.category || 'utility', tags: bot.tags || [],
      verified: bot.verified || false, featured: bot.featured || false,
      isNokki: bot.isNokki || false, icon: bot.icon || '🤖',
      installs, commandPrefix: bot.commandPrefix || '/',
      permissions: bot.permissions || [], supportUrl: bot.supportUrl || '', createdAt: bot.createdAt,
    }})
  } catch { res.status(500).json({ error: 'Fehler' }) }
})

// ── POST /api/bot-store/:botId/install ───────────────────────────────────────
router.post('/:botId/install', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { conversationId, channelName = 'Gruppe', channelType = 'group', permissions } = req.body
    const { botId } = req.params
    if (!conversationId) { res.status(400).json({ error: 'conversationId fehlt' }); return }
    const target = await findBotTarget(conversationId)
    if (!target) { res.status(404).json({ error: 'Gruppe oder Kanal nicht gefunden' }); return }
    if (!req.userId || !canManageBotTarget(target, req.userId)) { res.status(403).json({ error: 'Nur Gruppenadmins oder Kanalbesitzer können Bots installieren' }); return }
    const bot = await Bot.findOne({ botId, status: 'active', $or: BOT_VISIBLE })
    if (!bot) { res.status(404).json({ error: 'Bot nicht gefunden' }); return }
    const existing = await BotInstallation.findOne({ botId, channelId: conversationId })
    if (existing) {
      if (existing.active) { res.status(409).json({ error: 'Bot bereits installiert' }); return }
      existing.active = true; existing.installedBy = req.userId as any; existing.permissions = permissionsToBitfield(permissions); await existing.save()
    } else {
      await BotInstallation.create({
        botId, channelId: conversationId, channelName, channelType,
        installedBy: req.userId, active: true, permissions: permissionsToBitfield(permissions),
      })
    }
    await addBotToTarget(target, bot._id)
    res.json({ success: true, message: `${bot.name} erfolgreich installiert` })
  } catch (err) {
    console.error('[BotStore install]', err)
    res.status(500).json({ error: 'Fehler bei der Installation' })
  }
})

// ── DELETE /api/bot-store/:botId/uninstall ────────────────────────────────────
router.delete('/:botId/uninstall', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { conversationId } = req.body
    const { botId } = req.params
    if (!conversationId) { res.status(400).json({ error: 'conversationId fehlt' }); return }
    const target = await findBotTarget(conversationId)
    if (!target) { res.status(404).json({ error: 'Gruppe oder Kanal nicht gefunden' }); return }
    if (!req.userId || !canManageBotTarget(target, req.userId)) { res.status(403).json({ error: 'Nur Gruppenadmins oder Kanalbesitzer können Bots deinstallieren' }); return }
    const installation = await BotInstallation.findOne({ botId, channelId: conversationId })
    if (!installation) { res.status(404).json({ error: 'Installation nicht gefunden' }); return }
    installation.active = false
    await installation.save()
    const bot = await Bot.findOne({ botId })
    if (bot) await removeBotFromTarget(target, bot._id)
    res.json({ success: true, message: 'Bot deinstalliert' })
  } catch { res.status(500).json({ error: 'Fehler' }) }
})

// ── POST /api/bot-store/publish/:botId ───────────────────────────────────────
router.post('/publish/:botId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const bot = await Bot.findOne({ botId: req.params.botId, ownerId: req.userId })
    if (!bot) { res.status(404).json({ error: 'Bot nicht gefunden' }); return }
    res.status(400).json({ error: 'Bitte den vollständigen Veröffentlichungsdialog im Developer-Portal verwenden' })
  } catch { res.status(500).json({ error: 'Fehler' }) }
})

// ── POST /api/bot-store/trigger (intern: von messages Route aufgerufen) ────────
router.post('/trigger', (_req: Request, res: Response) => {
  // Bot-Hooks werden ausschließlich serverintern aus der Nachrichtenroute aufgerufen.
  res.status(404).json({ error: 'Nicht gefunden' })
})

/* Legacy-Handler absichtlich nicht als öffentliche Route registrieren.
router.post('/trigger-internal', async (req: Request, res: Response) => {
  try {
    const { messageId, content, conversationId, senderId, senderName, type } = req.body
    await triggerBotHook({ _id: messageId, content, conversationId, senderId, senderName, type })
    res.json({ success: true })
  } catch { res.status(500).json({ error: 'Fehler' }) }
}) */

export default router
