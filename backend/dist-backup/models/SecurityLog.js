"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityLog = void 0;
const mongoose_1 = require("mongoose");
const SecurityLogSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    userUIN: { type: String, required: true },
    userEmail: { type: String, required: true },
    username: { type: String, required: true },
    ipAddress: { type: String },
    userAgent: { type: String },
    deviceType: { type: String },
    deviceOS: { type: String },
    deviceBrowser: { type: String },
    deviceSummary: { type: String },
    eventType: { type: String, enum: ['csam', 'extremism', 'terrorism', 'flagged_review', 'auto_blocked'], required: true },
    legalBasis: { type: String, required: true },
    attemptedContent: { type: String, required: true },
    contentHash: { type: String, required: true },
    conversationId: { type: String },
    messageId: { type: String },
    timestamp: { type: Date, default: Date.now, required: true },
    autoDetected: { type: Boolean, default: true },
    reportedToBka: { type: Boolean, default: false },
    reportedAt: { type: Date },
    reportReference: { type: String },
    notes: { type: String },
    reportPackage: { type: String },
}, { timestamps: true });
SecurityLogSchema.index({ userId: 1, timestamp: -1 });
SecurityLogSchema.index({ eventType: 1, reportedToBka: 1 });
const SecurityLog = (0, mongoose_1.model)('SecurityLog', SecurityLogSchema);
exports.SecurityLog = SecurityLog;
exports.default = SecurityLog;
