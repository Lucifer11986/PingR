// /opt/pingr/frontend/src/hooks/useVoiceChannel.ts
import { useEffect, useRef, useState, useCallback } from 'react'
import { getSocket } from '../services/socket'

export interface VoicePeer {
  socketId:  string
  userId:    string
  username:  string
  isMuted:   boolean
  hasAudio:  boolean
}

export function useVoiceChannel(conversationId: string | null) {
  const [peers,   setPeers]   = useState<VoicePeer[]>([])
  const [joined,  setJoined]  = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const deviceRef        = useRef<any>(null)
  const sendTransportRef = useRef<any>(null)
  const producerRef      = useRef<any>(null)
  const recvTransports   = useRef<Map<string, any>>(new Map())
  const audioElements    = useRef<Map<string, HTMLAudioElement>>(new Map())
  const streamRef        = useRef<MediaStream | null>(null)
  const peersRef         = useRef<VoicePeer[]>([])

  const socket = getSocket()

  // peers ref aktuell halten
  useEffect(() => { peersRef.current = peers }, [peers])

  // ── Cleanup ───────────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    for (const [, el] of audioElements.current) { el.srcObject = null; el.remove() }
    audioElements.current.clear()
    sendTransportRef.current?.close()
    sendTransportRef.current = null
    for (const [, t] of recvTransports.current) t.close()
    recvTransports.current.clear()
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    producerRef.current = null
    deviceRef.current = null
    setPeers([])
    setJoined(false)
    setIsMuted(false)
  }, [])

  // ── Audio abspielen ───────────────────────────────────────────────────────
  const playAudio = useCallback((socketId: string, stream: MediaStream) => {
    audioElements.current.get(socketId)?.remove()
    const el = document.createElement('audio')
    el.autoplay = true
    el.srcObject = stream
    document.body.appendChild(el)
    audioElements.current.set(socketId, el)
  }, [])

  // ── Für einen Peer subscriben ─────────────────────────────────────────────
  const subscribeToProducer = useCallback(async (producerSocketId: string) => {
    if (!conversationId || !deviceRef.current) return

    socket.emit('voice_create_recv_transport', { conversationId, producerSocketId })

    socket.once('voice_recv_transport_created', async (params: any) => {
      if (params.producerSocketId !== producerSocketId || !deviceRef.current) return

      const transport = deviceRef.current.createRecvTransport(params)
      recvTransports.current.set(producerSocketId, transport)

      transport.on('connect', ({ dtlsParameters }: any, callback: any) => {
        socket.emit('voice_connect_transport', { conversationId, transportId: transport.id, dtlsParameters })
        socket.once('voice_transport_connected', () => callback())
      })

      socket.emit('voice_consume', {
        conversationId,
        producerSocketId,
        rtpCapabilities: deviceRef.current.rtpCapabilities,
      })

      socket.once('voice_consumed', async (data: any) => {
        if (data.producerSocketId !== producerSocketId) return
        const consumer = await transport.consume({
          id:            data.id,
          producerId:    data.producerId,
          kind:          data.kind,
          rtpParameters: data.rtpParameters,
        })
        playAudio(producerSocketId, new MediaStream([consumer.track]))
        setPeers(prev => prev.map(p => p.socketId === producerSocketId ? { ...p, hasAudio: true } : p))
      })
    })
  }, [conversationId, socket, playAudio])

  // ── Beitreten ─────────────────────────────────────────────────────────────
  const join = useCallback(async () => {
    if (!conversationId || joined) return
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      streamRef.current = stream

      socket.emit('voice_get_rtp_caps', { conversationId })

      socket.once('voice_rtp_caps', async ({ rtpCapabilities }: any) => {
        try {
          const { Device } = await import('mediasoup-client')
          const device = new Device()
          await device.load({ routerRtpCapabilities: rtpCapabilities })
          deviceRef.current = device
          socket.emit('voice_join', { conversationId })
        } catch (err: any) {
          setError(err.message || 'mediasoup Fehler')
          cleanup()
        }
      })
    } catch (err: any) {
      setError(err.message || 'Mikrofon-Zugriff verweigert')
      cleanup()
    }
  }, [conversationId, joined, socket, cleanup])

  // ── Verlassen ─────────────────────────────────────────────────────────────
  const leave = useCallback(() => {
    if (!conversationId) return
    socket.emit('voice_leave', { conversationId })
    cleanup()
  }, [conversationId, socket, cleanup])

  // ── Mute ──────────────────────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    if (!conversationId) return
    socket.emit('voice_mute_toggle', { conversationId })
    const track = streamRef.current?.getAudioTracks()[0]
    if (track) track.enabled = isMuted
    setIsMuted(m => !m)
  }, [conversationId, socket, isMuted])

  // ── Socket Events ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!conversationId) return

    socket.on('voice_peers', async (initialPeers: VoicePeer[]) => {
      setPeers(initialPeers)
      setJoined(true)
      socket.emit('voice_create_send_transport', { conversationId })
    })

    socket.on('voice_send_transport_created', async (params: any) => {
      if (!deviceRef.current || !streamRef.current) return

      const transport = deviceRef.current.createSendTransport(params)
      sendTransportRef.current = transport

      transport.on('connect', ({ dtlsParameters }: any, callback: any) => {
        socket.emit('voice_connect_transport', { conversationId, transportId: transport.id, dtlsParameters })
        socket.once('voice_transport_connected', () => callback())
      })

      transport.on('produce', async ({ kind, rtpParameters }: any, callback: any) => {
        socket.emit('voice_produce', { conversationId, rtpParameters })
        socket.once('voice_produced', ({ producerId }: any) => callback({ id: producerId }))
      })

      const track = streamRef.current.getAudioTracks()[0]
      const producer = await transport.produce({ track })
      producerRef.current = producer

      for (const peer of peersRef.current) {
        if (peer.hasAudio) subscribeToProducer(peer.socketId)
      }
    })

    socket.on('voice_peer_joined', (peer: VoicePeer) => {
      setPeers(prev => [...prev.filter(p => p.socketId !== peer.socketId), peer])
    })

    socket.on('voice_peer_left', ({ socketId }: { socketId: string }) => {
      setPeers(prev => prev.filter(p => p.socketId !== socketId))
      audioElements.current.get(socketId)?.remove()
      audioElements.current.delete(socketId)
      recvTransports.current.get(socketId)?.close()
      recvTransports.current.delete(socketId)
    })

    socket.on('voice_peer_muted', ({ socketId, isMuted: muted }: any) => {
      setPeers(prev => prev.map(p => p.socketId === socketId ? { ...p, isMuted: muted } : p))
    })

    socket.on('voice_producer_ready', ({ producerSocketId }: any) => {
      setPeers(prev => prev.map(p => p.socketId === producerSocketId ? { ...p, hasAudio: true } : p))
      if (joined) subscribeToProducer(producerSocketId)
    })

    socket.on('voice_error', ({ error: err }: any) => {
      console.error('Voice error:', err)
      setError(err)
    })

    return () => {
      socket.off('voice_peers')
      socket.off('voice_send_transport_created')
      socket.off('voice_peer_joined')
      socket.off('voice_peer_left')
      socket.off('voice_peer_muted')
      socket.off('voice_producer_ready')
      socket.off('voice_error')
    }
  }, [conversationId, socket, joined, subscribeToProducer])

  useEffect(() => {
    return () => { if (joined) leave() }
  }, [conversationId])

  return { peers, joined, isMuted, error, join, leave, toggleMute }
}