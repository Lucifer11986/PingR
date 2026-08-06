"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.startScheduledMessageJob = startScheduledMessageJob;
exports.startGroupCleanupJob = startGroupCleanupJob;
/**
 * Job der alle 30 Sekunden prüft ob geplante Nachrichten gesendet werden sollen
 */
const ScheduledMessage_1 = require("../models/ScheduledMessage");
const Message_1 = require("../models/Message");
const Conversation_1 = require("../models/Conversation");
const socketServer_1 = require("../socket/socketServer");
function startScheduledMessageJob() {
    setInterval(async () => {
        try {
            const due = await ScheduledMessage_1.ScheduledMessage.find({
                sent: false,
                scheduledFor: { $lte: new Date() },
            }).limit(20);
            for (const scheduled of due) {
                // Nachricht erstellen
                const message = await Message_1.Message.create({
                    conversationId: scheduled.conversationId,
                    sender: scheduled.sender,
                    content: scheduled.content,
                    type: scheduled.type || 'text',
                    readBy: [scheduled.sender],
                });
                const populated = await message.populate([
                    { path: 'sender', select: '-password' },
                ]);
                await Conversation_1.Conversation.findByIdAndUpdate(scheduled.conversationId, { lastMessage: message._id, updatedAt: new Date() });
                (0, socketServer_1.getIO)().to(`conv:${scheduled.conversationId}`).emit('new_message', populated);
                // Als gesendet markieren
                scheduled.sent = true;
                await scheduled.save();
                console.log(`✅ Geplante Nachricht gesendet: ${scheduled._id}`);
            }
        }
        catch (err) {
            console.error('Scheduled message job error:', err);
        }
    }, 30 * 1000); // alle 30 Sekunden
    console.log('✅ Geplante-Nachrichten-Job gestartet');
}
/**
 * Job der stündlich leere Gruppen löscht
 */
function startGroupCleanupJob() {
    const run = async () => {
        try {
            const { Conversation } = await Promise.resolve().then(() => __importStar(require('../models/Conversation')));
            // Gruppen mit 0 Mitgliedern löschen
            const deleted = await Conversation.deleteMany({
                isGroup: true,
                $or: [
                    { participants: { $size: 0 } },
                    { participants: { $exists: true, $eq: [] } },
                ]
            });
            if (deleted.deletedCount > 0) {
                console.log(`[Cleanup] ${deleted.deletedCount} leere Gruppe(n) gelöscht`);
            }
        }
        catch (err) {
            console.error('[GroupCleanup] Fehler:', err);
        }
    };
    run(); // Einmal beim Start
    setInterval(run, 60 * 60 * 1000); // Stündlich
}
