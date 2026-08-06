import { Router, Response } from 'express'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import webpush from 'web-push'

const router = Router()

// -- VAPID Keys einmalig generieren und in .env speichern ---------------------
// Einmalig ausführen: node -e "const wp=require('web-push'); console.log(wp.generateVAPIDKeys())"
// Dann in .env eintragen:
// VAPID_PUBLIC_KEY=...
// VAPID_PRIVATE_KEY=...
// VAPID_EMAIL=mailto:privacy@lumestack.de

const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY  || ''
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || ''
const VAPID_EMAIL   = process.env.VAPID_EMAIL       || 'mailto:privacy@lumestack.de'

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE)
}

// In-Memory Store (für Produktion: in MongoDB speichern)
const subscriptions = new Map<string, any>()

// -- GET /api/push/vapid-public-key -------------------------------------------
router.get('/vapid-public-key', (_req, res: Response): void => {
  if (!VAPID_PUBLIC) {
    res.json({ publicKey: null })
    return
  }
  res.json({ publicKey: VAPID_PUBLIC })
})

// -- POST /api/push/subscribe -------------------------------------------------
router.post('/subscribe', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const subscription = req.body
    if (!subscription?.endpoint) { res.status(400).json({ error: 'Ungültige Subscription' }); return }

    // Subscription pro User speichern
    subscriptions.set(req.userId!, subscription)
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: String(err) }) }
})

// -- POST /api/push/unsubscribe -----------------------------------------------
router.post('/unsubscribe', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  subscriptions.delete(req.userId!)
  res.json({ ok: true })
})

// -- Hilfsfunktion: Push an einen User senden ---------------------------------
export async function sendPushToUser(userId: string, payload: {
  title: string
  body: string
  url?: string
  tag?: string
}): Promise<void> {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return

  const sub = subscriptions.get(userId)
  if (!sub) return

  try {
    await webpush.sendNotification(sub, JSON.stringify({
      title: payload.title,
      body:  payload.body,
      url:   payload.url || '/chat',
      tag:   payload.tag || 'pingr',
    }))
  } catch (err: any) {
    // Subscription abgelaufen oder ungültig ? entfernen
    if (err.statusCode === 410 || err.statusCode === 404) {
      subscriptions.delete(userId)
    }
  }
}

export default router

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