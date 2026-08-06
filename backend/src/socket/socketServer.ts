import { Server, Socket } from 'socket.io'
import { Server as HttpServer } from 'http'
import jwt from 'jsonwebtoken'
import { User } from '../models/User'
import { EVENTS } from './events'
import { Message } from '../models/Message'
import { Identity } from '../models/Identity'
import { Conversation } from '../models/Conversation'
import * as voice from './voiceServer'
import { isConversationMember } from '../middleware/conversationAccess'

let io: Server

export function getIO(): Server {
  if (!io) throw new Error('Socket.IO nicht initialisiert')
  return io
}

export function initSocket(httpServer: HttpServer): void {
  const appOrigin = new URL(process.env.APP_URL || 'https://lumestack.de').origin
  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => callback(null, !origin || origin === appOrigin),
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingTimeout:  60000,
    pingInterval: 25000,
    maxHttpBufferSize: 1_000_000,
  })

  io.use(async (socket: Socket, next: (err?: Error) => void) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined
      if (!token) { next(new Error('Nicht autorisiert')); return }
      const jwtSecret = process.env.JWT_SECRET
      if (!jwtSecret) { next(new Error('Server nicht konfiguriert')); return }
      const payload = jwt.verify(token, jwtSecret, { algorithms: ['HS256'], issuer: 'nokki-api' }) as { userId: string; activeIdentityId?: string }
      if (!payload.userId) { next(new Error('Token ungültig')); return }
      socket.data.userId = payload.userId
      socket.data.authorizedConversations = new Set<string>()
      
      // 🔒 SECURITY FIX: Identity aus JWT oder validiert
      const requestedIdentityId = socket.handshake.auth?.identityId || payload.activeIdentityId
      
      if (requestedIdentityId) {
        // ✅ Validiere: Identity gehört dem User
        const identity = await Identity.findOne({
          _id: requestedIdentityId,
          userId: payload.userId
        }).lean()
        
        if (!identity) {
          next(new Error('Unauthorized identity'))
          return
        }
        
        socket.data.activeIdentityId = identity._id.toString()
      } else {
        // Fallback: Lade aktive Identity
        const ident = await Identity.findOne({ userId: payload.userId, isActive: true }).lean()
        if (ident) socket.data.activeIdentityId = ident._id.toString()
      }
      
      next()
    } catch (_err) {
      next(new Error('Token ungültig'))
    }
  })

  io.on('connection', async (socket: Socket) => {
    const userId = socket.data.userId as string
    const authorizeConversation = async (conversationId: unknown): Promise<boolean> => {
      const id = String(conversationId || '')
      const authorized = socket.data.authorizedConversations as Set<string>
      if (authorized.has(id)) return true
      if (!(await isConversationMember(id, userId))) return false
      authorized.add(id)
      return true
    }

    await User.findByIdAndUpdate(userId, { status: 'online', lastSeen: new Date() })
    io.emit(EVENTS.USER_STATUS, { userId, status: 'online', lastSeen: new Date() })

    // 🔒 SECURITY FIX: Multi-Identity Notifications
    // ✅ Socket joined ALLE Identity-Räume des Users
    try {
      const userIdentities = await Identity.find({ userId }).lean()
      
      userIdentities.forEach(identity => {
        const roomName = `identity:${identity._id}`
        socket.join(roomName)
        console.log(`✅ Socket ${socket.id} joined ${roomName}`)
      })

      // User-Room (für globale Events)
      socket.join(`user:${userId}`)
      
      console.log(`User ${userId} connected with ${userIdentities.length} identities (active: ${socket.data.activeIdentityId})`)
    } catch (err) {
      console.error('Failed to join identity rooms:', err)
    }

    socket.on(EVENTS.JOIN_CONVERSATION, async (conversationId: string) => {
      if (!(await authorizeConversation(conversationId))) {
        socket.emit('error', { error: 'Keine Berechtigung für diese Unterhaltung' })
        return
      }
      socket.join(`conv:${conversationId}`)
    })

    socket.on(EVENTS.LEAVE_CONVERSATION, (conversationId: string) => {
      socket.leave(`conv:${conversationId}`)
    })

    socket.on(EVENTS.TYPING_START, ({ conversationId }: { conversationId: string }) => {
      if (!(socket.data.authorizedConversations as Set<string>).has(String(conversationId))) return
      socket.to(`conv:${conversationId}`).emit(EVENTS.USER_TYPING, { userId, conversationId })
    })

    socket.on(EVENTS.TYPING_STOP, ({ conversationId }: { conversationId: string }) => {
      if (!(socket.data.authorizedConversations as Set<string>).has(String(conversationId))) return
      socket.to(`conv:${conversationId}`).emit(EVENTS.USER_STOP_TYPING, { userId, conversationId })
    })

    // 🔒 SECURITY FIX: Ping mit Identity-Validierung
    socket.on(EVENTS.PING_USER, async ({ targetUserId, targetIdentityId, senderName }: { targetUserId: string; targetIdentityId?: string; senderName: string }) => {
      // ✅ Prüfe ob Sender-Identity dem Sender gehört
      if (socket.data.activeIdentityId) {
        const senderIdentity = await Identity.findOne({
          _id: socket.data.activeIdentityId,
          userId: socket.data.userId
        }).lean()
        
        if (!senderIdentity) {
          console.warn(`Invalid sender identity: ${socket.data.activeIdentityId}`)
          return
        }
      }

      const sockets = await io.fetchSockets()
      sockets
        .filter(s => {
          if (s.data.userId !== targetUserId) return false
          // Wenn identityId angegeben: nur an die richtige Identity
          if (targetIdentityId && s.data.activeIdentityId) {
            return s.data.activeIdentityId === targetIdentityId
          }
          return true
        })
        .forEach(s => s.emit(EVENTS.INCOMING_PING, { 
          fromUserId: userId, 
          fromIdentityId: socket.data.activeIdentityId,
          senderName 
        }))
    })

    // ✅ NEU: Identity-Switch ohne Reconnect
    socket.on('switch_identity', async ({ identityId }: { identityId: string }) => {
      try {
        // Validiere Identity gehört dem User
        const identity = await Identity.findOne({
          _id: identityId,
          userId: socket.data.userId
        }).lean()

        if (!identity) {
          socket.emit('error', { error: 'Unauthorized identity' })
          return
        }

        // Speichere neue aktive Identity
        const oldIdentityId = socket.data.activeIdentityId
        socket.data.activeIdentityId = identityId

        // Update isActive in DB
        if (oldIdentityId) {
          await Identity.findByIdAndUpdate(oldIdentityId, { isActive: false })
        }
        await Identity.findByIdAndUpdate(identityId, { isActive: true })

        socket.emit('identity_switched', {
          identityId,
          type: identity.type,
          label: identity.username
        })

        console.log(`Socket ${socket.id} switched from ${oldIdentityId} to ${identityId}`)
      } catch (error) {
        console.error('Identity switch error:', error)
        socket.emit('error', { error: 'Failed to switch identity' })
      }
    })
  
    // ── WebRTC Signaling (Identity-aware) ────────────────────────────────────
    socket.on('webrtc_offer', async ({ to, toIdentityId, offer, conversationId, callerName }) => {
      if (!(await authorizeConversation(conversationId)) || !(await isConversationMember(conversationId, to))) return
      // ✅ SECURITY: fromIdentityId IMMER vom Server, niemals vom Client
      const fromIdentityId = socket.data.activeIdentityId
      
      const targetSocket = [...io.sockets.sockets.values()]
        .find(s => s.data.userId === to && (!toIdentityId || s.data.activeIdentityId === toIdentityId))
      
      if (targetSocket) {
        targetSocket.emit('incoming_call', {
          from: socket.data.userId,
          fromIdentityId,  // ← NUR vom Server
          callerName: callerName || 'Unbekannt',
          offer,
          conversationId,
        })
      }
    })

    socket.on('webrtc_answer', async ({ to, answer, conversationId }) => {
      if (!(await authorizeConversation(conversationId)) || !(await isConversationMember(conversationId, to))) return
      // ✅ SECURITY: fromIdentityId serverseitig
      const fromIdentityId = socket.data.activeIdentityId
      
      const targetSocket = [...io.sockets.sockets.values()]
        .find(s => s.data.userId === to)
      
      if (targetSocket) {
        targetSocket.emit('webrtc_answer', {
          from: socket.data.userId,
          fromIdentityId,  // ← NUR vom Server
          answer,
          conversationId,
        })
      }
    })

    socket.on('webrtc_ice', async ({ to, candidate, conversationId }) => {
      if (!(await authorizeConversation(conversationId)) || !(await isConversationMember(conversationId, to))) return
      const targetSocket = [...io.sockets.sockets.values()]
        .find(s => s.data.userId === to)
      
      if (targetSocket) {
        targetSocket.emit('webrtc_ice', {
          from: socket.data.userId,
          candidate,
          conversationId,
        })
      }
    })

    socket.on('webrtc_hangup', async ({ to, conversationId }) => {
      if (!(await authorizeConversation(conversationId)) || !(await isConversationMember(conversationId, to))) return
      const targetSocket = [...io.sockets.sockets.values()]
        .find(s => s.data.userId === to)
      
      if (targetSocket) {
        targetSocket.emit('webrtc_hangup', {
          from: socket.data.userId,
          conversationId,
        })
      }
    })

    // ── 🎙️ VOICE CHANNEL EVENTS ──────────────────────────────────────────────

    // 1. RTP Capabilities holen (erster Schritt)
    socket.on('voice_get_rtp_caps', async ({ conversationId }: { conversationId: string }) => {
      try {
        if (!(await authorizeConversation(conversationId))) throw new Error('Keine Berechtigung')
        const caps = await voice.getRtpCapabilities(conversationId)
        socket.emit('voice_rtp_caps', { rtpCapabilities: caps })
      } catch (err) {
        socket.emit('voice_error', { error: String(err) })
      }
    })

    // 2. Room betreten
    socket.on('voice_join', async ({ conversationId }: { conversationId: string }) => {
      try {
        if (!(await authorizeConversation(conversationId))) throw new Error('Keine Berechtigung')
        const user = await User.findById(userId).lean() as any
        const username = user?.username || 'Unbekannt'

        const peers = await voice.joinVoiceRoom(conversationId, socket.id, userId, username)

        // Anderen Peers mitteilen dass jemand beigetreten ist
        socket.to(`conv:${conversationId}`).emit('voice_peer_joined', {
          socketId: socket.id,
          userId,
          username,
          isMuted: false,
          hasAudio: false,
        })

        // Dem neuen Peer alle aktuellen Peers schicken
        socket.emit('voice_peers', peers)

        // Voice Room joinen
        socket.join(`voice:${conversationId}`)
        console.log(`🎙️ ${username} joined voice:${conversationId}`)
      } catch (err) {
        socket.emit('voice_error', { error: String(err) })
      }
    })

    // 3. Send Transport erstellen
    socket.on('voice_create_send_transport', async ({ conversationId }: { conversationId: string }) => {
      try {
        if (!(await authorizeConversation(conversationId))) throw new Error('Keine Berechtigung')
        const params = await voice.createSendTransport(conversationId, socket.id)
        socket.emit('voice_send_transport_created', params)
      } catch (err) {
        socket.emit('voice_error', { error: String(err) })
      }
    })

    // 4. Recv Transport erstellen (für jeden anderen Peer)
    socket.on('voice_create_recv_transport', async ({ conversationId, producerSocketId }: { conversationId: string; producerSocketId: string }) => {
      try {
        if (!(await authorizeConversation(conversationId))) throw new Error('Keine Berechtigung')
        const params = await voice.createRecvTransport(conversationId, socket.id, producerSocketId)
        socket.emit('voice_recv_transport_created', { ...params, producerSocketId })
      } catch (err) {
        socket.emit('voice_error', { error: String(err) })
      }
    })

    // 5. Transport verbinden
    socket.on('voice_connect_transport', async ({ conversationId, transportId, dtlsParameters }: { conversationId: string; transportId: string; dtlsParameters: any }) => {
      try {
        if (!(await authorizeConversation(conversationId))) throw new Error('Keine Berechtigung')
        await voice.connectTransport(conversationId, socket.id, transportId, dtlsParameters)
        socket.emit('voice_transport_connected', { transportId })
      } catch (err) {
        socket.emit('voice_error', { error: String(err) })
      }
    })

    // 6. Audio produzieren (senden)
    socket.on('voice_produce', async ({ conversationId, rtpParameters }: { conversationId: string; rtpParameters: any }) => {
      try {
        if (!(await authorizeConversation(conversationId))) throw new Error('Keine Berechtigung')
        const producerId = await voice.produce(conversationId, socket.id, rtpParameters)

        // Allen anderen mitteilen dass dieser Peer jetzt Audio hat
        socket.to(`voice:${conversationId}`).emit('voice_producer_ready', {
          producerSocketId: socket.id,
          producerId,
          userId,
        })

        socket.emit('voice_produced', { producerId })
      } catch (err) {
        socket.emit('voice_error', { error: String(err) })
      }
    })

    // 7. Audio konsumieren (empfangen)
    socket.on('voice_consume', async ({ conversationId, producerSocketId, rtpCapabilities }: { conversationId: string; producerSocketId: string; rtpCapabilities: any }) => {
      try {
        if (!(await authorizeConversation(conversationId))) throw new Error('Keine Berechtigung')
        const params = await voice.consume(conversationId, socket.id, producerSocketId, rtpCapabilities)
        socket.emit('voice_consumed', { ...params, producerSocketId })
      } catch (err) {
        socket.emit('voice_error', { error: String(err) })
      }
    })

    // 8. Mute toggling
    socket.on('voice_mute_toggle', ({ conversationId }: { conversationId: string }) => {
      if (!(socket.data.authorizedConversations as Set<string>).has(String(conversationId))) return
      const isMuted = voice.toggleMute(conversationId, socket.id)
      if (isMuted !== null) {
        io.to(`voice:${conversationId}`).emit('voice_peer_muted', {
          socketId: socket.id,
          userId,
          isMuted,
        })
      }
    })

    // 9. Room verlassen
    socket.on('voice_leave', ({ conversationId }: { conversationId: string }) => {
      if (!(socket.data.authorizedConversations as Set<string>).has(String(conversationId))) return
      const peer = voice.leaveVoiceRoom(conversationId, socket.id)
      socket.leave(`voice:${conversationId}`)
      if (peer) {
        io.to(`voice:${conversationId}`).emit('voice_peer_left', {
          socketId: socket.id,
          userId:   peer.userId,
          username: peer.username,
        })
      }
    })

    socket.on('disconnect', async () => {
      // Voice Rooms aufräumen bei Disconnect
      const activeRooms = voice.getActiveVoiceRooms()
      for (const convId of activeRooms) {
        const peer = voice.leaveVoiceRoom(convId, socket.id)
        if (peer) {
          io.to(`voice:${convId}`).emit('voice_peer_left', {
            socketId: socket.id,
            userId:   peer.userId,
            username: peer.username,
          })
        }
      }
      const sockets = await io.fetchSockets()
      const stillOnline = sockets.some(s => s.data.userId === userId)
      if (!stillOnline) {
        const now = new Date()
        await User.findByIdAndUpdate(userId, { status: 'offline', lastSeen: now })
        // Auch alle Identity-Status updaten
        try {
          await Identity.updateMany(
            { userId },
            { status: 'offline' }
          )
        } catch (_e) {}
        io.emit(EVENTS.USER_STATUS, { userId, status: 'offline', lastSeen: now })
      }
    })
  })

  console.log('✅ Socket.IO initialisiert (Multi-Identity Support)')
}

// Worker beim Import starten
import { startMediasoupWorker } from './voiceServer'
startMediasoupWorker().catch(err => console.error('❌ mediasoup Worker Fehler:', err))
