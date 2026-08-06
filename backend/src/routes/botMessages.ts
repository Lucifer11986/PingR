import express, { Request, Response } from 'express'
import Message from '../models/Message'
import Bot from '../models/Bot'
import BotInstallation from '../models/BotInstallation'
import Conversation from '../models/Conversation'
import { authMiddleware } from '../middleware/devAuth'
import { getIO } from '../socket/socketServer'
import { BotPermission } from '../models/BotCommand'
import { hasBotPermission } from '../utils/botPermissions'

const router = express.Router()

/**
 * DELETE /api/bot-messages/:messageId
 * Bot löscht eine Nachricht
 */
router.delete('/:messageId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params
    const { botId } = req.body
    const userId = (req as any).userId

    if (!botId) {
      return res.status(400).json({ error: 'botId erforderlich' })
    }

    // 1. Prüfe ob Message existiert
    const message = await Message.findById(messageId)
    if (!message) {
      return res.status(404).json({ error: 'Nachricht nicht gefunden' })
    }

    // 2. Prüfe ob Bot dem User gehört
    const bot = await Bot.findOne({ botId, ownerId: userId })
    if (!bot) {
      return res.status(403).json({ error: 'Keine Berechtigung für diesen Bot' })
    }

    // 3. Prüfe ob Bot in Conversation installiert ist
    const installation = await BotInstallation.findOne({
      botId,
      channelId: message.conversationId.toString(),
      active: true
    })
    if (!installation) {
      return res.status(403).json({ error: 'Bot nicht in dieser Conversation installiert' })
    }

    const isOwnBotMessage = message.isBotMessage && message.botId === botId
    if (!isOwnBotMessage && !hasBotPermission(installation.permissions, BotPermission.MANAGE_MESSAGES)) {
      return res.status(403).json({ error: 'Bot darf nur eigene Nachrichten löschen' })
    }

    // 4. Lösche Nachricht
    await Message.findByIdAndDelete(messageId)

    // 5. Socket.IO Event zu allen Usern im Chat
    const io = getIO()
    io.to(`conv:${message.conversationId}`).emit('message_deleted', {
      messageId: message._id,
      conversationId: message.conversationId,
      deletedBy: botId
    })

    console.log(`🗑️ [BOT-MESSAGES] Bot ${botId} deleted message ${messageId}`)

    res.json({ success: true, message: 'Nachricht gelöscht' })

  } catch (error) {
    console.error('❌ [BOT-MESSAGES] Delete error:', error)
    res.status(500).json({ error: 'Interner Serverfehler' })
  }
})

/**
 * PATCH /api/bot-messages/:messageId
 * Bot bearbeitet eigene Nachricht
 */
router.patch('/:messageId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params
    const { botId, content } = req.body
    const userId = (req as any).userId

    if (!botId || !content?.trim()) {
      return res.status(400).json({ error: 'botId und content erforderlich' })
    }

    // 1. Message finden
    const message = await Message.findById(messageId).populate('sender')
    if (!message) {
      return res.status(404).json({ error: 'Nachricht nicht gefunden' })
    }

    // 2. Bot Owner Check
    const bot = await Bot.findOne({ botId, ownerId: userId })
    if (!bot) {
      return res.status(403).json({ error: 'Keine Berechtigung für diesen Bot' })
    }

    // 3. Prüfe ob Bot der Sender ist (kann nur eigene Nachrichten bearbeiten)
    if (!message.isBotMessage || message.botId !== botId) {
      return res.status(403).json({ error: 'Kann nur eigene Nachrichten bearbeiten' })
    }

    // 4. Update Message
    message.content = content.trim()
    message.edited = true
    message.editedAt = new Date()
    await message.save()

    // 5. Populate sender für Socket Event
    await message.populate('sender')

    // 6. Socket.IO Event
    const io = getIO()
    io.to(`conv:${message.conversationId}`).emit('message_edited', {
      messageId: message._id,
      content: message.content,
      edited: true,
      editedAt: message.editedAt
    })

    console.log(`✏️ [BOT-MESSAGES] Bot ${botId} edited message ${messageId}`)

    res.json({ 
      success: true, 
      message: {
        _id: message._id,
        content: message.content,
        edited: message.edited,
        editedAt: message.editedAt
      }
    })

  } catch (error) {
    console.error('❌ [BOT-MESSAGES] Edit error:', error)
    res.status(500).json({ error: 'Interner Serverfehler' })
  }
})

/**
 * POST /api/bot-messages/:messageId/pin
 * Bot pinnt eine Nachricht
 */
router.post('/:messageId/pin', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params
    const { botId } = req.body
    const userId = (req as any).userId

    if (!botId) {
      return res.status(400).json({ error: 'botId erforderlich' })
    }

    // 1. Message finden
    const message = await Message.findById(messageId)
    if (!message) {
      return res.status(404).json({ error: 'Nachricht nicht gefunden' })
    }

    // 2. Bot Owner Check
    const bot = await Bot.findOne({ botId, ownerId: userId })
    if (!bot) {
      return res.status(403).json({ error: 'Keine Berechtigung für diesen Bot' })
    }

    // 3. Bot Installation Check
    const installation = await BotInstallation.findOne({
      botId,
      channelId: message.conversationId.toString(),
      active: true
    })
    if (!installation) {
      return res.status(403).json({ error: 'Bot nicht in dieser Conversation installiert' })
    }
    if (!hasBotPermission(installation.permissions, BotPermission.MANAGE_MESSAGES)) {
      return res.status(403).json({ error: 'MANAGE_MESSAGES-Berechtigung erforderlich' })
    }

    // 4. Update Conversation mit pinned message
    await Conversation.findByIdAndUpdate(
      message.conversationId,
      { $addToSet: { pinnedMessages: messageId } }
    )

    // 5. Socket Event
    const io = getIO()
    io.to(`conv:${message.conversationId}`).emit('message_pinned', {
      messageId: message._id,
      conversationId: message.conversationId,
      pinnedBy: botId
    })

    console.log(`📌 [BOT-MESSAGES] Bot ${botId} pinned message ${messageId}`)

    res.json({ success: true, message: 'Nachricht gepinnt' })

  } catch (error) {
    console.error('❌ [BOT-MESSAGES] Pin error:', error)
    res.status(500).json({ error: 'Interner Serverfehler' })
  }
})

/**
 * DELETE /api/bot-messages/:messageId/pin
 * Bot entfernt Pin von Nachricht
 */
router.delete('/:messageId/pin', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params
    const { botId } = req.body
    const userId = (req as any).userId

    if (!botId) {
      return res.status(400).json({ error: 'botId erforderlich' })
    }

    // 1. Message finden
    const message = await Message.findById(messageId)
    if (!message) {
      return res.status(404).json({ error: 'Nachricht nicht gefunden' })
    }

    // 2. Bot Owner Check
    const bot = await Bot.findOne({ botId, ownerId: userId })
    if (!bot) {
      return res.status(403).json({ error: 'Keine Berechtigung für diesen Bot' })
    }

    const installation = await BotInstallation.findOne({
      botId,
      channelId: message.conversationId.toString(),
      active: true
    })
    if (!installation || !hasBotPermission(installation.permissions, BotPermission.MANAGE_MESSAGES)) {
      return res.status(403).json({ error: 'MANAGE_MESSAGES-Berechtigung erforderlich' })
    }

    // 3. Remove from pinned messages
    await Conversation.findByIdAndUpdate(
      message.conversationId,
      { $pull: { pinnedMessages: messageId } }
    )

    // 4. Socket Event
    const io = getIO()
    io.to(`conv:${message.conversationId}`).emit('message_unpinned', {
      messageId: message._id,
      conversationId: message.conversationId,
      unpinnedBy: botId
    })

    console.log(`📌 [BOT-MESSAGES] Bot ${botId} unpinned message ${messageId}`)

    res.json({ success: true, message: 'Pin entfernt' })

  } catch (error) {
    console.error('❌ [BOT-MESSAGES] Unpin error:', error)
    res.status(500).json({ error: 'Interner Serverfehler' })
  }
})

export default router
