"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LegacyClaim = void 0;
const mongoose_1 = require("mongoose");
const LegacyClaimSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    requestedUin: { type: String, required: true, index: true },
    proofType: { type: String, enum: ['email', 'screenshot', 'firstcome'], required: true },
    proofEmail: { type: String },
    proofScreenshot: { type: String },
    emailToken: { type: String, index: true },
    emailTokenExp: { type: Date },
    status: { type: String, enum: ['pending', 'email_sent', 'approved', 'rejected', 'expired'], default: 'pending' },
    adminNote: { type: String },
    reviewedBy: { type: String },
    reviewedAt: { type: Date },
}, { timestamps: true });
// Index damit pro UIN nur ein aktiver Claim existiert
LegacyClaimSchema.index({ requestedUin: 1, status: 1 });
LegacyClaimSchema.index({ userId: 1 });
exports.LegacyClaim = (0, mongoose_1.model)('LegacyClaim', LegacyClaimSchema);
exports.default = exports.LegacyClaim;
