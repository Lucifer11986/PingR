"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Identity = void 0;
const mongoose_1 = require("mongoose");
const IdentitySchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['private', 'work', 'anonymous'], required: true },
    uin: { type: String, required: true, unique: true },
    username: { type: String, required: true, trim: true, maxlength: 30 },
    avatar: { type: String },
    bio: { type: String, maxlength: 200, default: '' },
    status: { type: String, enum: ['online', 'away', 'offline'], default: 'offline' },
    statusMessage: { type: String, maxlength: 100 },
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: false },
    settings: {
        notifications: { type: Boolean, default: true },
        quietHoursFrom: { type: String },
        quietHoursTo: { type: String },
        autoReply: { type: String, maxlength: 200 },
        newChatLimit: { type: Number, default: 20 },
    },
}, { timestamps: true });
const Identity = (0, mongoose_1.model)('Identity', IdentitySchema);
exports.Identity = Identity;
exports.default = Identity;
