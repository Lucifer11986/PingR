import express, { Request, Response } from 'express';
import DevUser from '../models/DevUser';
import Bot from '../models/Bot';
import BotInstallation from '../models/BotInstallation';
import { adminAuth, requireAdminPermission } from '../middleware/adminAuth';

const router = express.Router();

// GET /api/admin/dev-stats - Statistiken Übersicht
router.get('/dev-stats', adminAuth, requireAdminPermission('stats'), async (req: Request, res: Response) => {
  try {
    const totalDevelopers = await DevUser.countDocuments();
    const totalBots = await Bot.countDocuments();
    const activeBots = await Bot.countDocuments({ status: 'active' });
    const totalInstallations = await BotInstallation.countDocuments({ active: true });

    // API Calls 30d - TODO: Implement API call tracking
    const apiCalls30d = 0;

    // Revenue - TODO: Implement payment tracking
    const revenue = 0;

    res.json({
      success: true,
      totalDevelopers,
      totalBots,
      activeBots,
      totalInstallations,
      apiCalls30d,
      revenue,
    });
  } catch (error) {
    console.error('Get dev stats error:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Stats' });
  }
});

// GET /api/admin/developers - Alle Developers
router.get('/developers', adminAuth, requireAdminPermission('users:read'), async (req: Request, res: Response) => {
  try {
    const developers = await DevUser.find()
      .select('username email plan createdAt')
      .sort({ createdAt: -1 });

    // Zähle Bots pro Developer
    const devsWithBots = await Promise.all(
      developers.map(async (dev) => {
        const botCount = await Bot.countDocuments({ ownerId: dev._id });
        return {
          _id: dev._id,
          username: dev.username,
          email: dev.email,
          plan: dev.plan || 'free',
          botCount,
          apiCalls30d: 0, // TODO: Implement tracking
          createdAt: dev.createdAt,
        };
      })
    );

    res.json({
      success: true,
      developers: devsWithBots,
      count: devsWithBots.length,
    });
  } catch (error) {
    console.error('Get developers error:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Developers' });
  }
});

// GET /api/admin/all-bots - Alle Bots
router.get('/all-bots', adminAuth, requireAdminPermission('users:read'), async (req: Request, res: Response) => {
  try {
    const bots = await Bot.find()
      .populate('ownerId', 'username')
      .sort({ createdAt: -1 });

    // Zähle Installationen pro Bot
    const botsWithStats = await Promise.all(
      bots.map(async (bot) => {
        const installations = await BotInstallation.countDocuments({
          botId: bot.botId,
          active: true,
        });

        return {
          _id: bot._id,
          name: bot.name,
          botId: bot.botId,
          ownerId: bot.ownerId,
          ownerUsername: (bot.ownerId as any)?.username || 'Unknown',
          status: bot.status,
          reviewStatus: (bot as any).reviewStatus || 'draft',
          reviewNote: (bot as any).reviewNote || '',
          isPublished: (bot as any).isPublished || false,
          installations,
          apiCalls: bot.stats?.apiCalls30d || 0,
          createdAt: bot.createdAt,
        };
      })
    );

    res.json({
      success: true,
      bots: botsWithStats,
      count: botsWithStats.length,
    });
  } catch (error) {
    console.error('Get all bots error:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Bots' });
  }
});

// POST /api/admin/bots/:botId/deactivate - Bot deaktivieren
router.post('/bots/:botId/deactivate', adminAuth, requireAdminPermission('superadmin'), async (req: Request, res: Response) => {
  try {
    const { botId } = req.params;

    const bot = await Bot.findOneAndUpdate(
      { botId },
      { status: 'inactive' },
      { new: true }
    );

    if (!bot) {
      return res.status(404).json({ error: 'Bot nicht gefunden' });
    }

    res.json({
      success: true,
      message: 'Bot deaktiviert',
      bot,
    });
  } catch (error) {
    console.error('Deactivate bot error:', error);
    res.status(500).json({ error: 'Fehler beim Deaktivieren' });
  }
});

router.post('/bots/:botId/approve', adminAuth, requireAdminPermission('superadmin'), async (req: Request, res: Response) => {
  const bot = await Bot.findOneAndUpdate(
    { botId: req.params.botId, reviewStatus: 'pending' },
    { status: 'active', isPublished: true, reviewStatus: 'approved', reviewNote: '' },
    { new: true }
  )
  if (!bot) return res.status(404).json({ error: 'Ausstehender Bot nicht gefunden' })
  res.json({ success: true, bot })
})

router.post('/bots/:botId/reject', adminAuth, requireAdminPermission('superadmin'), async (req: Request, res: Response) => {
  const note = String(req.body.reason || '').trim().slice(0, 500)
  const bot = await Bot.findOneAndUpdate(
    { botId: req.params.botId, reviewStatus: 'pending' },
    { status: 'inactive', isPublished: false, reviewStatus: 'rejected', reviewNote: note },
    { new: true }
  )
  if (!bot) return res.status(404).json({ error: 'Ausstehender Bot nicht gefunden' })
  res.json({ success: true, bot })
})

// GET /api/admin/developer/:id - Developer Details
router.get('/developer/:id', adminAuth, requireAdminPermission('users:read'), async (req: Request, res: Response) => {
  try {
    const developer = await DevUser.findById(req.params.id);
    
    if (!developer) {
      return res.status(404).json({ error: 'Developer nicht gefunden' });
    }

    const bots = await Bot.find({ ownerId: developer._id });
    const totalInstallations = await BotInstallation.countDocuments({
      botId: { $in: bots.map(b => b.botId) },
      active: true,
    });

    res.json({
      success: true,
      developer: {
        _id: developer._id,
        username: developer.username,
        email: developer.email,
        plan: developer.plan || 'free',
        createdAt: developer.createdAt,
        botCount: bots.length,
        totalInstallations,
        bots: bots.map(b => ({
          name: b.name,
          botId: b.botId,
          status: b.status,
        })),
      },
    });
  } catch (error) {
    console.error('Get developer details error:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Details' });
  }
});

export default router;
