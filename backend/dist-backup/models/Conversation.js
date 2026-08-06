"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Conversation = void 0;
const mongoose_1 = require("mongoose");
const ConversationSchema = new mongoose_1.Schema({
    participants: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'User' }],
    identityParticipants: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'Identity' }],
    isGroup: { type: Boolean, default: false },
    groupName: { type: String },
    groupAvatar: { type: String },
    isPublic: { type: Boolean, default: false },
    joinCode: { type: String, unique: true, sparse: true },
    admins: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'User' }],
    description: { type: String, default: '' },
    adminOnly: { type: Boolean, default: false },
    slowMode: { type: Number, default: 0 },
    maxMembers: { type: Number, default: 100 },
    requireApproval: { type: Boolean, default: false },
    muteList: [{ userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' }, mutedUntil: Date }],
    lastMessage: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Message' },
    unreadCounts: { type: Map, of: Number, default: {} },
}, { timestamps: true });
const Conversation = (0, mongoose_1.model)('Conversation', ConversationSchema);
exports.Conversation = Conversation;
exports.default = Conversation;
