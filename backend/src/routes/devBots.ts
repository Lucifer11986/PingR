import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import Bot from '../models/Bot';
import BotInstallation from '../models/BotInstallation';
import { authMiddleware } from '../middleware/devAuth';
import crypto from 'crypto';
import BotWebhook from '../models/BotWebhook';
import ScheduledMessage from '../models/ScheduledMessage';
import Giveaway from '../models/Giveaway';
import BotAnalytics from '../models/BotAnalytics';
import WebhookDelivery from '../models/WebhookDelivery';
import { validatePublicWebhookUrl } from '../utils/safeWebhookUrl';

const router = Router();
const VALID_PERMISSIONS = new Set(['READ_MESSAGES','SEND_MESSAGES','MANAGE_MESSAGES','MANAGE_MEMBERS','MANAGE_CHANNELS','ADMINISTRATOR'])
const cleanPermissions = (value: unknown) => Array.isArray(value)
  ? [...new Set(value.filter(item => typeof item === 'string' && VALID_PERMISSIONS.has(item)))]
  : ['READ_MESSAGES', 'SEND_MESSAGES']

// Hilfsfunktion: alle zugehörigen IDs über Email finden (case-insensitive)
async function getSearchIds(userId: string): Promise<any[]> {
  const searchIds: any[] = [userId]
  try {
    const DevUser = mongoose.model('DevUser')
    const User    = mongoose.model('User')
    const devUser = await DevUser.findById(userId).lean() as any
    if (devUser?.email) {
      const emailRegex = new RegExp(`^${devUser.email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
      const chatUser = await User.findOne({ email: { $regex: emailRegex } }).lean() as any
      if (chatUser) searchIds.push(chatUser._id)
      const otherDevUsers = await DevUser.find({ email: { $regex: emailRegex } }).lean() as any[]
      otherDevUsers.forEach((u: any) => { if (u._id.toString() !== userId) searchIds.push(u._id) })
    }
  } catch {}
  return searchIds
}

// Get all bots for authenticated user (eigene Dev-Bots + installierte Marktplatz-Bots)
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    // 1. Eigene Dev-Bots
    const ownBots = await Bot.find({ ownerId: userId });

    // 2. Installierte Marktplatz-Bots über Email-verknüpfte IDs
    const searchIds = await getSearchIds(userId)
    const installations = await BotInstallation.find({
      installedBy: { $in: searchIds },
      active: true,
    }).lean();

    const installedBotIds = [...new Set(installations.map((i: any) => i.botId))]
    const marketplaceBots = await Bot.find({
      botId: { $in: installedBotIds },
      isNokki: true,
      status: 'active',
    }).lean()

    const installationsByBot = installations.reduce((acc: any, inst: any) => {
      if (!acc[inst.botId]) acc[inst.botId] = []
      acc[inst.botId].push({ channelId: inst.channelId, channelName: inst.channelName, installationId: inst._id.toString() })
      return acc
    }, {})

    const marketplaceBotsMapped = marketplaceBots.map((bot: any) => ({
      id: bot._id, name: bot.name, description: bot.description,
      botId: bot.botId, status: bot.status, permissions: bot.permissions,
      icon: bot.icon || '🤖', isNokki: true, isMarketplace: true,
      installedIn: installationsByBot[bot.botId] || [],
      messages7d: bot.stats?.messages7d || 0, createdAt: bot.createdAt,
      stats: { totalMessages: bot.stats?.totalMessages || 0, apiCalls30d: bot.stats?.apiCalls30d || 0, lastActive: bot.stats?.lastActive || 'Nie' },
    }))

    res.json({
      bots: [
        ...ownBots.map(bot => ({
          id: bot._id, name: bot.name, description: bot.description,
          botId: bot.botId, status: bot.status, permissions: bot.permissions,
          isNokki: false, isMarketplace: false,
          messages7d: bot.stats?.messages7d || 0, createdAt: bot.createdAt,
          stats: { totalMessages: bot.stats?.totalMessages || 0, apiCalls30d: bot.stats?.apiCalls30d || 0, lastActive: bot.stats?.lastActive || 'Nie' },
        })),
        ...marketplaceBotsMapped,
      ],
    });
  } catch (error) {
    console.error('Get bots error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Bots' });
  }
});

// Create new bot
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { name, description, permissions } = req.body;

    if (!name || typeof name !== 'string' || !name.trim() || name.trim().length > 40) {
      return res.status(400).json({ error: 'Bot-Name erforderlich' });
    }

    const botId = `bot_${crypto.randomBytes(12).toString('base64url')}`;

    const newBot = new Bot({
      name: name.trim(),
      description: typeof description === 'string' ? description.trim().slice(0, 160) : '',
      botId,
      ownerId: userId,
      status: 'active',
      permissions: cleanPermissions(permissions),
      createdAt: new Date(),
      stats: { totalMessages: 0, apiCalls30d: 0, messages7d: 0, lastActive: 'Nie' },
    });

    await newBot.save();

    res.status(201).json({
      bot: { id: newBot._id, name: newBot.name, botId: newBot.botId, status: newBot.status },
    });
  } catch (error) {
    console.error('Create bot error:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen des Bots' });
  }
});

// Update bot
router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const botId = req.params.id;
    const { name, description, permissions, status, webhookUrl, supportUrl } = req.body;

    const bot = await Bot.findOne({ _id: botId, ownerId: userId });
    if (!bot) {
      return res.status(404).json({ error: 'Bot nicht gefunden' });
    }

    if (name) bot.name = String(name).trim().slice(0, 40);
    if (description !== undefined) bot.description = String(description).trim().slice(0, 160);
    if (permissions) bot.permissions = cleanPermissions(permissions);
    if (status && ['active', 'inactive'].includes(status)) bot.status = status;
    if (webhookUrl !== undefined) {
      if (webhookUrl) await validatePublicWebhookUrl(webhookUrl)
      ;(bot as any).webhookUrl = webhookUrl
    }
    if (supportUrl !== undefined) (bot as any).supportUrl = supportUrl;

    await bot.save();

    res.json({ message: 'Bot aktualisiert', bot });
  } catch (error) {
    console.error('Update bot error:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Bots' });
  }
});

// Delete bot
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const botId = req.params.id;

    const bot = await Bot.findOne({ _id: botId, ownerId: userId });
    if (!bot) {
      return res.status(404).json({ error: 'Bot nicht gefunden' });
    }
    await Promise.all([
      BotInstallation.deleteMany({ botId: bot.botId }),
      BotWebhook.deleteMany({ botId: bot.botId }),
      WebhookDelivery.deleteMany({ botId: bot.botId }),
      ScheduledMessage.deleteMany({ botId: bot.botId }),
      Giveaway.deleteMany({ botId: bot.botId }),
      BotAnalytics.deleteMany({ botId: bot.botId }),
    ])
    await bot.deleteOne()

    res.json({ message: 'Bot gelöscht' });
  } catch (error) {
    console.error('Delete bot error:', error);
    res.status(500).json({ error: 'Fehler beim Löschen des Bots' });
  }
});

// Uninstall marketplace bot
router.delete('/:botId/uninstall', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { botId } = req.params;
    const { channelId } = req.body;
    const searchIds = await getSearchIds(userId)

    if (channelId) {
      await BotInstallation.findOneAndUpdate(
        { botId, channelId, installedBy: { $in: searchIds } },
        { active: false }
      );
    } else {
      await BotInstallation.updateMany(
        { botId, installedBy: { $in: searchIds } },
        { active: false }
      );
    }

    res.json({ message: 'Bot deinstalliert' });
  } catch (error) {
    console.error('Uninstall bot error:', error);
    res.status(500).json({ error: 'Fehler beim Deinstallieren' });
  }
});

// Get installations for a marketplace bot
router.get('/:botId/installations', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const searchIds = await getSearchIds(userId)
    const installations = await BotInstallation.find({
      botId: req.params.botId, installedBy: { $in: searchIds }, active: true,
    }).lean();
    res.json({ installations: installations.map((i: any) => ({
      id: i._id.toString(), channelId: i.channelId, channelName: i.channelName,
      channelType: i.channelType, installedAt: i.installedAt,
    }))});
  } catch (error) {
    res.status(500).json({ error: 'Fehler' });
  }
});

// POST /:id/publish — Bot auf Marktplatz veröffentlichen
router.post('/:id/publish', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;
    const {
      description, longDescription, category, tags, icon,
      platform, commandPrefix, supportUrl, privacyUrl, webhookUrl,
    } = req.body;

    // Pflichtfelder prüfen
    if (!description?.trim())     return res.status(400).json({ error: 'Kurzbeschreibung fehlt' });
    if (!longDescription?.trim()) return res.status(400).json({ error: 'Ausführliche Beschreibung fehlt' });
    if (!category)                return res.status(400).json({ error: 'Kategorie fehlt' });
    if (!platform)                return res.status(400).json({ error: 'Plattform fehlt' });
    if (!icon?.trim())            return res.status(400).json({ error: 'Icon (Emoji) fehlt' });
    if (webhookUrl) await validatePublicWebhookUrl(webhookUrl)
    for (const url of [supportUrl, privacyUrl]) {
      if (url) { const parsed = new URL(url); if (parsed.protocol !== 'https:') return res.status(400).json({ error: 'Support- und Datenschutz-URLs müssen HTTPS verwenden' }) }
    }

    const bot = await Bot.findOne({ _id: id, ownerId: userId });
    if (!bot) return res.status(404).json({ error: 'Bot nicht gefunden' });

    // Bot aktualisieren und veröffentlichen
    bot.description     = description.trim();
    (bot as any).longDescription = longDescription.trim();
    (bot as any).category        = category;
    (bot as any).tags            = Array.isArray(tags) ? tags : (tags || '').split(',').map((t: string) => t.trim()).filter(Boolean);
    (bot as any).icon            = icon.trim();
    (bot as any).platform        = platform;
    (bot as any).commandPrefix   = commandPrefix || '/';
    (bot as any).supportUrl      = supportUrl || '';
    (bot as any).privacyUrl      = privacyUrl || '';
    (bot as any).webhookUrl      = webhookUrl || '';
    (bot as any).isPublished     = false;
    (bot as any).reviewStatus    = 'pending';
    (bot as any).reviewNote      = '';
    bot.status           = 'pending';

    await bot.save();

    res.json({ success: true, message: 'Bot zur Prüfung eingereicht', bot });
  } catch (error) {
    console.error('Publish bot error:', error);
    res.status(500).json({ error: 'Fehler beim Veröffentlichen' });
  }
});

// DELETE /:id/unpublish — Bot vom Marktplatz zurückziehen
router.delete('/:id/unpublish', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const bot = await Bot.findOne({ _id: req.params.id, ownerId: userId });
    if (!bot) return res.status(404).json({ error: 'Bot nicht gefunden' });
    (bot as any).isPublished = false;
    (bot as any).reviewStatus = 'draft';
    bot.status = 'inactive';
    await bot.save();
    res.json({ success: true, message: 'Bot vom Marktplatz zurückgezogen' });
  } catch (error) {
    res.status(500).json({ error: 'Fehler' });
  }
});

export default router;
