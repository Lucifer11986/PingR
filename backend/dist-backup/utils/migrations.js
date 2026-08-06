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
exports.runMigrations = runMigrations;
/**
 * Einmalige Datenmigration beim Server-Start
 * Behebt inkonsistente Daten aus älteren Versionen
 */
const Conversation_1 = require("../models/Conversation");
async function runMigrations() {
    try {
        // Fix: Gruppen die groupName haben aber isGroup=false
        const result = await Conversation_1.Conversation.updateMany({
            $and: [
                { groupName: { $exists: true, $ne: null, $ne: '' } },
                { $or: [{ isGroup: false }, { isGroup: { $exists: false } }] }
            ]
        }, { $set: { isGroup: true } });
        if (result.modifiedCount > 0) {
            console.log(`✅ Migration: ${result.modifiedCount} Gruppen-Conversations repariert (isGroup=true)`);
        }
        // Fix: Gruppen ohne admins-Array → ersten Teilnehmer als Admin setzen
        const groupsWithoutAdmin = await Conversation_1.Conversation.find({
            isGroup: true,
            $or: [{ admins: { $exists: false } }, { admins: { $size: 0 } }]
        });
        for (const g of groupsWithoutAdmin) {
            if (g.participants.length > 0) {
                g.admins = [g.participants[0]];
                await g.save();
            }
        }
        if (groupsWithoutAdmin.length > 0) {
            console.log(`✅ Migration: ${groupsWithoutAdmin.length} Gruppen haben jetzt einen Admin`);
        }
        // Bestehende User ohne emailVerified als verifiziert markieren
        // (sie haben sich vor Einführung des Features registriert)
        const unverifiedResult = await (await Promise.resolve().then(() => __importStar(require('../models/User')))).User.updateMany({ emailVerified: { $exists: false } }, { $set: { emailVerified: true } });
        if (unverifiedResult.modifiedCount > 0) {
            console.log(`✅ Migration: ${unverifiedResult.modifiedCount} bestehende User als E-Mail-verifiziert markiert`);
        }
        // Bestehende User ohne Identität → automatisch Privat-Identität erstellen
        try {
            const { User } = await Promise.resolve().then(() => __importStar(require('../models/User')));
            const { Identity } = await Promise.resolve().then(() => __importStar(require('../models/Identity')));
            const usersWithoutIdentity = await User.find({ identityCount: { $in: [0, null, undefined] } });
            let identityCount = 0;
            for (const u of usersWithoutIdentity) {
                const existing = await Identity.findOne({ userId: u._id });
                if (!existing) {
                    const identity = await Identity.create({
                        userId: u._id,
                        type: 'private',
                        uin: u.uin,
                        username: u.username,
                        isDefault: true,
                        isActive: true,
                        settings: { notifications: true, newChatLimit: 100 },
                    });
                    await User.findByIdAndUpdate(u._id, {
                        activeIdentityId: identity._id,
                        identityCount: 1,
                    });
                    identityCount++;
                }
            }
            if (identityCount > 0) {
                console.log(`✅ Migration: ${identityCount} bestehende User haben jetzt eine Privat-Identität`);
            }
        }
        catch (_ie) {
            console.error('Identity-Migration Fehler:', _ie);
        }
        // Bestehende Conversations ohne identityParticipants befüllen
        try {
            const { Conversation } = await Promise.resolve().then(() => __importStar(require('../models/Conversation')));
            const { Identity } = await Promise.resolve().then(() => __importStar(require('../models/Identity')));
            const convs = await Conversation.find({
                $or: [
                    { identityParticipants: { $exists: false } },
                    { identityParticipants: { $size: 0 } }
                ]
            }).limit(1000);
            let convFixed = 0;
            for (const conv of convs) {
                if (!conv.isGroup && conv.participants.length > 0) {
                    const identityIds = [];
                    for (const userId of conv.participants) {
                        const ident = await Identity.findOne({ userId, isDefault: true });
                        if (ident)
                            identityIds.push(ident._id);
                    }
                    if (identityIds.length > 0) {
                        conv.identityParticipants = identityIds;
                        await conv.save();
                        convFixed++;
                    }
                }
            }
            if (convFixed > 0) {
                console.log(`✅ Migration: ${convFixed} Conversations mit Identity verknüpft`);
            }
        }
        catch (_ce) {
            console.error('Conversation-Identity Migration Fehler:', _ce);
        }
        // Bestehende Kontakte ohne identityId → der Default-Identity des Owners zuordnen
        try {
            const { Contact } = await Promise.resolve().then(() => __importStar(require('../models/Contact')));
            const { Identity } = await Promise.resolve().then(() => __importStar(require('../models/Identity')));
            const contactsWithoutIdentity = await Contact.find({
                identityId: { $exists: false }
            }).limit(5000);
            let contactFixed = 0;
            for (const c of contactsWithoutIdentity) {
                const ident = await Identity.findOne({ userId: c.owner, isDefault: true });
                if (ident) {
                    await Contact.findByIdAndUpdate(c._id, { identityId: ident._id });
                    contactFixed++;
                }
            }
            if (contactFixed > 0) {
                console.log(`✅ Migration: ${contactFixed} Kontakte der Default-Identity zugeordnet`);
            }
        }
        catch (_ce) {
            console.error('Contact-Identity Migration Fehler:', _ce);
        }
    }
    catch (err) {
        console.error('Migration Fehler (nicht kritisch):', err);
    }
}
