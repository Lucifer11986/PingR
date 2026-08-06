import express, { Request, Response } from 'express';
import Conversation from '../models/Conversation';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// GET /api/conversations/my-channels - Hole Channels/Gruppen wo User Owner/Admin ist
router.get('/my-channels', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    // Finde alle Conversations wo User Owner ODER Admin ist
    const conversations = await Conversation.find({
      $or: [
        { createdBy: userId },
        { admins: userId }
      ],
      type: { $in: ['group', 'channel'] }
    }).select('name type _id').sort({ name: 1 });

    // Formatiere für Frontend
    const channels = conversations.map(conv => ({
      id: conv._id.toString(),
      name: conv.name,
      type: conv.type === 'channel' ? 'channel' : 'group'
    }));

    res.json({ 
      success: true, 
      channels,
      count: channels.length 
    });
  } catch (error) {
    console.error('Get my channels error:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Channels' });
  }
});

export default router;