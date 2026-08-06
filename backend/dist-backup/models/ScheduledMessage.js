"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScheduledMessage = void 0;
const mongoose_1 = require("mongoose");
const ScheduledMessageSchema = new mongoose_1.Schema({
    sender: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    conversationId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    content: { type: String, required: true },
    type: { type: String, default: 'text' },
    scheduledFor: { type: Date, required: true },
    sent: { type: Boolean, default: false },
}, { timestamps: true });
const ScheduledMessage = (0, mongoose_1.model)('ScheduledMessage', ScheduledMessageSchema);
exports.ScheduledMessage = ScheduledMessage;
exports.default = ScheduledMessage;
