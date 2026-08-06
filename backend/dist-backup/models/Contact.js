"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Contact = void 0;
const mongoose_1 = require("mongoose");
const ContactSchema = new mongoose_1.Schema({
    owner: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    user: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    identityId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Identity' },
    nickname: { type: String, maxlength: 30 },
    addedAt: { type: Date, default: Date.now },
}, { timestamps: false });
ContactSchema.index({ owner: 1, user: 1, identityId: 1 }, { unique: true, sparse: true });
ContactSchema.index({ owner: 1, identityId: 1 });
const Contact = (0, mongoose_1.model)('Contact', ContactSchema);
exports.Contact = Contact;
exports.default = Contact;
