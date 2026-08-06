"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Message = void 0;
const mongoose_1 = require("mongoose");
const MessageSchema = new mongoose_1.Schema({
    conversationId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    sender: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, default: '' },
    type: { type: String, enum: ['text', 'image', 'file', 'voice'], default: 'text' },
    fileUrl: { type: String },
    fileName: { type: String },
    duration: { type: Number },
    expiresAt: { type: Date, index: { expireAfterSeconds: 0 } },
    deliverAt: { type: Date, index: true }, // Index für effizienten Cron-Job
    delivered: { type: Boolean, default: true }, // false = Zeitkapsel noch ausstehend
    edited: { type: Boolean, default: false },
    editedAt: { type: Date },
    deleted: { type: Boolean, default: false },
    flagged: { type: Boolean, default: false },
    replyTo: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Message' },
    readBy: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'User' }],
    seenSilently: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'User' }],
    reactions: [{
            emoji: { type: String, required: true },
            userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
            username: { type: String },
        }],
}, { timestamps: true });
MessageSchema.index({ conversationId: 1, createdAt: 1 });
const Message = (0, mongoose_1.model)('Message', MessageSchema);
exports.Message = Message;
exports.default = Message;
