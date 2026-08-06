"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deliverTimeCapsules = deliverTimeCapsules;
exports.startTimeCapsuleJob = startTimeCapsuleJob;
// ⏳ Zeitkapsel-Job — läuft jede Minute und stellt fällige Nachrichten zu
const Message_1 = require("../models/Message");
const Conversation_1 = require("../models/Conversation");
const socketServer_1 = require("../socket/socketServer");
async function deliverTimeCapsules() {
    try {
        const now = new Date();
        // Alle Zeitkapsel-Nachrichten finden die fällig und noch nicht zugestellt sind
        const pending = await Message_1.Message.find({
            deliverAt: { $lte: now },
            delivered: false,
            deleted: false,
        }).populate('sender', '-password').populate('replyTo');
        if (pending.length === 0)
            return;
        console.log(`[TimeCapsule] ${pending.length} Nachricht(en) werden jetzt zugestellt`);
        for (const message of pending) {
            // Als zugestellt markieren
            message.delivered = true;
            await message.save();
            // Conversation updaten
            await Conversation_1.Conversation.findByIdAndUpdate(message.conversationId, { lastMessage: message._id, updatedAt: new Date() });
            // Per WebSocket in Echtzeit senden
            (0, socketServer_1.getIO)()
                .to(`conv:${message.conversationId}`)
                .emit('new_message', message);
            // Optional: Browser-Push Benachrichtigung auslösen
            (0, socketServer_1.getIO)()
                .to(`conv:${message.conversationId}`)
                .emit('time_capsule_delivered', {
                messageId: message._id,
                conversationId: message.conversationId,
                senderName: message.sender.username,
            });
        }
    }
    catch (err) {
        console.error('[TimeCapsule] Fehler:', err);
    }
}
// Cron-Job starten (jede Minute)
function startTimeCapsuleJob() {
    console.log('[TimeCapsule] Job gestartet — prüft jede Minute');
    setInterval(deliverTimeCapsules, 60 * 1000);
    // Auch direkt beim Start einmal prüfen
    deliverTimeCapsules();
}
