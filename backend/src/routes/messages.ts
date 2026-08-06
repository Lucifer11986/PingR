import { Router, Response } from 'express'
import fs from 'fs'
import path from 'path'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { messageLimiter } from '../middleware/rateLimiter'
import { filterContent, filterFilename } from '../utils/contentFilter'
import { logSecurityEvent } from '../utils/securityLogger'
import { Message } from '../models/Message'
import { Conversation } from '../models/Conversation'
import { Report } from '../models/Report'
import { User } from '../models/User'
import { upload, verifyUpload } from '../middleware/upload'
import { getIO } from '../socket/socketServer'
import { Types } from 'mongoose'
import { checkAutoReplyRateLimit } from '../utils/redis'
import { triggerBotHook } from '../utils/botHook'
import { isConversationMember } from '../middleware/conversationAccess'
import { PUBLIC_USER_FIELDS } from '../utils/userFields'

const router = Router()
router.use(authMiddleware)

const TIMER_OPTIONS: Record<string,number> = {
  '30s':30,'5m':5*60,'1h':60*60,'1d':24*60*60,'7d':7*24*60*60,
}
function getExpiresAt(timer?: string): Date|undefined {
  if (!timer||!TIMER_OPTIONS[timer]) return undefined
  return new Date(Date.now()+TIMER_OPTIONS[timer]*1000)
}

function getDeliverAt(deliverAt?: string): Date|undefined {
  if (!deliverAt) return undefined
  const d = new Date(deliverAt)
  if (isNaN(d.getTime()) || d <= new Date()) return undefined
  return d
}
async function checkBan(userId: string, res: Response): Promise<boolean> {
  const user = await User.findById(userId).select('isBanned bannedReason')
  if (user?.isBanned) {
    res.status(403).json({ error: `Konto gesperrt: ${user.bannedReason}` }); return true
  }
  return false
}

// ── STATISCHE ROUTEN zuerst (vor /:id Wildcards) ──────────────

// GET /api/messages/search — Volltextsuche
router.get('/search', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { q, conversationId } = req.query as Record<string,string>
    if (!q || q.length < 2) { res.json([]); return }
    if (q.length > 100) { res.status(400).json({ error: 'Suchbegriff zu lang' }); return }
    const escapedQuery = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const filter: Record<string,unknown> = {
      content: { $regex: escapedQuery, $options: 'i' }, deleted: false,
    }
    if (conversationId) {
      if (!(await isConversationMember(conversationId, req.userId))) {
        res.status(403).json({ error: 'Keine Berechtigung für diese Unterhaltung' }); return
      }
      filter.conversationId = new Types.ObjectId(conversationId)
    } else {
      const convs = await Conversation.find({ participants: req.userId }).select('_id')
      filter.conversationId = { $in: convs.map(c => c._id) }
    }
    const messages = await Message.find(filter)
      .populate('sender', PUBLIC_USER_FIELDS)
      .sort({ createdAt: -1 }).limit(30)
    res.json(messages)
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// GET /api/messages/capsules/pending
router.get('/capsules/pending', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const messages = await Message.find({
      sender:    req.userId,
      delivered: false,
      deleted:   false,
      deliverAt: { $gt: new Date() },
    }).populate('sender', PUBLIC_USER_FIELDS).sort({ deliverAt: 1 })
    res.json(messages)
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// POST /api/messages/forward
// GET /api/messages/:conversationId
router.get("/:conversationId", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { conversationId } = req.params
    const userId = req.userId!
    const conv = await Conversation.findOne({ _id: conversationId, participants: userId })
    if (!conv) { res.status(404).json({ error: "Conversation nicht gefunden" }); return }
    const messages = await Message.find({ conversationId, deleted: false })
      .populate("sender", "username avatar").sort({ createdAt: -1 }).limit(100)
    res.json(messages.reverse())
  } catch (error) {
    console.error("GET messages error:", error)
    res.status(500).json({ error: "Server error" })
  }
})

// POST /api/messages/forward
router.post("/forward", messageLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (await checkBan(req.userId!, res)) return
    const { messageId, targetConversationId } = req.body
    if (!messageId || !targetConversationId) {
      res.status(400).json({ error: 'messageId und targetConversationId erforderlich' }); return
    }
    const original = await Message.findById(messageId)
    if (!original) { res.status(404).json({ error: 'Nachricht nicht gefunden' }); return }
    if (!(await isConversationMember(original.conversationId, req.userId)) ||
        !(await isConversationMember(targetConversationId, req.userId))) {
      res.status(403).json({ error: 'Keine Berechtigung für diese Unterhaltung' }); return
    }
    const message = await Message.create({
      conversationId: targetConversationId, sender: req.userId,
      content: original.content, type: original.type,
      fileUrl: original.fileUrl, fileName: original.fileName,
      readBy: [req.userId],
    })
    const populated = await message.populate('sender', PUBLIC_USER_FIELDS)
    await Conversation.findByIdAndUpdate(targetConversationId,{ lastMessage: message._id, updatedAt: new Date() })
    getIO().to(`conv:${targetConversationId}`).emit('new_message', populated)
    res.status(201).json(populated)
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// POST /api/messages/upload
router.post('/upload', messageLimiter, upload.single('file'), verifyUpload, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (await checkBan(req.userId!, res)) return
    if (!req.file) { res.status(400).json({ error: 'Keine Datei' }); return }
    const fc = filterFilename(req.file.originalname)
    if (fc.blocked) { try { fs.unlinkSync(req.file.path) } catch (_e) {}; res.status(400).json({ error: fc.reason }); return }
    const { conversationId, duration, timer } = req.body
    if (!(await isConversationMember(conversationId, req.userId))) {
      try { fs.unlinkSync(req.file.path) } catch (_e) {}
      res.status(403).json({ error: 'Keine Berechtigung für diese Unterhaltung' }); return
    }
    const isImage = req.file.mimetype.startsWith('image/')
    const isVoice = req.file.mimetype.startsWith('audio/')
    const message = await Message.create({
      conversationId, sender: req.userId, content: '',
      type: isVoice?'voice':isImage?'image':'file',
      fileUrl: `/uploads/${req.file.filename}`,
      fileName: req.file.originalname,
      duration: isVoice&&duration ? parseFloat(duration) : undefined,
      readBy: [req.userId], expiresAt: getExpiresAt(timer),
    })
    const populated = await message.populate('sender', PUBLIC_USER_FIELDS)
    await Conversation.findByIdAndUpdate(conversationId,{ lastMessage: message._id, updatedAt: new Date() })
    getIO().to(`conv:${conversationId}`).emit('new_message', populated)
    res.status(201).json(populated)
  } catch (_err) { res.status(500).json({ error: 'Upload fehlgeschlagen' }) }
})

// POST /api/messages (Text-Nachricht senden)
router.post('/', messageLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (await checkBan(req.userId!, res)) return
    const { conversationId, content, type='text', timer, replyToId, deliverAt: rawDeliverAt, metadata } = req.body
    const deliverAtDate = getDeliverAt(rawDeliverAt)
    const isTimeCapsule = !!deliverAtDate
    if (!conversationId||!content) {
      res.status(400).json({ error: 'conversationId und content erforderlich' }); return
    }
    if (typeof content !== 'string' || content.length > 10000) {
      res.status(400).json({ error: 'Nachricht ist zu lang' }); return
    }
    if (!(await isConversationMember(conversationId, req.userId))) {
      res.status(403).json({ error: 'Keine Berechtigung für diese Unterhaltung' }); return
    }
    const fr = filterContent(content)
    if (fr.blocked) {
      if (['child_safety','extremism_certain','terrorism_certain'].includes(fr.category||'')) {
        await logSecurityEvent({
          userId: req.userId!, content,
          eventType: fr.category==='child_safety'?'csam':fr.category==='terrorism_certain'?'terrorism':'extremism',
          legalBasis: fr.legalBasis||'',
          conversationId, ipAddress: req.ip, userAgent: req.headers['user-agent'],
        }).catch(()=>{})
        await User.findByIdAndUpdate(req.userId,{ $inc:{ warningCount:1 } })
      }
      res.status(400).json({ error: fr.reason, blocked: true, category: fr.category }); return
    }

    // Commands und Giveaway-Keywords nicht in DB speichern
    const isCommand = !isTimeCapsule && content.trim().startsWith('/')
    const isGiveawayKeyword = ['/teilnehmen', '/join'].includes(content.trim().toLowerCase())
    if (isCommand && !isGiveawayKeyword) {

      // 🤖 Nokki-Bot Commands: prüfe ob ein Nokki-Bot installiert ist → direkt an botEngine
      try {
        const BotInstallationModel = require('../models/BotInstallation').default
        const BotModel = require('../models/Bot').default
        const nokkiInstallation = await BotInstallationModel.findOne({
          channelId: conversationId, active: true, botId: /^nokki_/
        })
        if (nokkiInstallation) {
          const nokkiBot = await BotModel.findOne({ botId: nokkiInstallation.botId, status: 'active' })
          if (nokkiBot) {
            const user = await User.findById(req.userId).select('username').lean() as any
            triggerBotHook({
              _id:            '',
              content:        content,
              conversationId: conversationId,
              senderId:       req.userId!,
              senderName:     user?.username || 'Nutzer',
              type:           'text',
            })
            res.status(200).json({ success: true })
            return
          }
        }
      } catch (nokErr) { console.error('❌ [NOKKI-BOT]', nokErr) }

      // Nur Command verarbeiten, keine Nachricht speichern (Dev-Portal Bots)
      try {
        const { parseCommand, handleCommand } = require('../utils/commandParser')
        const { trackCommandUsage } = require('../utils/analyticsTracker')
        const BotInstallation = require('../models/BotInstallation').default
        const Bot = require('../models/Bot').default
        const ConversationMember = require('../models/ConversationMember').default
        const parsed = parseCommand(content)
        if (parsed) {
          const installation = await BotInstallation.findOne({ channelId: conversationId, active: true })
          if (installation) {
            const bot = await Bot.findOne({ botId: installation.botId })
            if (bot) {
              let userRoles: string[] = ['member']
              try {
                const member = await ConversationMember.findOne({ conversationId, userId: req.userId, isActive: true })
                if (member?.roles?.length > 0) userRoles = member.roles
              } catch {}
              const context = { botId: installation.botId, conversationId, userId: req.userId!, username: req.userId, userRoles, message: content }
              const result = await handleCommand(parsed, context)
              await trackCommandUsage(result.data?.command?.commandId || parsed.name, installation.botId, conversationId, req.userId!, result.success, 0, result.error)
              if (result.success && result.data?.interactive) {
                getIO().to(`conv:${conversationId}`).emit('command_interactive', { command: result.data.command, args: parsed.args, userId: req.userId })
              }
            }
          }
        }
      } catch (cmdErr) { console.error('❌ [COMMAND]', cmdErr) }
      res.status(200).json({ success: true })
      return
    }

    const message = await Message.create({
      conversationId, sender: req.userId, content, type,
      readBy: [req.userId], expiresAt: getExpiresAt(timer),
      replyTo: replyToId||undefined, flagged: fr.flagged||false,
      deliverAt: deliverAtDate,
      delivered: !isTimeCapsule,
      metadata,
    })
    if (fr.flagged) {
      await logSecurityEvent({
        userId: req.userId!, content, eventType: 'flagged_review',
        legalBasis: fr.legalBasis||'§130 prüfungsbedürftig',
        conversationId, messageId: message._id.toString(), ipAddress: req.ip,
      }).catch(()=>{})
    }
    const populated = await message.populate([
      { path:'sender', select:PUBLIC_USER_FIELDS }, { path:'replyTo' }
    ])
    
    
    // Zeitkapsel: Conversation NICHT updaten und NICHT per Socket senden
    if (!isTimeCapsule) {
      await Conversation.findByIdAndUpdate(conversationId,{ lastMessage: message._id, updatedAt: new Date() })
      // Commands nicht im Chat anzeigen (Bot antwortet separat)
      if (!isCommand) {
        getIO().to(`conv:${conversationId}`).emit('new_message', populated)

        // 🤖 Bot Engine: prüfe ob Bots in dieser Conversation installiert sind
        triggerBotHook({
          _id:            message._id.toString(),
          content:        content,
          conversationId: conversationId,
          senderId:       req.userId!,
          senderName:     (populated.sender as any)?.username || 'Nutzer',
          type:           type,
        })
      }

      // 🔒 SECURITY FIX: Auto-Reply mit Redis Rate-Limiting
      try {
        const conv = await Conversation.findById(conversationId)
        if (conv && !conv.isGroup) {
          const { Identity } = require('../models/Identity')
          
          // ✅ SPAM-SCHUTZ 1: Keine Auto-Reply auf Auto-Reply
          if (metadata?.isAutoReply) {
            console.log('[Auto-Reply] Skipped: incoming message is already auto-reply')
          } else {
            // Finde die andere Partei
            const otherId = conv.participants.find((p: any) => String(p) !== req.userId)
            if (otherId) {
              const otherIdent = await Identity.findOne({ userId: otherId, isActive: true })
              if (otherIdent?.settings?.quietHoursFrom && otherIdent?.settings?.autoReply) {
                const now = new Date()
                const h = now.getHours() * 60 + now.getMinutes()
                const [fh, fm] = otherIdent.settings.quietHoursFrom.split(':').map(Number)
                const [th, tm] = (otherIdent.settings.quietHoursTo || '08:00').split(':').map(Number)
                const from = fh * 60 + fm
                const to   = th * 60 + tm
                const inQH = from > to ? (h >= from || h < to) : (h >= from && h < to)
                
                if (inQH) {
                  // ✅ SPAM-SCHUTZ 2: Redis Rate-Limiting (10 Minuten)
                  const canSend = await checkAutoReplyRateLimit(
                    otherIdent._id.toString(),
                    conversationId
                  )

                  if (canSend) {
                    const autoMsg = await Message.create({
                      conversationId, 
                      sender: otherId,
                      content: otherIdent.settings.autoReply,
                      type: 'text', 
                      readBy: [otherId],
                      metadata: { isAutoReply: true },
                    })
                    const autoPopulated = await autoMsg.populate('sender', PUBLIC_USER_FIELDS)
                    await Conversation.findByIdAndUpdate(conversationId, {
                      lastMessage: autoMsg._id, 
                      updatedAt: new Date(),
                    })
                    getIO().to(`conv:${conversationId}`).emit('new_message', autoPopulated)
                    
                    console.log(`[Auto-Reply] Sent for identity ${otherIdent._id}`)
                  } else {
                    console.log(`[Auto-Reply] Rate-limited (Redis key exists)`)
                  }
                }
              }
            }
          }
        }
      } catch (e) { 
        console.error('[Auto-Reply] Error:', e) 
      }

      // 🎉 GIVEAWAY KEYWORD LISTENER
      try {
        const trimmed = content.trim().toLowerCase()
        if (trimmed === '/teilnehmen' || trimmed === '/join') {
          const Giveaway = require('../models/Giveaway').default
          const BotInstallation = require('../models/BotInstallation').default
          const Bot = require('../models/Bot').default
          const installation = await BotInstallation.findOne({ channelId: conversationId, active: true })
          const bot = installation ? await Bot.findOne({ botId: installation.botId }) : null
          const botId = bot?._id || req.userId
          const username = (populated.sender as any).username || 'Ein User'
          const giveaway = await Giveaway.findOne({ conversationId, status: 'active' })
          if (giveaway) {
            const alreadyIn = giveaway.participants.some((p: any) => p.toString() === req.userId)
            if (alreadyIn) {
              const msg = await Message.create({ conversationId, sender: botId, content: `ℹ️ **${username}**, du nimmst bereits am Giveaway teil!`, type: 'text', readBy: [req.userId] })
              const pop = await msg.populate('sender', PUBLIC_USER_FIELDS)
              getIO().to(`conv:${conversationId}`).emit('new_message', pop)
            } else {
              giveaway.participants.push(req.userId)
              await giveaway.save()
              const msg = await Message.create({ conversationId, sender: botId, content: `🎉 **${username}** hat erfolgreich am Giveaway **"${giveaway.prize}"** teilgenommen! (${giveaway.participants.length} Teilnehmer)`, type: 'text', readBy: [req.userId] })
              const pop = await msg.populate('sender', PUBLIC_USER_FIELDS)
              getIO().to(`conv:${conversationId}`).emit('new_message', pop)
              getIO().to(`conv:${conversationId}`).emit('giveaway_updated', { giveawayId: giveaway._id, participants: giveaway.participants })
            }
          }
        }
      } catch (gErr) { console.error('❌ [GIVEAWAY-KEYWORD]', gErr) }
    }
    res.status(201).json(populated)
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})// ── DYNAMISCHE ROUTEN /:id ────────────────────────────────────

// GET /api/messages?conversationId=...
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const conversationId = req.query.conversationId as string
    if (!conversationId) { res.status(400).json({ error: 'conversationId erforderlich' }); return }
    if (!(await isConversationMember(conversationId, req.userId))) {
      res.status(403).json({ error: 'Keine Berechtigung für diese Unterhaltung' }); return
    }
    const messages = await Message.find({ conversationId, deleted: false })
      .populate([
        { path:'sender', select:PUBLIC_USER_FIELDS },
        { path:'replyTo', populate:{ path:'sender', select:'username avatar' } }
      ]).sort({ createdAt: 1 })
    res.json(messages)
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// PATCH /api/messages/:id/read
router.patch('/:id/read', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const existing = await Message.findById(req.params.id).select('conversationId')
    if (!existing) { res.status(404).json({ error: 'Nicht gefunden' }); return }
    if (!(await isConversationMember(existing.conversationId, req.userId))) {
      res.status(403).json({ error: 'Keine Berechtigung' }); return
    }
    const message = await Message.findByIdAndUpdate(req.params.id, { $addToSet:{ readBy:req.userId } }, { new:true }).populate('sender', PUBLIC_USER_FIELDS)
    if (!message) { res.status(404).json({ error: 'Nicht gefunden' }); return }
    getIO().to(`conv:${message.conversationId}`).emit('message_read',{
      messageId:message._id, conversationId:message.conversationId, userId:req.userId,
    })
    res.json({ ok:true })
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// PATCH /api/messages/:id/read-silent
router.patch('/:id/read-silent', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const message = await Message.findById(req.params.id).select('conversationId')
    if (!message) { res.status(404).json({ error: 'Nicht gefunden' }); return }
    if (!(await isConversationMember(message.conversationId, req.userId))) {
      res.status(403).json({ error: 'Keine Berechtigung' }); return
    }
    await Message.findByIdAndUpdate(req.params.id,{ $addToSet:{ seenSilently:req.userId } })
    res.json({ ok:true })
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// PATCH /api/messages/:id/edit
router.patch('/:id/edit', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { content } = req.body
    if (!content?.trim()) { res.status(400).json({ error: 'Inhalt fehlt' }); return }
    const fr = filterContent(content)
    if (fr.blocked) { res.status(400).json({ error: fr.reason }); return }
    const message = await Message.findById(req.params.id).populate('sender', PUBLIC_USER_FIELDS)
    if (!message) { res.status(404).json({ error: 'Nicht gefunden' }); return }
    if (!(await isConversationMember(message.conversationId, req.userId))) {
      res.status(403).json({ error: 'Keine Berechtigung' }); return
    }
    if (message.sender._id.toString()!==req.userId) {
      res.status(403).json({ error: 'Nicht erlaubt' }); return
    }
    if (Date.now()-new Date(message.createdAt).getTime()>5*60*1000) {
      res.status(403).json({ error: 'Bearbeitungsfenster abgelaufen' }); return
    }
    message.content=content.trim(); message.edited=true; message.editedAt=new Date()
    await message.save()
    getIO().to(`conv:${message.conversationId}`).emit('message_edited',message)
    res.json(message)
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// DELETE /api/messages/:id
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const message = await Message.findById(req.params.id).populate('sender', PUBLIC_USER_FIELDS)
    if (!message) { res.status(404).json({ error: 'Nicht gefunden' }); return }
    if (!(await isConversationMember(message.conversationId, req.userId))) {
      res.status(403).json({ error: 'Keine Berechtigung' }); return
    }
    if (message.sender._id.toString()!==req.userId) {
      res.status(403).json({ error: 'Nicht erlaubt' }); return
    }
    // Datei vom Server löschen (DSGVO: keine verwaisten Uploads)
    if ((message as any).fileUrl) {
      try {
        const filePath = path.join('/app/uploads', path.basename((message as any).fileUrl))
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
        }
      } catch (_fe) { /* Datei bereits gelöscht oder nicht gefunden */ }
    }

    message.deleted = true
    message.content = ''
    ;(message as any).fileUrl  = undefined
    ;(message as any).fileName = undefined
    await message.save()
    getIO().to(`conv:${message.conversationId}`).emit('message_deleted',{
      messageId:message._id, conversationId:message.conversationId,
    })
    res.json({ ok:true })
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// POST /api/messages/:id/reaction
router.post('/:id/reaction', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { emoji } = req.body
    const message = await Message.findById(req.params.id).populate('sender', PUBLIC_USER_FIELDS)
    if (!message) { res.status(404).json({ error: 'Nicht gefunden' }); return }
    if (!(await isConversationMember(message.conversationId, req.userId))) {
      res.status(403).json({ error: 'Keine Berechtigung' }); return
    }
    const i = message.reactions.findIndex(r=>r.userId.toString()===req.userId&&r.emoji===emoji)
    if (i>=0) message.reactions.splice(i,1)
    else message.reactions.push({ emoji, userId: new Types.ObjectId(req.userId) as any, username:'' })
    await message.save()
    getIO().to(`conv:${message.conversationId}`).emit('reaction_added',message)
    res.json(message)
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

// POST /api/messages/:id/report
router.post('/:id/report', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { reason, description } = req.body
    if (!reason) { res.status(400).json({ error: 'Grund fehlt' }); return }

    let message = null
    try {
      message = await Message.findById(req.params.id)
    } catch (_err) {
      res.status(404).json({ error: 'Nachricht nicht gefunden' }); return
    }
    if (!message) { res.status(404).json({ error: 'Nachricht nicht gefunden' }); return }
    if (!(await isConversationMember(message.conversationId, req.userId))) {
      res.status(403).json({ error: 'Keine Berechtigung' }); return
    }

    await Report.create({
      reporter:        req.userId,
      reportedUser:    message.sender,
      reportedMessage: message._id,
      reason:          reason,
      description:     description || '',
      autoDetected:    false,
      status:          'open',
    })

    await User.findByIdAndUpdate(message.sender, { $inc: { reportCount: 1 } })

    res.json({ ok: true, message: 'Meldung erfolgreich eingereicht' })
  } catch (err) {
    console.error('Report error:', err)
    res.status(500).json({ error: 'Serverfehler beim Melden' })
  }
})

// DELETE /api/messages/capsules/:id
router.delete('/capsules/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const message = await Message.findById(req.params.id)
    if (!message) { res.status(404).json({ error: 'Nicht gefunden' }); return }
    if (message.sender.toString() !== req.userId) { res.status(403).json({ error: 'Nicht erlaubt' }); return }
    if (message.delivered) { res.status(400).json({ error: 'Bereits zugestellt' }); return }
    message.deleted = true
    await message.save()
    res.json({ ok: true })
  } catch (_err) { res.status(500).json({ error: 'Serverfehler' }) }
})

export default router
