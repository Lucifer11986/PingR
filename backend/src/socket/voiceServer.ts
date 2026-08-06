// /opt/pingr/backend/src/socket/voiceServer.ts
// mediasoup SFU für Gruppen-Voice-Channels
import * as mediasoup from 'mediasoup'
import type { Worker, Router, WebRtcTransport, Producer, Consumer } from 'mediasoup/node/lib/types'

// ── Typen ─────────────────────────────────────────────────────────────────────
interface Peer {
  userId:     string
  username:   string
  socketId:   string
  isMuted:    boolean
  transport?: WebRtcTransport   // send transport
  recvTransports: Map<string, WebRtcTransport>  // socketId → transport
  producer?:  Producer
  consumers:  Map<string, Consumer>  // producerId → consumer
}

interface VoiceRoom {
  conversationId: string
  router:  Router
  peers:   Map<string, Peer>  // socketId → Peer
}

// ── State ──────────────────────────────────────────────────────────────────────
let worker: Worker | null = null
const rooms = new Map<string, VoiceRoom>()  // conversationId → VoiceRoom

// ── mediasoup Codec-Konfiguration ─────────────────────────────────────────────
const mediaCodecs: mediasoup.types.RtpCodecCapability[] = [
  {
    kind:      'audio',
    mimeType:  'audio/opus',
    preferredPayloadType: 111,
    clockRate: 48000,
    channels:  2,
  },
]

// ── Worker starten ─────────────────────────────────────────────────────────────
export async function startMediasoupWorker() {
  worker = await mediasoup.createWorker({
    logLevel: 'warn',
    rtcMinPort: parseInt(process.env.MEDIASOUP_MIN_PORT || '40000'),
    rtcMaxPort: parseInt(process.env.MEDIASOUP_MAX_PORT || '40100'),
  })

  worker.on('died', () => {
    console.error('❌ mediasoup Worker gestorben — neustart in 2s')
    setTimeout(() => startMediasoupWorker(), 2000)
  })

  console.log('✅ mediasoup Worker gestartet')
}

// ── Room holen oder erstellen ─────────────────────────────────────────────────
async function getOrCreateRoom(conversationId: string): Promise<VoiceRoom> {
  if (rooms.has(conversationId)) return rooms.get(conversationId)!

  if (!worker) throw new Error('mediasoup Worker nicht bereit')

  const router = await worker.createRouter({ mediaCodecs })
  const room: VoiceRoom = { conversationId, router, peers: new Map() }
  rooms.set(conversationId, room)
  console.log(`🎙️ Voice Room erstellt: ${conversationId}`)
  return room
}

// ── Room löschen wenn leer ────────────────────────────────────────────────────
function cleanupRoom(conversationId: string) {
  const room = rooms.get(conversationId)
  if (!room) return
  if (room.peers.size === 0) {
    room.router.close()
    rooms.delete(conversationId)
    console.log(`🗑️ Voice Room geschlossen: ${conversationId}`)
  }
}

// ── RTP Capabilities ──────────────────────────────────────────────────────────
export async function getRtpCapabilities(conversationId: string) {
  const room = await getOrCreateRoom(conversationId)
  return room.router.rtpCapabilities
}

// ── Send Transport erstellen ──────────────────────────────────────────────────
export async function createSendTransport(conversationId: string, socketId: string) {
  const room = await getOrCreateRoom(conversationId)
  const transport = await room.router.createWebRtcTransport({
    listenIps: [{ ip: '0.0.0.0', announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP || process.env.SERVER_IP || '127.0.0.1' }],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
  })

  const peer = room.peers.get(socketId)
  if (peer) peer.transport = transport

  return {
    id:             transport.id,
    iceParameters:  transport.iceParameters,
    iceCandidates:  transport.iceCandidates,
    dtlsParameters: transport.dtlsParameters,
  }
}

// ── Recv Transport erstellen ──────────────────────────────────────────────────
export async function createRecvTransport(conversationId: string, socketId: string, producerSocketId: string) {
  const room = await getOrCreateRoom(conversationId)
  const transport = await room.router.createWebRtcTransport({
    listenIps: [{ ip: '0.0.0.0', announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP || process.env.SERVER_IP || '127.0.0.1' }],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
  })

  const peer = room.peers.get(socketId)
  if (peer) peer.recvTransports.set(producerSocketId, transport)

  return {
    id:             transport.id,
    iceParameters:  transport.iceParameters,
    iceCandidates:  transport.iceCandidates,
    dtlsParameters: transport.dtlsParameters,
  }
}

// ── Transport verbinden ───────────────────────────────────────────────────────
export async function connectTransport(
  conversationId: string,
  socketId: string,
  transportId: string,
  dtlsParameters: mediasoup.types.DtlsParameters
) {
  const room = rooms.get(conversationId)
  if (!room) return

  const peer = room.peers.get(socketId)
  if (!peer) return

  // Send transport?
  if (peer.transport?.id === transportId) {
    await peer.transport.connect({ dtlsParameters })
    return
  }

  // Recv transport?
  for (const [, t] of peer.recvTransports) {
    if (t.id === transportId) {
      await t.connect({ dtlsParameters })
      return
    }
  }
}

// ── Produzieren (Audio senden) ────────────────────────────────────────────────
export async function produce(
  conversationId: string,
  socketId: string,
  rtpParameters: mediasoup.types.RtpParameters
): Promise<string> {
  const room = rooms.get(conversationId)
  if (!room) throw new Error('Room nicht gefunden')

  const peer = room.peers.get(socketId)
  if (!peer?.transport) throw new Error('Transport nicht gefunden')

  const producer = await peer.transport.produce({ kind: 'audio', rtpParameters })
  peer.producer = producer

  producer.on('transportclose', () => { producer.close() })

  return producer.id
}

// ── Konsumieren (Audio empfangen) ─────────────────────────────────────────────
export async function consume(
  conversationId: string,
  consumerSocketId: string,
  producerSocketId: string,
  rtpCapabilities: mediasoup.types.RtpCapabilities
) {
  const room = rooms.get(conversationId)
  if (!room) throw new Error('Room nicht gefunden')

  const producerPeer = room.peers.get(producerSocketId)
  if (!producerPeer?.producer) throw new Error('Producer nicht gefunden')

  if (!room.router.canConsume({ producerId: producerPeer.producer.id, rtpCapabilities })) {
    throw new Error('Kann nicht konsumieren')
  }

  const recvTransport = room.peers.get(consumerSocketId)?.recvTransports.get(producerSocketId)
  if (!recvTransport) throw new Error('Recv Transport nicht gefunden')

  const consumer = await recvTransport.consume({
    producerId:      producerPeer.producer.id,
    rtpCapabilities,
    paused:          false,
  })

  room.peers.get(consumerSocketId)?.consumers.set(producerPeer.producer.id, consumer)

  consumer.on('transportclose', () => { consumer.close() })
  consumer.on('producerclose',  () => { consumer.close() })

  return {
    id:            consumer.id,
    producerId:    producerPeer.producer.id,
    kind:          consumer.kind,
    rtpParameters: consumer.rtpParameters,
  }
}

// ── Peer dem Room hinzufügen ──────────────────────────────────────────────────
export async function joinVoiceRoom(conversationId: string, socketId: string, userId: string, username: string) {
  const room = await getOrCreateRoom(conversationId)

  // Schon drin?
  if (room.peers.has(socketId)) return getPeersInfo(conversationId)

  const peer: Peer = {
    userId,
    username,
    socketId,
    isMuted: false,
    recvTransports: new Map(),
    consumers: new Map(),
  }
  room.peers.set(socketId, peer)

  console.log(`🎙️ ${username} joined voice room ${conversationId} (${room.peers.size} peers)`)
  return getPeersInfo(conversationId)
}

// ── Peer entfernen ────────────────────────────────────────────────────────────
export function leaveVoiceRoom(conversationId: string, socketId: string) {
  const room = rooms.get(conversationId)
  if (!room) return

  const peer = room.peers.get(socketId)
  if (!peer) return

  // Alle Consumers schließen
  for (const [, consumer] of peer.consumers) consumer.close()
  // Alle Recv Transports schließen
  for (const [, transport] of peer.recvTransports) transport.close()
  // Send Transport schließen
  peer.transport?.close()
  // Producer schließen
  peer.producer?.close()

  room.peers.delete(socketId)
  console.log(`🎙️ ${peer.username} left voice room ${conversationId} (${room.peers.size} peers)`)

  cleanupRoom(conversationId)
  return peer
}

// ── Mute toggling ─────────────────────────────────────────────────────────────
export function toggleMute(conversationId: string, socketId: string): boolean | null {
  const room = rooms.get(conversationId)
  if (!room) return null

  const peer = room.peers.get(socketId)
  if (!peer) return null

  peer.isMuted = !peer.isMuted

  if (peer.producer) {
    if (peer.isMuted) peer.producer.pause()
    else              peer.producer.resume()
  }

  return peer.isMuted
}

// ── Peer-Liste für Client ─────────────────────────────────────────────────────
export function getPeersInfo(conversationId: string) {
  const room = rooms.get(conversationId)
  if (!room) return []

  return [...room.peers.values()].map(p => ({
    socketId:   p.socketId,
    userId:     p.userId,
    username:   p.username,
    isMuted:    p.isMuted,
    hasAudio:   !!p.producer,
  }))
}

// ── Alle aktiven Voice Rooms ──────────────────────────────────────────────────
export function getActiveVoiceRooms(): string[] {
  return [...rooms.keys()]
}
