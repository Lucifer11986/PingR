"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPushToUser = sendPushToUser;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const web_push_1 = __importDefault(require("web-push"));
const router = (0, express_1.Router)();
// -- VAPID Keys einmalig generieren und in .env speichern ---------------------
// Einmalig ausf�hren: node -e "const wp=require('web-push'); console.log(wp.generateVAPIDKeys())"
// Dann in .env eintragen:
// VAPID_PUBLIC_KEY=...
// VAPID_PRIVATE_KEY=...
// VAPID_EMAIL=mailto:privacy@lumestack.de
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:privacy@lumestack.de';
if (VAPID_PUBLIC && VAPID_PRIVATE) {
    web_push_1.default.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
}
// In-Memory Store (f�r Produktion: in MongoDB speichern)
const subscriptions = new Map();
// -- GET /api/push/vapid-public-key -------------------------------------------
router.get('/vapid-public-key', (_req, res) => {
    if (!VAPID_PUBLIC) {
        res.json({ publicKey: null });
        return;
    }
    res.json({ publicKey: VAPID_PUBLIC });
});
// -- POST /api/push/subscribe -------------------------------------------------
router.post('/subscribe', auth_1.authMiddleware, async (req, res) => {
    try {
        const subscription = req.body;
        if (!subscription?.endpoint) {
            res.status(400).json({ error: 'Ung�ltige Subscription' });
            return;
        }
        // Subscription pro User speichern
        subscriptions.set(req.userId, subscription);
        res.json({ ok: true });
    }
    catch (err) {
        res.status(500).json({ error: String(err) });
    }
});
// -- POST /api/push/unsubscribe -----------------------------------------------
router.post('/unsubscribe', auth_1.authMiddleware, async (req, res) => {
    subscriptions.delete(req.userId);
    res.json({ ok: true });
});
// -- Hilfsfunktion: Push an einen User senden ---------------------------------
async function sendPushToUser(userId, payload) {
    if (!VAPID_PUBLIC || !VAPID_PRIVATE)
        return;
    const sub = subscriptions.get(userId);
    if (!sub)
        return;
    try {
        await web_push_1.default.sendNotification(sub, JSON.stringify({
            title: payload.title,
            body: payload.body,
            url: payload.url || '/chat',
            tag: payload.tag || 'pingr',
        }));
    }
    catch (err) {
        // Subscription abgelaufen oder ung�ltig ? entfernen
        if (err.statusCode === 410 || err.statusCode === 404) {
            subscriptions.delete(userId);
        }
    }
}
exports.default = router;
// -------------------------------------------------------------------------------
// EINRICHTUNG (einmalig auf dem Server):
//
// 1. web-push installieren:
//    cd /opt/pingr/backend && npm install web-push
//    cd /opt/pingr/backend && npm install --save-dev @types/web-push
//
// 2. VAPID Keys generieren:
//    docker exec pingr-backend-1 node -e \
//      "const wp=require('web-push'); const k=wp.generateVAPIDKeys(); console.log(JSON.stringify(k))"
//
// 3. Keys in .env eintragen:
//    VAPID_PUBLIC_KEY=<publicKey aus Schritt 2>
//    VAPID_PRIVATE_KEY=<privateKey aus Schritt 2>
//    VAPID_EMAIL=mailto:privacy@lumestack.de
//
// 4. In index.ts eintragen (nach den anderen Routes):
//    import pushRoutes from './routes/push'
//    app.use('/api/push', pushRoutes)
//
// 5. In messages.ts beim Senden einer Nachricht aufrufen:
//    import { sendPushToUser } from './push'
//    // Nach dem Speichern der Nachricht:
//    sendPushToUser(receiverId, {
//      title: `?? ${senderName}`,
//      body: messageContent,
//      url: `/chat`,
//      tag: `msg-${conversationId}`,
//    })
// -------------------------------------------------------------------------------
