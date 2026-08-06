import { Router, Request, Response } from 'express';
import Conversation from '../models/Conversation';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// GET /api/conversations/my-channels
// Gibt alle Gruppen zurück wo User Admin ist (für Bot Installation)
router.get('/my-channels', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    // Finde alle Gruppen wo User Admin ist
    const conversations = await Conversation.find({
      isGroup: true,
      admins: userId,
    }).select('_id groupName groupAvatar isPublic participantCount');

    // Formatiere für Frontend
    const channels = conversations.map(conv => ({
      id: conv._id.toString(),
      name: conv.groupName || 'Unbenannte Gruppe',
      type: 'group' as const,
      avatar: (conv as any).groupAvatar,
      isPublic: (conv as any).isPublic || false,
    }));

    res.json({ channels });
  } catch (error) {
    console.error('Error fetching user channels:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Channels' });
  }
});

// GET /api/conversations/:conversationId/bots
// Liste aller Bots in einer Conversation
router.get('/:conversationId/bots', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const userId = (req as any).userId;

    const conversation = await Conversation.findById(conversationId)
      .populate('bots', 'name botId status');

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation nicht gefunden' });
    }

    // Prüfe ob User Mitglied ist
    const isMember = conversation.participants.some(
      p => p.toString() === userId
    );

    if (!isMember && !conversation.isPublic) {
      return res.status(403).json({ error: 'Keine Berechtigung' });
    }

    res.json({ bots: (conversation as any).bots || [] });
  } catch (error) {
    console.error('Error fetching conversation bots:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Bots' });
  }
});

export default router;