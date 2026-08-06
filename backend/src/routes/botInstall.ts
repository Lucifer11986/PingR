import express, { Request, Response } from 'express';
import BotInstallation from '../models/BotInstallation';
import Bot from '../models/Bot';
import Conversation from '../models/Conversation';
import { Channel }  from '../models/Channel';
import { authMiddleware } from '../middleware/devAuth';
import { dualAuthMiddleware } from '../middleware/dualAuth';
import { addBotToTarget, canManageBotTarget, findBotTarget, removeBotFromTarget } from '../utils/botAccess';
import { DEFAULT_BOT_PERMISSIONS } from '../utils/botPermissions';

const router = express.Router();

// POST /api/bot-install/install - Bot zu Channel/Gruppe hinzufügen (DUAL AUTH: Chat ODER Dev)
router.post('/install', dualAuthMiddleware, async (req: Request, res: Response) => {
  try {
    console.log('🔧 [BOT-INSTALL] Request body:', req.body);

    const { botId, channelId, channelName, channelType } = req.body;
    const userId = (req as any).userId;

    if ((req as any).tokenType !== 'chat') {
      return res.status(403).json({ error: 'Für Installationen ist ein Nokki-Chatkonto mit Adminrechten erforderlich' });
    }

    console.log('🔧 [BOT-INSTALL] userId from token:', userId);

    if (!botId || !channelId || !channelName) {
      console.log('❌ [BOT-INSTALL] Missing fields:', { botId, channelId, channelName });
      return res.status(400).json({ error: 'botId, channelId und channelName erforderlich' });
    }

    // Prüfe ob Bot existiert
    console.log('🔧 [BOT-INSTALL] Searching for bot:', botId);
    const bot = await Bot.findOne({ botId });
    console.log('🔧 [BOT-INSTALL] Bot found:', bot ? 'YES' : 'NO');

    if (!bot) {
      return res.status(404).json({ error: 'Bot nicht gefunden' });
    }

    // Prüfe ob Bot aktiv ist
    if (bot.status !== 'active') {
      console.log('❌ [BOT-INSTALL] Bot is inactive');
      return res.status(400).json({ error: 'Bot ist nicht aktiv' });
    }

    // Prüfe ob Conversation ODER Channel existiert
    console.log('🔧 [BOT-INSTALL] Checking conversation/channel:', channelId);

    const target = await findBotTarget(channelId)
    if (!target) {
      console.log('❌ [BOT-INSTALL] Conversation/Channel not found')
      return res.status(404).json({ error: 'Channel/Gruppe nicht gefunden' })
    }

    // Prüfe ob User Admin ist
    // Bei Channels: Owner oder admins; bei Gruppen: admins
    if (!canManageBotTarget(target, userId)) {
      return res.status(403).json({ error: 'Nur Admins/Owner können Bots installieren' })
    }

    // Prüfe ob Bot bereits installiert ist
    console.log('🔧 [BOT-INSTALL] Checking existing installation...');
    const existing = await BotInstallation.findOne({ botId, channelId });

    if (existing) {
      console.log('🔧 [BOT-INSTALL] Existing installation found, active:', existing.active);
      if (existing.active) {
        return res.status(400).json({ error: 'Bot ist bereits in diesem Channel installiert' });
      } else {
        // Re-aktivieren
        existing.active = true;
        await existing.save();

        // Füge Bot zu Conversation.bots Array hinzu (falls noch nicht drin)
        await addBotToTarget(target, bot._id)

        console.log('✅ [BOT-INSTALL] Bot re-activated');
        return res.json({
          success: true,
          message: 'Bot wurde reaktiviert',
          installation: existing
        });
      }
    }

    // Erstelle neue Installation
    const installation = new BotInstallation({
    botId,
    channelId,
    channelName,
    channelType,
    installedBy: userId,
    active: true,
    permissions: DEFAULT_BOT_PERMISSIONS
    })

    await installation.save();

    // Füge Bot zu Conversation.bots Array hinzu
    await addBotToTarget(target, bot._id)

    console.log('✅ [BOT-INSTALL] Installation created successfully!');

    res.json({
      success: true,
      message: 'Bot erfolgreich installiert!',
      installation
    });
  } catch (error) {
    console.error('❌ [BOT-INSTALL] Installation error:', error);
    res.status(500).json({ error: 'Fehler bei Bot-Installation' });
  }
});

// GET /api/bot-install/bot/:botId - Hole alle Installationen eines Bots
router.get('/bot/:botId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { botId } = req.params;
    const userId = (req as any).userId;
    const bot = await Bot.findOne({ botId, ownerId: userId });
    if (!bot) return res.status(403).json({ error: 'Keine Berechtigung für diesen Bot' });

    const installations = await BotInstallation.find({
      botId,
      active: true
    }).sort({ installedAt: -1 });

    res.json({
      success: true,
      installations,
      count: installations.length
    });
  } catch (error) {
    console.error('Get installations error:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Installationen' });
  }
});

// DELETE /api/bot-install/uninstall/:installationId - Bot von Channel entfernen
router.delete('/uninstall/:installationId', dualAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { installationId } = req.params;
    const userId = (req as any).userId;

    const installation = await BotInstallation.findById(installationId);
    if (!installation) {
      return res.status(404).json({ error: 'Installation nicht gefunden' });
    }

    const bot = await Bot.findOne({ botId: installation.botId });
    const target = await findBotTarget(installation.channelId)
    const isBotOwner = (req as any).tokenType === 'dev' && bot?.ownerId?.toString() === userId
    const isChatAdmin = (req as any).tokenType === 'chat' && !!target && canManageBotTarget(target, userId)
    if (!isBotOwner && !isChatAdmin) return res.status(403).json({ error: 'Keine Berechtigung zum Deinstallieren' });
    if (bot && target) await removeBotFromTarget(target, bot._id)

    installation.active = false;
    await installation.save();

    res.json({
      success: true,
      message: 'Bot wurde aus dem Channel entfernt'
    });
  } catch (error) {
    console.error('Uninstall error:', error);
    res.status(500).json({ error: 'Fehler beim Entfernen des Bots' });
  }
});

// POST /api/bot-install/send-test - Test-Nachricht senden
router.post('/send-test', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { botId, channelId, message } = req.body;
    const userId = (req as any).userId;

    if (!botId || !channelId || !message) {
      return res.status(400).json({ error: 'botId, channelId und message erforderlich' });
    }

    // Prüfe ob Bot in Channel installiert ist
    const installation = await BotInstallation.findOne({
      botId,
      channelId,
      active: true
    });

    if (!installation) {
      return res.status(400).json({ error: 'Bot ist nicht in diesem Channel installiert' });
    }

    // Prüfe ob Bot existiert und aktiv ist
    const bot = await Bot.findOne({ botId, status: 'active', ownerId: userId });
    if (!bot) {
      return res.status(404).json({ error: 'Bot nicht gefunden oder inaktiv' });
    }

    // TODO: Hier würdest du die Nachricht tatsächlich an den Chat senden
    // Für jetzt simulieren wir nur den Erfolg
    // In Produktion: await sendMessageToChannel(channelId, message, botId);

    res.json({
      success: true,
      message: 'Test-Nachricht erfolgreich gesendet!',
      data: {
        botId,
        channelId,
        text: message,
        sentAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Send test message error:', error);
    res.status(500).json({ error: 'Fehler beim Senden der Test-Nachricht' });
  }
});

// GET /api/bot-install/channel/:channelId - Alle Bots in einem Channel
router.get('/channel/:channelId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { channelId } = req.params;
    const userId = (req as any).userId;
    const ownedBots = await Bot.find({ ownerId: userId }).select('botId').lean();
    const ownedBotIds = ownedBots.map((bot: any) => bot.botId);

    const installations = await BotInstallation.find({
      channelId,
      active: true,
      botId: { $in: ownedBotIds }
    }).sort({ installedAt: -1 });

    res.json({
      success: true,
      installations,
      count: installations.length
    });
  } catch (error) {
    console.error('Get channel bots error:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Channel-Bots' });
  }
});

export default router;
