// /opt/pingr/backend/src/utils/botEngine.ts
// Kern-Engine: verarbeitet neue Nachrichten, löst Commands & Trigger aus

import { getIO } from '../socket/socketServer'
import { Message } from '../models/Message'
import Bot from '../models/Bot'
import BotInstallation from '../models/BotInstallation'
import { Conversation } from '../models/Conversation'
import { User } from '../models/User'
import { PUBLIC_USER_FIELDS } from './userFields'
import { getBotSystemUserId } from './botMessageSender'
import { validatePublicWebhookUrl } from './safeWebhookUrl'
import crypto from 'crypto'
import { BotPermission } from '../models/BotCommand'
import { hasBotPermission } from './botPermissions'

// ── Typen ─────────────────────────────────────────────────────────────────────
interface IncomingMessage {
  _id:            string
  content:        string
  conversationId: string
  senderId:       string
  senderName:     string
  type?:          string
}

interface BotContext {
  conversationId: string
  senderId:       string
  senderName:     string
  args:           string[]
  rawContent:     string
}

// ── Laufende Zustände (In-Memory) ─────────────────────────────────────────────
const activePolls    = new Map<string, Poll>()       // key: `${conversationId}:${botId}`
const activeReminders = new Map<string, NodeJS.Timeout[]>()
const activeGiveaways = new Map<string, Giveaway>()
const warnCounts     = new Map<string, number>()     // key: `${conversationId}:${userId}`
const slowmodeCooldown = new Map<string, number>()   // key: `${conversationId}:${userId}`
const msgCounts      = new Map<string, { count:number; resetAt:number }>() // für stats

interface Poll {
  question:    string
  options:     string[]
  votes:       Record<number, string[]>  // optionIndex → userId[]
  createdBy:   string
  endsAt:      number
  messageId?:  string
}

interface Giveaway {
  prize:       string
  participants: string[]
  endsAt:      number
  createdBy:   string
  messageId?:  string
}

// ── Bot-Nachricht senden (als System-Bot) ─────────────────────────────────────
async function sendBotMessage(conversationId: string, content: string, botName = 'Nokki Bot', botId?: string) {
  try {
    const senderId = await getBotSystemUserId()

    const msg = await (Message as any).create({
      content,
      conversationId,
      sender:   senderId,
      type:     'text',
      botName,
      botId,
      isBotMessage: true,
      sentAt:   new Date(),
      readBy:   [],
      metadata: { isBot: true, botName },
    })
    const populated = await (Message as any).findById(msg._id).populate('sender', PUBLIC_USER_FIELDS).lean()
    const io = getIO()
    io.to(`conv:${conversationId}`).emit('new_message', {
      ...(populated || msg),
      botName,
      isBot: true,
    })
    return msg
  } catch (err) {
    console.error('[BotEngine] sendBotMessage error:', err)
  }
}

// ── Haupt-Entry-Point ─────────────────────────────────────────────────────────
export async function processBotMessage(msg: IncomingMessage) {
  try {
    // Welche Bots sind in dieser Conversation installiert?
    const installations = await BotInstallation.find({
      channelId: msg.conversationId,
      active:    true,
    }).lean()

    if (!installations.length) return

    const botIds = installations
      .filter((installation: any) => hasBotPermission(installation.permissions, BotPermission.READ_MESSAGES))
      .map((i: any) => i.botId)
    const bots   = await Bot.find({ botId: { $in: botIds }, status: 'active' }).lean()

    for (const bot of bots) {
      await runBotLogic(bot, msg)
    }
  } catch (err) {
    console.error('[BotEngine] processBotMessage error:', err)
  }
}

// ── Pro-Bot-Logik ─────────────────────────────────────────────────────────────
async function runBotLogic(bot: any, msg: IncomingMessage) {
  const content = msg.content?.trim() || ''
  const prefix  = bot.commandPrefix || '/'
  const isCmd   = content.startsWith(prefix)
  const parts   = content.slice(prefix.length).split(/\s+/)
  const cmd     = isCmd ? parts[0]?.toLowerCase() : ''
  const args    = parts.slice(1)

  const ctx: BotContext = {
    conversationId: msg.conversationId,
    senderId:       msg.senderId,
    senderName:     msg.senderName,
    args,
    rawContent:     content,
  }

  // Externer Bot mit Webhook-URL → HTTP-Request senden
  if (bot.webhookUrl && !bot.isNokki) {
    try {
      await validatePublicWebhookUrl(bot.webhookUrl)
      const payload = JSON.stringify({
        event:          'message',
        botId:          bot.botId,
        conversationId: msg.conversationId,
        content:        msg.content,
        senderId:       msg.senderId,
        senderName:     msg.senderName,
        timestamp:      new Date().toISOString(),
      })
      const signature = crypto.createHmac('sha256', process.env.BOT_WEBHOOK_SECRET || process.env.JWT_SECRET || '')
        .update(payload).digest('hex')
      const response = await fetch(bot.webhookUrl, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(5000), body: payload,
        headers: { 'Content-Type': 'application/json', 'X-Nokki-Signature': signature, 'X-Nokki-Bot-ID': bot.botId }
      })
      const contentLength = Number(response.headers.get('content-length') || 0)
      if (!response.ok || contentLength > 64 * 1024) return
      const data = (await response.text()).slice(0, 64 * 1024)
      const result = JSON.parse(data)
      const replies = [result.reply, ...(Array.isArray(result.replies) ? result.replies.slice(0, 4) : [])]
      for (const reply of replies) {
        if (typeof reply === 'string' && reply.trim()) await sendBotMessage(msg.conversationId, reply.slice(0, 2000), bot.name, bot.botId)
      }
    } catch (err) {
      console.error(`[BotEngine] Webhook error for ${bot.botId}:`, err)
    }
    return
  }

  // Interne Nokki-Bots
  switch (bot.botId) {
    case 'nokki_welcome':
      await handleWelcomeBot(bot, cmd, ctx)
      break
    case 'nokki_reminder':
      await handleReminderBot(bot, cmd, ctx)
      break
    case 'nokki_stats':
      await handleStatsBot(bot, cmd, ctx)
      break
    case 'nokki_moderation':
      await handleModerationBot(bot, content, ctx)
      break
    case 'nokki_fun':
      await handleFunBot(bot, cmd, ctx)
      break
    case 'nokki_news':
      await handleNewsBot(bot, cmd, ctx)
      break
    case 'nokki_weather':
      await handleWeatherBot(bot, cmd, ctx)
      break
    case 'nokki_music':
      await handleMusicBot(bot, cmd, ctx)
      break
    case 'nokki_quote':
      await handleQuoteBot(bot, cmd, ctx)
      break
    case 'nokki_translate':
      await handleTranslateBot(bot, cmd, ctx)
      break
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 👋 WELCOME BOT
// ══════════════════════════════════════════════════════════════════════════════
async function handleWelcomeBot(bot: any, cmd: string, ctx: BotContext) {
  if (cmd === 'setwelcome') {
    const msg = ctx.args.join(' ')
    if (!msg) {
      await sendBotMessage(ctx.conversationId,
        `👋 **Welcome Bot** – Verwendung:\n\`/setwelcome Willkommen {name} in der Gruppe!\`\n\n{name} wird durch den Nutzernamen ersetzt.`,
        bot.name)
      return
    }
    // Willkommensnachricht in Conversation speichern
    await (Conversation as any).findByIdAndUpdate(ctx.conversationId, {
      $set: { 'botSettings.welcomeMessage': msg }
    })
    await sendBotMessage(ctx.conversationId,
      `✅ Willkommensnachricht gesetzt:\n*${msg}*`, bot.name)
    return
  }

  if (cmd === 'welcome') {
    await sendBotMessage(ctx.conversationId,
      `👋 Willkommen **${ctx.senderName}**! Schön dass du hier bist. Genieße deinen Aufenthalt! 🎉`,
      bot.name)
  }
}

// Bot reagiert auf neue Mitglieder (wird extern aufgerufen)
export async function onMemberJoined(conversationId: string, username: string) {
  const installation = await BotInstallation.findOne({
    botId: 'nokki_welcome', channelId: conversationId, active: true
  }).lean()
  if (!installation) return

  const conv = await (Conversation as any).findById(conversationId).lean() as any
  const customMsg = conv?.botSettings?.welcomeMessage

  const text = customMsg
    ? customMsg.replace('{name}', username)
    : `👋 Herzlich willkommen **${username}**! Schön dass du dabei bist! 🎉`

  await sendBotMessage(conversationId, text, 'Nokki Welcome Bot')
}

// ══════════════════════════════════════════════════════════════════════════════
// 📊 POLL BOT
// ══════════════════════════════════════════════════════════════════════════════
async function handlePollBot(bot: any, cmd: string, ctx: BotContext) {
  const key = `${ctx.conversationId}:poll`

  if (cmd === 'poll') {
    // /poll Frage? Option1 | Option2 | Option3
    const full = ctx.args.join(' ')
    const [question, ...optionParts] = full.split('|')
    const options = optionParts.map(o => o.trim()).filter(Boolean)

    if (!question || options.length < 2) {
      await sendBotMessage(ctx.conversationId,
        `📊 **Poll Bot** – Verwendung:\n\`/poll Deine Frage? | Option A | Option B | Option C\`\n\nMinimal 2 Optionen, maximal 5.`,
        bot.name)
      return
    }

    if (activePolls.has(key)) {
      await sendBotMessage(ctx.conversationId,
        `⚠️ Es läuft bereits eine Umfrage! Beende sie mit \`/endpoll\`.`, bot.name)
      return
    }

    const poll: Poll = {
      question: question.trim(),
      options:  options.slice(0, 5),
      votes:    {},
      createdBy: ctx.senderId,
      endsAt:   Date.now() + 10 * 60 * 1000, // 10 Min Standard
    }
    activePolls.set(key, poll)

    const optionLines = options.slice(0,5).map((o, i) =>
      `${['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣'][i]} ${o}`).join('\n')

    await sendBotMessage(ctx.conversationId,
      `📊 **Neue Umfrage von ${ctx.senderName}**\n\n**${poll.question}**\n\n${optionLines}\n\nStimme ab mit \`/vote 1\`, \`/vote 2\` usw.\nEnde in 10 Minuten oder mit \`/endpoll\`.`,
      bot.name)

    // Auto-Ende nach 10 Min
    setTimeout(() => endPoll(ctx.conversationId, bot.name), 10 * 60 * 1000)
    return
  }

  if (cmd === 'vote') {
    const poll = activePolls.get(key)
    if (!poll) { await sendBotMessage(ctx.conversationId, `⚠️ Keine aktive Umfrage. Starte eine mit \`/poll\`.`, bot.name); return }

    const idx = parseInt(ctx.args[0]) - 1
    if (isNaN(idx) || idx < 0 || idx >= poll.options.length) {
      await sendBotMessage(ctx.conversationId, `⚠️ Ungültige Option. Wähle 1–${poll.options.length}.`, bot.name)
      return
    }

    // Alte Stimme entfernen
    for (const votes of Object.values(poll.votes)) {
      const pos = votes.indexOf(ctx.senderId)
      if (pos > -1) votes.splice(pos, 1)
    }

    if (!poll.votes[idx]) poll.votes[idx] = []
    poll.votes[idx].push(ctx.senderId)

    await sendBotMessage(ctx.conversationId,
      `✅ **${ctx.senderName}** hat für **${poll.options[idx]}** gestimmt!`, bot.name)
    return
  }

  if (cmd === 'endpoll') {
    await endPoll(ctx.conversationId, bot.name)
    return
  }

  if (cmd === 'results') {
    const poll = activePolls.get(key)
    if (!poll) { await sendBotMessage(ctx.conversationId, `⚠️ Keine aktive Umfrage.`, bot.name); return }
    await sendPollResults(ctx.conversationId, poll, bot.name, false)
  }
}

async function endPoll(conversationId: string, botName: string) {
  const key  = `${conversationId}:poll`
  const poll = activePolls.get(key)
  if (!poll) return
  activePolls.delete(key)
  await sendPollResults(conversationId, poll, botName, true)
}

async function sendPollResults(conversationId: string, poll: Poll, botName: string, ended: boolean) {
  const totalVotes = Object.values(poll.votes).reduce((s, v) => s + v.length, 0)
  const bars = poll.options.map((opt, i) => {
    const count = poll.votes[i]?.length || 0
    const pct   = totalVotes ? Math.round((count / totalVotes) * 100) : 0
    const bar   = '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10))
    return `${['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣'][i]} **${opt}**\n${bar} ${pct}% (${count} Stimmen)`
  })

  const winner = poll.options.reduce((best, opt, i) => {
    const cnt = poll.votes[i]?.length || 0
    return cnt > (poll.votes[best]?.length || 0) ? i : best
  }, 0)

  const header = ended ? `📊 **Umfrage beendet!**` : `📊 **Zwischenstand**`
  await sendBotMessage(conversationId,
    `${header}\n\n**${poll.question}**\n\n${bars.join('\n\n')}\n\n${ended ? `🏆 Gewinner: **${poll.options[winner]}**` : `Gesamt: ${totalVotes} Stimmen`}`,
    botName)
}

// ══════════════════════════════════════════════════════════════════════════════
// ⏰ REMINDER BOT
// ══════════════════════════════════════════════════════════════════════════════
async function handleReminderBot(bot: any, cmd: string, ctx: BotContext) {
  if (cmd === 'remind') {
    // /remind in 5 minuten Meeting
    // /remind in 2 stunden Zahnarzt
    const full = ctx.args.join(' ')
    const match = full.match(/^in\s+(\d+)\s+(sekunde[n]?|minute[n]?|stunde[n]?|tag[e]?|week|woche[n]?)\s+(.+)$/i)

    if (!match) {
      await sendBotMessage(ctx.conversationId,
        `⏰ **Reminder Bot** – Verwendung:\n\`/remind in 5 minuten Meeting beginnt\`\n\`/remind in 2 stunden Zahnarzt\`\n\`/remind in 1 tag Geburtstag von Anna\``,
        bot.name)
      return
    }

    const amount = parseInt(match[1])
    const unit   = match[2].toLowerCase()
    const text   = match[3]

    const msMap: Record<string, number> = {
      sekunde: 1000, sekunden: 1000,
      minute: 60000, minuten: 60000,
      stunde: 3600000, stunden: 3600000,
      tag: 86400000, tage: 86400000,
      woche: 604800000, wochen: 604800000,
    }
    const ms = (msMap[unit] || 60000) * amount

    if (ms > 7 * 24 * 60 * 60 * 1000) {
      await sendBotMessage(ctx.conversationId, `⚠️ Maximale Erinnerungszeit: 7 Tage.`, bot.name)
      return
    }

    const when = new Date(Date.now() + ms)
    const whenStr = when.toLocaleString('de-DE', { timeZone: 'Europe/Berlin', hour:'2-digit', minute:'2-digit', day:'2-digit', month:'2-digit' })

    await sendBotMessage(ctx.conversationId,
      `⏰ **Erinnerung gesetzt!**\n\n📌 ${text}\n🕐 ${whenStr} Uhr\n\n@${ctx.senderName} wird erinnert.`, bot.name)

    const timer = setTimeout(async () => {
      await sendBotMessage(ctx.conversationId,
        `🔔 **Erinnerung für @${ctx.senderName}!**\n\n📌 ${text}`, bot.name)
    }, ms)

    // Speichern für potenzielle Stornierung
    const key = `${ctx.conversationId}:${ctx.senderId}`
    if (!activeReminders.has(key)) activeReminders.set(key, [])
    activeReminders.get(key)!.push(timer)
    return
  }

  if (cmd === 'remindlist') {
    await sendBotMessage(ctx.conversationId,
      `⏰ Aktive Erinnerungen für @${ctx.senderName}: ${activeReminders.get(`${ctx.conversationId}:${ctx.senderId}`)?.length || 0} stück.`,
      bot.name)
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 📈 STATS BOT
// ══════════════════════════════════════════════════════════════════════════════
async function handleStatsBot(bot: any, cmd: string, ctx: BotContext) {
  // Zähle Nachrichten
  const countKey = `${ctx.conversationId}:${ctx.senderId}`
  const now = Date.now()
  const current = msgCounts.get(countKey) || { count: 0, resetAt: now + 3600000 }
  if (now > current.resetAt) { current.count = 0; current.resetAt = now + 3600000 }
  current.count++
  msgCounts.set(countKey, current)

  if (cmd !== 'stats' && cmd !== 'topusers' && cmd !== 'activity') return

  if (cmd === 'stats') {
    try {
      const total  = await (Message as any).countDocuments({ conversationId: ctx.conversationId })
      const today  = await (Message as any).countDocuments({
        conversationId: ctx.conversationId,
        sentAt: { $gte: new Date(new Date().setHours(0,0,0,0)) }
      })
      const members = await (Conversation as any)
        .findById(ctx.conversationId).select('participants').lean() as any
      const memberCount = members?.participants?.length || 0

      await sendBotMessage(ctx.conversationId,
        `📈 **Gruppen-Statistiken**\n\n💬 Nachrichten gesamt: **${total}**\n📅 Heute: **${today}**\n👥 Mitglieder: **${memberCount}**\n⏱ Zuletzt aktiv: **gerade eben**`,
        bot.name)
    } catch {
      await sendBotMessage(ctx.conversationId, `📈 Statistiken werden geladen...`, bot.name)
    }
    return
  }

  if (cmd === 'topusers') {
    try {
      const pipeline = [
        { $match: { conversationId: ctx.conversationId, type: { $ne: 'bot' } } },
        { $group: { _id: '$sender', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      ]
      const results = await (Message as any).aggregate(pipeline)
      const medals  = ['🥇','🥈','🥉','4️⃣','5️⃣']
      const lines   = results.map((r: any, i: number) =>
        `${medals[i]} **${r.user?.[0]?.username || 'Unbekannt'}** — ${r.count} Nachrichten`)

      await sendBotMessage(ctx.conversationId,
        `🏆 **Top Nutzer**\n\n${lines.join('\n') || 'Noch keine Daten.'}`, bot.name)
    } catch {
      await sendBotMessage(ctx.conversationId, `⚠️ Fehler beim Laden der Top-Nutzer.`, bot.name)
    }
    return
  }

  if (cmd === 'activity') {
    await sendBotMessage(ctx.conversationId,
      `📊 **Aktivitäts-Report**\n\nDie Gruppe ist aktuell **aktiv**. Nutze \`/stats\` für detaillierte Statistiken oder \`/topusers\` für die aktivsten Mitglieder.`,
      bot.name)
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 🎉 GIVEAWAY BOT
// ══════════════════════════════════════════════════════════════════════════════
async function handleGiveawayBot(bot: any, cmd: string, ctx: BotContext) {
  const key = `${ctx.conversationId}:giveaway`

  if (cmd === 'giveaway') {
    // /giveaway 10min Nitro für 1 Monat
    const full  = ctx.args.join(' ')
    const match = full.match(/^(\d+)(min|h|s)\s+(.+)$/i)

    if (!match) {
      await sendBotMessage(ctx.conversationId,
        `🎉 **Giveaway Bot** – Verwendung:\n\`/giveaway 10min Preis beschreibung\`\n\`/giveaway 1h Discord Nitro\``,
        bot.name)
      return
    }

    if (activeGiveaways.has(key)) {
      await sendBotMessage(ctx.conversationId,
        `⚠️ Es läuft bereits ein Giveaway! Beende es mit \`/endgiveaway\`.`, bot.name)
      return
    }

    const amount = parseInt(match[1])
    const unit   = match[2].toLowerCase()
    const prize  = match[3]
    const msMap  = { s: 1000, min: 60000, h: 3600000 }
    const ms     = (msMap[unit as keyof typeof msMap] || 60000) * amount

    const giveaway: Giveaway = {
      prize, participants: [], createdBy: ctx.senderId,
      endsAt: Date.now() + ms,
    }
    activeGiveaways.set(key, giveaway)

    const endsAt = new Date(Date.now() + ms).toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit' })
    await sendBotMessage(ctx.conversationId,
      `🎉 **GIVEAWAY!** 🎉\n\n🏆 Preis: **${prize}**\n⏰ Endet um: **${endsAt} Uhr**\n\nSchreibe \`/join\` um teilzunehmen!\nErstellt von @${ctx.senderName}`,
      bot.name)

    setTimeout(() => endGiveaway(ctx.conversationId, bot.name), ms)
    return
  }

  if (cmd === 'join') {
    const giveaway = activeGiveaways.get(key)
    if (!giveaway) { await sendBotMessage(ctx.conversationId, `⚠️ Kein aktives Giveaway. Starte eines mit \`/giveaway\`.`, bot.name); return }
    if (giveaway.participants.includes(ctx.senderId)) {
      await sendBotMessage(ctx.conversationId, `✅ @${ctx.senderName}, du nimmst bereits teil!`, bot.name)
      return
    }
    giveaway.participants.push(ctx.senderId)
    await sendBotMessage(ctx.conversationId,
      `✅ **@${ctx.senderName}** nimmt am Giveaway teil! (${giveaway.participants.length} Teilnehmer)`, bot.name)
    return
  }

  if (cmd === 'endgiveaway') {
    await endGiveaway(ctx.conversationId, bot.name)
    return
  }

  if (cmd === 'reroll') {
    await sendBotMessage(ctx.conversationId, `🎲 Re-rolling...`, bot.name)
    const prev = activeGiveaways.get(`${key}:prev`)
    if (!prev || !prev.participants.length) {
      await sendBotMessage(ctx.conversationId, `⚠️ Kein vorheriges Giveaway gefunden.`, bot.name)
      return
    }
    const winner = await getWinnerName(prev.participants)
    await sendBotMessage(ctx.conversationId,
      `🎉 Neuer Gewinner: **@${winner}**! Glückwunsch! 🏆`, bot.name)
  }
}

async function endGiveaway(conversationId: string, botName: string) {
  const key      = `${conversationId}:giveaway`
  const giveaway = activeGiveaways.get(key)
  if (!giveaway) return
  activeGiveaways.delete(key)
  activeGiveaways.set(`${key}:prev`, giveaway)

  if (!giveaway.participants.length) {
    await sendBotMessage(conversationId, `😢 Giveaway beendet – niemand hat teilgenommen!`, botName)
    return
  }

  const winner = await getWinnerName(giveaway.participants)
  await sendBotMessage(conversationId,
    `🎉 **Giveaway beendet!**\n\n🏆 Preis: **${giveaway.prize}**\n🎊 Gewinner: **@${winner}**\n\nGlückwunsch! Melde dich beim Veranstalter.\nNochmal würfeln? \`/reroll\``,
    botName)
}

async function getWinnerName(participantIds: string[]): Promise<string> {
  const winnerId = participantIds[Math.floor(Math.random() * participantIds.length)]
  try {
    const user = await User.findById(winnerId).select('username').lean() as any
    return user?.username || 'Unbekannt'
  } catch { return 'Unbekannt' }
}

// ══════════════════════════════════════════════════════════════════════════════
// 🛡️ MODERATION BOT
// ══════════════════════════════════════════════════════════════════════════════

const SPAM_KEYWORDS = ['kaufe hier', 'click here', 'gratis verdienen', 'free money', 'bit.ly', 'discord.gg/']
const MAX_SAME_MSG  = 3  // 3x gleiche Nachricht → Warnung
const lastMessages  = new Map<string, string[]>()  // userId → letzte 5 Nachrichten

async function handleModerationBot(bot: any, content: string, ctx: BotContext) {
  const prefix = bot.commandPrefix || '/'
  const isCmd  = content.startsWith(prefix)
  const parts  = content.slice(prefix.length).split(/\s+/)
  const cmd    = isCmd ? parts[0]?.toLowerCase() : ''

  // ── Commands ──────────────────────────────────────────────────────────────
  if (cmd === 'warn') {
    const target = parts[1]?.replace('@','')
    const reason = parts.slice(2).join(' ') || 'Regelverstoß'
    if (!target) {
      await sendBotMessage(ctx.conversationId, `🛡️ Verwendung: \`/warn @nutzer Grund\``, bot.name)
      return
    }
    const key     = `${ctx.conversationId}:${target}`
    const current = (warnCounts.get(key) || 0) + 1
    warnCounts.set(key, current)
    await sendBotMessage(ctx.conversationId,
      `⚠️ **@${target}** wurde verwarnt (${current}/3)\n📋 Grund: ${reason}\n${current >= 3 ? '\n🚨 **Maximum erreicht!** Admin-Eingriff empfohlen.' : ''}`,
      bot.name)
    return
  }

  if (cmd === 'warncount') {
    const target = parts[1]?.replace('@','') || ctx.senderName
    const count  = warnCounts.get(`${ctx.conversationId}:${target}`) || 0
    await sendBotMessage(ctx.conversationId,
      `📋 **@${target}** hat ${count}/3 Verwarnungen.`, bot.name)
    return
  }

  if (cmd === 'clearwarns') {
    const target = parts[1]?.replace('@','')
    if (target) {
      warnCounts.delete(`${ctx.conversationId}:${target}`)
      await sendBotMessage(ctx.conversationId, `✅ Verwarnungen von @${target} zurückgesetzt.`, bot.name)
    }
    return
  }

  if (cmd === 'slowmode') {
    const seconds = parseInt(parts[1]) || 30
    await (Conversation as any).findByIdAndUpdate(ctx.conversationId, {
      $set: { 'botSettings.slowmodeSeconds': seconds }
    })
    await sendBotMessage(ctx.conversationId,
      `🐌 **Slow Mode** aktiviert: ${seconds} Sekunden Cooldown pro Nutzer.`, bot.name)
    return
  }

  if (cmd === 'antispam') {
    await sendBotMessage(ctx.conversationId,
      `🛡️ **Anti-Spam** Status: Aktiv\n📋 Erkannte Spam-Muster: ${SPAM_KEYWORDS.length}\n⚠️ Max. gleiche Nachrichten: ${MAX_SAME_MSG}x`,
      bot.name)
    return
  }

  // ── Automatische Trigger (kein Command) ───────────────────────────────────
  if (!isCmd) {
    // 1. Spam-Keywords prüfen
    const lc = content.toLowerCase()
    for (const kw of SPAM_KEYWORDS) {
      if (lc.includes(kw)) {
        await sendBotMessage(ctx.conversationId,
          `🚨 **Spam erkannt!** Nachricht von @${ctx.senderName} enthält verbotene Inhalte.\n⚠️ Erste Verwarnung.`,
          bot.name)
        const key = `${ctx.conversationId}:${ctx.senderId}`
        warnCounts.set(key, (warnCounts.get(key) || 0) + 1)
        return
      }
    }

    // 2. Flood-Schutz (3x gleiche Nachricht)
    const key      = `${ctx.conversationId}:${ctx.senderId}`
    const msgs     = lastMessages.get(key) || []
    msgs.push(content)
    if (msgs.length > 5) msgs.shift()
    lastMessages.set(key, msgs)

    const sameCount = msgs.filter(m => m === content).length
    if (sameCount >= MAX_SAME_MSG) {
      await sendBotMessage(ctx.conversationId,
        `⚠️ @${ctx.senderName}: Bitte keine Wiederholungen! (${sameCount}x die gleiche Nachricht)`,
        bot.name)
    }

    // 3. Slowmode prüfen
    const conv = await (Conversation as any).findById(ctx.conversationId)
      .select('botSettings').lean() as any
    const slowSec = conv?.botSettings?.slowmodeSeconds
    if (slowSec) {
      const lastTime = slowmodeCooldown.get(key) || 0
      if (Date.now() - lastTime < slowSec * 1000) {
        await sendBotMessage(ctx.conversationId,
          `🐌 @${ctx.senderName}: Slow Mode aktiv – bitte warte noch ${Math.ceil((slowSec * 1000 - (Date.now() - lastTime)) / 1000)}s.`,
          bot.name)
        return
      }
      slowmodeCooldown.set(key, Date.now())
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 🎲 FUN BOT
// ══════════════════════════════════════════════════════════════════════════════
const JOKES = [
  'Warum können Geister so schlecht lügen? Weil man durch sie hindurchsehen kann! 👻',
  'Was ist braun und klebt an der Wand? Ein Affenwurf! 🐒',
  'Warum hat der Mathematiker Angst vor negativen Zahlen? Er schreckt vor nichts zurück! 🔢',
  'Ein Blonder findet eine Thermosflasche... er denkt: Was für eine Erfindung – hält heißes heiß und kaltes kalt. Aber wie weiß die, was ich trinken will? 🥤',
  'Was sagt ein Bauer wenn er sein Traktor sucht? Wo ist mein Traktor? 🚜',
  'Treffen sich zwei Jäger – beide tot. 🎯',
  'Was ist weiß und stört beim Frühstück? Eine Lawine. ❄️',
  'Zwei Fische im Wasser. Sagt der eine: "Blubb." Sagt der andere: "Stimmt." 🐟',
]

const EIGHTBALL = [
  'Auf jeden Fall! ✅', 'Definitiv ja! 🎯', 'Ganz sicher! 💯', 'Ja! 👍',
  'Wahrscheinlich schon. 🤔', 'Sieht gut aus. ✨', 'Nicht sicher. 😐',
  'Besser nicht fragen. 😅', 'Eher nein. 🤷', 'Auf keinen Fall! ❌',
  'Vergiss es. 🙅', 'Meine Quellen sagen nein. 📊',
]

async function handleFunBot(bot: any, cmd: string, ctx: BotContext) {
  if (cmd === 'dice') {
    const sides = parseInt(ctx.args[0]) || 6
    if (sides < 2 || sides > 100) {
      await sendBotMessage(ctx.conversationId, `🎲 Würfelseiten: 2–100. Standard: \`/dice 6\``, bot.name)
      return
    }
    const result = Math.floor(Math.random() * sides) + 1
    await sendBotMessage(ctx.conversationId,
      `🎲 **@${ctx.senderName}** würfelt einen W${sides}...\n\n✨ **${result}!** ${result === sides ? '🎉 Maximum!' : result === 1 ? '😬 Minimum!' : ''}`,
      bot.name)
    return
  }

  if (cmd === 'flip') {
    const result = Math.random() < 0.5 ? '🦅 Kopf' : '🔟 Zahl'
    await sendBotMessage(ctx.conversationId,
      `🪙 **@${ctx.senderName}** wirft eine Münze...\n\n**${result}!**`, bot.name)
    return
  }

  if (cmd === 'joke') {
    const joke = JOKES[Math.floor(Math.random() * JOKES.length)]
    await sendBotMessage(ctx.conversationId, `😄 ${joke}`, bot.name)
    return
  }

  if (cmd === '8ball') {
    const question = ctx.args.join(' ')
    if (!question) {
      await sendBotMessage(ctx.conversationId, `🎱 Stelle eine Frage: \`/8ball Wird es heute regnen?\``, bot.name)
      return
    }
    const answer = EIGHTBALL[Math.floor(Math.random() * EIGHTBALL.length)]
    await sendBotMessage(ctx.conversationId,
      `🎱 **Frage:** ${question}\n\n**Antwort:** ${answer}`, bot.name)
    return
  }

  if (cmd === 'rps') {
    const choices = ['🪨 Stein', '📄 Papier', '✂️ Schere']
    const bot_    = choices[Math.floor(Math.random() * 3)]
    const user    = ctx.args[0]
    if (!user) {
      await sendBotMessage(ctx.conversationId,
        `✊ Verwendung: \`/rps stein\` oder \`/rps papier\` oder \`/rps schere\``, bot.name)
      return
    }
    const wins: Record<string, string> = { stein: 'schere', papier: 'stein', schere: 'papier' }
    const botChoice = bot_.toLowerCase().replace(/[🪨📄✂️\s]/g,'').normalize()
    const result = wins[user.toLowerCase()] === botChoice ? '🎉 Du gewinnst!'
      : user.toLowerCase() === botChoice ? '🤝 Unentschieden!'
      : '🤖 Bot gewinnt!'
    await sendBotMessage(ctx.conversationId,
      `✊ **Rock Paper Scissors!**\n\n👤 @${ctx.senderName}: ${user}\n🤖 Bot: ${bot_}\n\n${result}`, bot.name)
    return
  }

  if (cmd === 'choose') {
    const options = ctx.args.join(' ').split('|').map(o => o.trim()).filter(Boolean)
    if (options.length < 2) {
      await sendBotMessage(ctx.conversationId,
        `🤔 Verwendung: \`/choose Pizza | Burger | Salat\``, bot.name)
      return
    }
    const pick = options[Math.floor(Math.random() * options.length)]
    await sendBotMessage(ctx.conversationId,
      `🤔 **@${ctx.senderName}** kann sich nicht entscheiden...\n\n✨ Der Bot wählt: **${pick}!**`, bot.name)
    return
  }

  // Hilfe anzeigen wenn kein Command
  if (cmd === 'fun' || cmd === 'help') {
    await sendBotMessage(ctx.conversationId,
      `🎲 **Fun Bot Befehle:**\n\`/dice [6]\` – Würfeln\n\`/flip\` – Münze werfen\n\`/joke\` – Witz\n\`/8ball Frage?\` – Magic 8-Ball\n\`/rps stein|papier|schere\` – Schere-Stein-Papier\n\`/choose A | B | C\` – Zufällig wählen`,
      bot.name)
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 📰 NEWS BOT
// ══════════════════════════════════════════════════════════════════════════════
const newsTopics = new Map<string, string[]>()  // conversationId → topics

const MOCK_HEADLINES: Record<string, string[]> = {
  tech: [
    '🤖 KI-Modell übertrifft menschliche Experten in Medizin-Diagnosen',
    '📱 Apple kündigt neues AR-Headset für 2027 an',
    '🔒 Kritische Sicherheitslücke in populärer Open-Source-Bibliothek entdeckt',
    '💻 GitHub Copilot schreibt jetzt 50% des Codes bei großen Firmen',
  ],
  sport: [
    '⚽ Champions League: Spannendes Finale erwartet',
    '🏀 NBA: Neuer Rekord in der Punktewertung aufgestellt',
    '🎾 Wimbledon: Überraschender Außenseiter im Finale',
    '🏎️ F1: Neuer Streckenrekord in Monaco',
  ],
  wetter: [
    '☀️ Hochsommer in Deutschland: 35°C erwartet',
    '🌧️ Starkregen-Warnung für Norddeutschland',
    '❄️ Schneechaos in den Alpen: Straßen gesperrt',
    '🌤️ Schönes Wochenendwetter in ganz Deutschland',
  ],
  gaming: [
    '🎮 GTA VI Release-Termin offiziell bestätigt',
    '🕹️ Steam bricht neuen Nutzungs-Rekord',
    '🎯 Valorant: Neue Season mit überarbeitetem Rangsystem',
    '🌍 Open-World-Spiel des Jahres: Die Kandidaten stehen fest',
  ],
}

async function handleNewsBot(bot: any, cmd: string, ctx: BotContext) {
  if (cmd === 'news') {
    const topic = ctx.args[0]?.toLowerCase() || 'tech'
    const headlines = MOCK_HEADLINES[topic] || MOCK_HEADLINES['tech']
    const pick = headlines[Math.floor(Math.random() * headlines.length)]
    await sendBotMessage(ctx.conversationId,
      `📰 **Aktuelle News** (${topic.toUpperCase()})\n\n${pick}\n\n_Mehr mit \`/news tech\` | \`/news sport\` | \`/news wetter\` | \`/news gaming\`_`,
      bot.name)
    return
  }

  if (cmd === 'setnews') {
    const topics = ctx.args.filter(t => Object.keys(MOCK_HEADLINES).includes(t.toLowerCase()))
    if (!topics.length) {
      await sendBotMessage(ctx.conversationId,
        `📰 **News Bot** – Themen einstellen:\n\`/setnews tech sport wetter gaming\`\n\nVerfügbar: tech, sport, wetter, gaming`, bot.name)
      return
    }
    newsTopics.set(ctx.conversationId, topics)
    await sendBotMessage(ctx.conversationId,
      `✅ News-Themen gesetzt: **${topics.join(', ')}**\nIhr bekommt täglich Headlines zu diesen Themen.`, bot.name)
    return
  }

  if (cmd === 'newshelp' || cmd === 'help') {
    await sendBotMessage(ctx.conversationId,
      `📰 **News Bot Befehle:**\n\`/news [thema]\` – Aktuelle Headline\n\`/setnews tech sport\` – Themen wählen\n\nThemen: tech, sport, wetter, gaming`, bot.name)
  }
}

// ── Tägliche News automatisch senden ─────────────────────────────────────────
export async function sendDailyNews() {
  for (const [convId, topics] of newsTopics.entries()) {
    for (const topic of topics) {
      const headlines = MOCK_HEADLINES[topic] || []
      if (!headlines.length) continue
      const pick = headlines[Math.floor(Math.random() * headlines.length)]
      await sendBotMessage(convId, `📰 **Tägliche News** (${topic.toUpperCase()})\n\n${pick}`, 'Nokki News Bot')
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ☀️ WEATHER BOT
// ══════════════════════════════════════════════════════════════════════════════
const cityDefaults = new Map<string, string>() // conversationId → city

const WEATHER_MOCK: Record<string, { temp: number; condition: string; icon: string; humidity: number; wind: number }> = {
  berlin:   { temp: 18, condition: 'Bewölkt',       icon: '⛅', humidity: 72, wind: 14 },
  hamburg:  { temp: 15, condition: 'Regnerisch',    icon: '🌧️', humidity: 85, wind: 22 },
  münchen:  { temp: 22, condition: 'Sonnig',        icon: '☀️', humidity: 55, wind: 8  },
  köln:     { temp: 17, condition: 'Teilbewölkt',   icon: '🌤️', humidity: 68, wind: 11 },
  frankfurt:{ temp: 20, condition: 'Heiter',        icon: '🌤️', humidity: 60, wind: 9  },
  rostock:  { temp: 14, condition: 'Windig',        icon: '💨', humidity: 80, wind: 28 },
  default:  { temp: 19, condition: 'Wechselhaft',   icon: '🌥️', humidity: 70, wind: 15 },
}

function getWeather(city: string) {
  const key = city.toLowerCase().replace(/[äöü]/g, c => ({'ä':'ae','ö':'oe','ü':'ue'}[c]||c))
  const w = WEATHER_MOCK[key] || WEATHER_MOCK['default']
  // leichte Variation damit es nicht immer gleich aussieht
  const variation = Math.floor(Math.random() * 5) - 2
  return { ...w, temp: w.temp + variation, city }
}

async function handleWeatherBot(bot: any, cmd: string, ctx: BotContext) {
  if (cmd === 'wetter' || cmd === 'weather') {
    const args = ctx.args
    let city = args[0] || cityDefaults.get(ctx.conversationId) || ''
    const modifier = args[1]?.toLowerCase()

    if (!city) {
      await sendBotMessage(ctx.conversationId,
        `☀️ **Weather Bot** – Verwendung:\n\`/wetter Berlin\` – Aktuelles Wetter\n\`/wetter Berlin morgen\` – Vorhersage\n\`/wetter Berlin 3tage\` – 3-Tages-Übersicht\n\`/setcity Berlin\` – Standardstadt setzen`,
        bot.name)
      return
    }

    const w = getWeather(city)

    if (!modifier || modifier === 'jetzt' || modifier === 'aktuell') {
      await sendBotMessage(ctx.conversationId,
        `${w.icon} **Wetter in ${city}**\n\n🌡️ Temperatur: **${w.temp}°C**\n☁️ Bedingung: ${w.condition}\n💧 Luftfeuchtigkeit: ${w.humidity}%\n💨 Wind: ${w.wind} km/h\n\n_Stand: gerade eben_`,
        bot.name)
      return
    }

    if (modifier === 'morgen') {
      const tm = getWeather(city)
      await sendBotMessage(ctx.conversationId,
        `${tm.icon} **Wetter morgen in ${city}**\n\n🌡️ Temperatur: **${tm.temp + 1}°C**\n☁️ Bedingung: ${tm.condition}\n💧 Luftfeuchtigkeit: ${tm.humidity}%\n💨 Wind: ${tm.wind} km/h`,
        bot.name)
      return
    }

    if (modifier === '3tage' || modifier === '3') {
      const days = ['Heute', 'Morgen', 'Übermorgen']
      const forecast = days.map(d => {
        const fw = getWeather(city)
        return `**${d}:** ${fw.icon} ${fw.temp}°C, ${fw.condition}`
      }).join('\n')
      await sendBotMessage(ctx.conversationId,
        `📅 **3-Tages-Vorhersage für ${city}**\n\n${forecast}`,
        bot.name)
      return
    }
    return
  }

  if (cmd === 'setcity') {
    const city = ctx.args.join(' ')
    if (!city) { await sendBotMessage(ctx.conversationId, `☀️ Verwendung: \`/setcity Berlin\``, bot.name); return }
    cityDefaults.set(ctx.conversationId, city)
    await sendBotMessage(ctx.conversationId,
      `✅ Standardstadt auf **${city}** gesetzt. Nutze \`/wetter\` ohne Stadtname.`, bot.name)
    return
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 🎵 MUSIC BOT
// ══════════════════════════════════════════════════════════════════════════════
const playlists = new Map<string, Array<{ url: string; title: string; addedBy: string; addedAt: number }>>()
const YT_REGEX  = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/

async function handleMusicBot(bot: any, cmd: string, ctx: BotContext) {
  const list = playlists.get(ctx.conversationId) || []

  if (cmd === 'add') {
    const url = ctx.args[0]
    if (!url || !YT_REGEX.test(url)) {
      await sendBotMessage(ctx.conversationId,
        `🎵 **Music Bot** – Verwendung:\n\`/add https://youtube.com/watch?v=...\`\n\nOder teile einfach einen YouTube-Link im Chat — er wird automatisch erkannt!`,
        bot.name)
      return
    }
    const match = url.match(YT_REGEX)
    const videoId = match?.[1] || ''
    const entry = { url, title: `Song #${list.length + 1} (youtu.be/${videoId})`, addedBy: ctx.senderName, addedAt: Date.now() }
    list.push(entry)
    playlists.set(ctx.conversationId, list)
    await sendBotMessage(ctx.conversationId,
      `🎵 **${entry.title}** zur Playlist hinzugefügt!\n📋 Playlist: ${list.length} Songs | von @${ctx.senderName}`,
      bot.name)
    return
  }

  if (cmd === 'playlist') {
    if (!list.length) {
      await sendBotMessage(ctx.conversationId, `🎵 Die Playlist ist noch leer. Füge Songs mit \`/add URL\` hinzu.`, bot.name)
      return
    }
    const lines = list.slice(-10).map((e, i) => `${i + 1}. ${e.title} — von @${e.addedBy}`)
    await sendBotMessage(ctx.conversationId,
      `🎵 **Gruppen-Playlist** (${list.length} Songs)\n\n${lines.join('\n')}${list.length > 10 ? `\n\n_...und ${list.length - 10} weitere_` : ''}`,
      bot.name)
    return
  }

  if (cmd === 'np' || cmd === 'nowplaying') {
    const last = list[list.length - 1]
    if (!last) { await sendBotMessage(ctx.conversationId, `🎵 Noch nichts in der Playlist.`, bot.name); return }
    await sendBotMessage(ctx.conversationId,
      `🎵 **Zuletzt hinzugefügt:**\n${last.title}\nvon @${last.addedBy}\n🔗 ${last.url}`, bot.name)
    return
  }

  if (cmd === 'top') {
    const counts: Record<string, number> = {}
    list.forEach(e => { counts[e.addedBy] = (counts[e.addedBy] || 0) + 1 })
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5)
    const medals = ['🥇','🥈','🥉','4️⃣','5️⃣']
    const lines  = sorted.map(([name, cnt], i) => `${medals[i]} @${name} — ${cnt} Songs`)
    await sendBotMessage(ctx.conversationId,
      `🎵 **Meiste Songs hinzugefügt:**\n\n${lines.join('\n')}`, bot.name)
    return
  }

  if (cmd === 'clear') {
    playlists.set(ctx.conversationId, [])
    await sendBotMessage(ctx.conversationId, `🗑️ Playlist geleert.`, bot.name)
    return
  }

  // Auto-Trigger: YouTube-Link im normalen Chat-Text
  if (!cmd) {
    if (YT_REGEX.test(ctx.rawContent)) {
      const match = ctx.rawContent.match(YT_REGEX)
      const videoId = match?.[1] || ''
      const url = `https://youtu.be/${videoId}`
      const entry = { url, title: `Song (youtu.be/${videoId})`, addedBy: ctx.senderName, addedAt: Date.now() }
      list.push(entry)
      playlists.set(ctx.conversationId, list)
      await sendBotMessage(ctx.conversationId,
        `🎵 YouTube-Link erkannt und zur Playlist hinzugefügt! (${list.length} Songs gesamt)`, bot.name)
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 📝 QUOTE BOT
// ══════════════════════════════════════════════════════════════════════════════
const quoteLists = new Map<string, Array<{ text: string; author: string; savedBy: string; savedAt: number }>>()

async function handleQuoteBot(bot: any, cmd: string, ctx: BotContext) {
  const quotes = quoteLists.get(ctx.conversationId) || []

  if (cmd === 'quote') {
    // /quote @user Das war der beste Abend
    const text = ctx.args.join(' ')
    if (!text) {
      await sendBotMessage(ctx.conversationId,
        `📝 **Quote Bot** – Verwendung:\n\`/quote @user Das war unvergesslich!\`\n\`/quote Einfach ein allgemeines Zitat\`\n\nOder reagiere mit 💬 auf eine Nachricht.`,
        bot.name)
      return
    }
    const authorMatch = text.match(/^@(\S+)\s+(.+)$/)
    const author = authorMatch ? authorMatch[1] : ctx.senderName
    const content = authorMatch ? authorMatch[2] : text

    quotes.push({ text: content, author, savedBy: ctx.senderName, savedAt: Date.now() })
    quoteLists.set(ctx.conversationId, quotes)
    await sendBotMessage(ctx.conversationId,
      `📝 Zitat #${quotes.length} gespeichert!\n\n_"${content}"_\n— **@${author}**`,
      bot.name)
    return
  }

  if (cmd === 'quotes') {
    if (!quotes.length) {
      await sendBotMessage(ctx.conversationId,
        `📝 Noch keine Zitate gespeichert. Füge welche mit \`/quote @user Text\` hinzu.`, bot.name)
      return
    }

    const filterUser = ctx.args[0]?.replace('@', '')
    const filtered = filterUser
      ? quotes.filter(q => q.author.toLowerCase() === filterUser.toLowerCase())
      : quotes

    if (!filtered.length) {
      await sendBotMessage(ctx.conversationId, `📝 Keine Zitate von @${filterUser} gefunden.`, bot.name)
      return
    }

    const pick = filtered[Math.floor(Math.random() * filtered.length)]
    await sendBotMessage(ctx.conversationId,
      `📝 **Zufälliges Zitat** ${filterUser ? `von @${filterUser}` : ''}\n\n_"${pick.text}"_\n— **@${pick.author}**\n\n_gespeichert von @${pick.savedBy}_`,
      bot.name)
    return
  }

  if (cmd === 'quotelist') {
    if (!quotes.length) {
      await sendBotMessage(ctx.conversationId, `📝 Keine Zitate vorhanden.`, bot.name); return
    }
    const lines = quotes.slice(-10).map((q, i) => `${i + 1}. _"${q.text.slice(0, 50)}${q.text.length > 50 ? '…' : ''}"_ — @${q.author}`)
    await sendBotMessage(ctx.conversationId,
      `📝 **Alle Zitate** (${quotes.length} gesamt)\n\n${lines.join('\n')}`, bot.name)
    return
  }

  if (cmd === 'deletequote') {
    const idx = parseInt(ctx.args[0]) - 1
    if (isNaN(idx) || idx < 0 || idx >= quotes.length) {
      await sendBotMessage(ctx.conversationId, `📝 Ungültige Nummer. Nutze \`/quotelist\` um die Nummern zu sehen.`, bot.name)
      return
    }
    const removed = quotes.splice(idx, 1)[0]
    quoteLists.set(ctx.conversationId, quotes)
    await sendBotMessage(ctx.conversationId,
      `🗑️ Zitat entfernt: _"${removed.text.slice(0, 60)}"_`, bot.name)
    return
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 🌍 TRANSLATE BOT
// ══════════════════════════════════════════════════════════════════════════════
const LANG_NAMES: Record<string, string> = {
  de:'Deutsch', en:'Englisch', es:'Spanisch', fr:'Französisch', it:'Italienisch',
  pt:'Portugiesisch', nl:'Niederländisch', pl:'Polnisch', ru:'Russisch',
  tr:'Türkisch', ar:'Arabisch', zh:'Chinesisch', ja:'Japanisch', ko:'Koreanisch',
}

// Einfache Mock-Übersetzungen für häufige Phrasen
const SIMPLE_TRANSLATIONS: Record<string, Record<string, string>> = {
  'hallo': { en:'Hello', es:'Hola', fr:'Bonjour', it:'Ciao', tr:'Merhaba' },
  'guten morgen': { en:'Good morning', es:'Buenos días', fr:'Bonjour', it:'Buongiorno' },
  'wie geht es dir': { en:'How are you?', es:'¿Cómo estás?', fr:'Comment ça va?', it:'Come stai?' },
  'danke': { en:'Thank you', es:'Gracias', fr:'Merci', it:'Grazie', tr:'Teşekkürler' },
  'auf wiedersehen': { en:'Goodbye', es:'Adiós', fr:'Au revoir', it:'Arrivederci' },
  'gute nacht': { en:'Good night', es:'Buenas noches', fr:'Bonne nuit', it:'Buona notte' },
  'ich liebe dich': { en:'I love you', es:'Te amo', fr:'Je t\'aime', it:'Ti amo', tr:'Seni seviyorum' },
  'hello': { de:'Hallo', es:'Hola', fr:'Bonjour', it:'Ciao', tr:'Merhaba' },
  'good morning': { de:'Guten Morgen', es:'Buenos días', fr:'Bonjour', it:'Buongiorno' },
  'thank you': { de:'Danke', es:'Gracias', fr:'Merci', it:'Grazie', tr:'Teşekkürler' },
  'i love you': { de:'Ich liebe dich', es:'Te amo', fr:'Je t\'aime', it:'Ti amo' },
}

function mockTranslate(text: string, targetLang: string): string {
  const lower = text.toLowerCase().trim()
  const map   = SIMPLE_TRANSLATIONS[lower]
  if (map && map[targetLang]) return map[targetLang]
  // Fallback: zeige an dass echte API nötig wäre
  return `[${LANG_NAMES[targetLang] || targetLang}] ${text} _(Demo-Modus — echte Übersetzung via DeepL/LibreTranslate API konfigurierbar)_`
}

async function handleTranslateBot(bot: any, cmd: string, ctx: BotContext) {
  if (cmd === 'translate' || cmd === 'tr') {
    const lang = ctx.args[0]?.toLowerCase()
    const text = ctx.args.slice(1).join(' ')

    if (!lang || !text) {
      await sendBotMessage(ctx.conversationId,
        `🌍 **Translate Bot** – Verwendung:\n\`/translate de Guten Morgen\`\n\`/translate en How are you\`\n\`/translate es Danke\`\n\n\`/languages\` – Alle Sprachen anzeigen`,
        bot.name)
      return
    }

    if (!LANG_NAMES[lang]) {
      await sendBotMessage(ctx.conversationId,
        `🌍 Unbekannte Sprache: **${lang}**\nNutze \`/languages\` für eine Übersicht.`, bot.name)
      return
    }

    const translated = mockTranslate(text, lang)
    await sendBotMessage(ctx.conversationId,
      `🌍 **Übersetzung** → ${LANG_NAMES[lang]}\n\n📥 Original: _${text}_\n📤 Übersetzt: **${translated}**`,
      bot.name)
    return
  }

  if (cmd === 'languages') {
    const list = Object.entries(LANG_NAMES).map(([code, name]) => `\`${code}\` ${name}`).join(' · ')
    await sendBotMessage(ctx.conversationId,
      `🌍 **Verfügbare Sprachen:**\n\n${list}\n\nVerwendung: \`/translate en Guten Morgen\``, bot.name)
    return
  }

  if (cmd === 'setlang') {
    const lang = ctx.args[0]?.toLowerCase()
    if (!lang || !LANG_NAMES[lang]) {
      await sendBotMessage(ctx.conversationId, `🌍 Verwendung: \`/setlang de\` oder \`/setlang en\``, bot.name); return
    }
    await sendBotMessage(ctx.conversationId,
      `✅ Standardsprache auf **${LANG_NAMES[lang]}** (\`${lang}\`) gesetzt.`, bot.name)
    return
  }
}
