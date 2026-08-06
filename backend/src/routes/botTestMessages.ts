import express, { Request, Response } from 'express';
import BotInstallation from '../models/BotInstallation';
import Bot from '../models/Bot';
import Conversation from '../models/Conversation';
import { Message } from '../models/Message';
import { authMiddleware } from '../middleware/devAuth';
import { getBotSystemUserId } from '../utils/botMessageSender';

const router = express.Router();

// POST /api/bot-test/send - Test-Nachricht senden (mit Auto-Delete)
router.post('/send', authMiddleware, async (req: Request, res: Response) => {
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

    if (typeof message !== 'string' || !message.trim() || message.length > 2000) {
      return res.status(400).json({ error: 'Nachricht muss zwischen 1 und 2000 Zeichen lang sein' });
    }

    // Erstelle echte Nachricht in DB
    const testMessage = new Message({
      conversationId: channelId,
      sender: await getBotSystemUserId(),
      content: message.trim(),
      type: 'text',
      botId,
      botName: bot.name,
      isBotMessage: true,
      isTestMessage: true,
      createdAt: new Date()
    });

    await testMessage.save();

    // Update lastMessage der Conversation
    await Conversation.findByIdAndUpdate(channelId, {
      lastMessage: testMessage._id,
      updatedAt: new Date()
    });

    console.log(`✅ [TEST-MESSAGE] Saved to DB: ${testMessage._id}`);

    // Sende via Socket.IO an alle Gruppenmitglieder
    try {
      const { getIO } = require('../socket/socketServer');
      const io = getIO();

      // Populate Bot-Daten für Frontend
      const populatedMessage = await Message.findById(testMessage._id)
        .populate('sender', 'name botId status');

      io.to(`conv:${channelId}`).emit('new_message', {
        ...populatedMessage.toObject(),
        isTestMessage: true,
        autoDeleteIn: 30
      });

      console.log(`✅ [TEST-MESSAGE] Sent to conversation ${channelId} from bot ${bot.name}`);
    } catch (socketErr) {
      console.error('Socket emit error:', socketErr);
      // Nicht kritisch - Nachricht ist gespeichert
    }

    // Auto-Delete nach 30 Sekunden
    setTimeout(async () => {
      try {
        await Message.findByIdAndDelete(testMessage._id);
        
        // Benachrichtige Clients über Löschung
        const { getIO } = require('../socket/socketServer');
        getIO().to(`conv:${channelId}`).emit('message_deleted', {
          messageId: testMessage._id,
          conversationId: channelId
        });

        console.log(`🗑️ [TEST-MESSAGE] Auto-deleted message ${testMessage._id}`);
      } catch (delErr) {
        console.error('Auto-delete error:', delErr);
      }
    }, 30000); // 30 Sekunden

    res.json({
      success: true,
      message: 'Test-Nachricht gesendet! Löscht sich in 30 Sekunden.',
      data: {
        messageId: testMessage._id,
        botId,
        botName: bot.name,
        channelId,
        text: message,
        sentAt: testMessage.createdAt,
        autoDeleteIn: 30
      }
    });
  } catch (err) {
    console.error('Send test message error:', err);
    res.status(500).json({ error: 'Fehler beim Senden der Test-Nachricht' });
  }
});

export default router;
