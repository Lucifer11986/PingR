"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoginHistory = void 0;
const mongoose_1 = require("mongoose");
const LoginHistorySchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    ipAddress: { type: String },
    device: { type: String },
    os: { type: String },
    browser: { type: String },
    // TTL: automatische Löschung nach 90 Tagen (DSGVO-konform)
    timestamp: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 90 },
    success: { type: Boolean, default: true },
}, { timestamps: false });
LoginHistorySchema.index({ userId: 1, timestamp: -1 });
exports.LoginHistory = (0, mongoose_1.model)('LoginHistory', LoginHistorySchema);
exports.default = exports.LoginHistory;
