import { useEffect, useRef, useState, useCallback } from 'react'
import { getSocket } from '../../services/socket'
import { useAuthStore } from '../../store/authStore'

interface Props {
  conversationId: string
  targetUserId:   string
  targetUsername: string
  isIncoming:     boolean
  incomingOffer?: RTCSessionDescriptionInit
  onClose:        () => void
}

type CallState = 'calling' | 'ringing' | 'connecting' | 'connected' | 'ended'

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
}

export default function VideoCall({
  conversationId, targetUserId, targetUsername,
  isIncoming, incomingOffer, onClose
}: Props) {
  const user = useAuthStore(s => s.user)
  const [callState, setCallState] = useState<CallState>(isIncoming ? 'ringing' : 'calling')
  const [videoOn,   setVideoOn]   = useState(true)
  const [audioOn,   setAudioOn]   = useState(true)
  const [duration,  setDuration]  = useState(0)
  const [error,     setError]     = useState('')


  const localRef  = useRef<HTMLVideoElement>(null)
  const remoteRef = useRef<HTMLVideoElement>(null)
  const pcRef     = useRef<RTCPeerConnection | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef  = useRef<ReturnType<typeof setInterval>>()

  const socket = getSocket()

  const addLog = (msg: string) => {
    console.log('[VideoCall]', msg)
  }

  const getStream = async (video = true): Promise<MediaStream> => {
    // Erst mit Video versuchen
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: video ? { width:{ ideal:1280 }, height:{ ideal:720 } } : false,
        audio: { echoCancellation: true, noiseSuppression: true },
      })
    } catch (e: any) {
      // "Device in use" oder "NotReadableError" → nur Audio versuchen
      if (video && (e.name === 'NotReadableError' || e.name === 'AbortError' || e.message?.includes('Device in use'))) {
        addLog('Kamera belegt → nur Audio')
        setVideoOn(false)
        return await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: { echoCancellation: true, noiseSuppression: true },
        })
      }
      // Nur Audio fehlgeschlagen → leerer Stream als Fallback
      if (e.name === 'NotAllowedError') {
        addLog('Zugriff verweigert → leerer Stream')
        return new MediaStream()
      }
      throw e
    }
  }

  const buildPC = useCallback(() => {
    const pc = new RTCPeerConnection(ICE_SERVERS)

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        addLog(`ICE candidate → ${targetUserId}`)
        socket.emit('webrtc_ice', { to: targetUserId, candidate, conversationId })
      }
    }

    pc.oniceconnectionstatechange = () => {
      addLog(`ICE state: ${pc.iceConnectionState}`)
    }

    pc.onconnectionstatechange = () => {
      addLog(`Connection: ${pc.connectionState}`)
      if (pc.connectionState === 'connected') {
        setCallState('connected')
        timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
      }
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        setCallState('ended')
        setTimeout(() => { cleanup(); onClose() }, 2000)
      }
    }

    pc.ontrack = e => {
      addLog(`Remote track received: ${e.track.kind}`)
      if (remoteRef.current && e.streams[0]) {
        remoteRef.current.srcObject = e.streams[0]
      }
    }

    return pc
  }, [targetUserId, socket, conversationId, onClose])

  const cleanup = useCallback(() => {
    clearInterval(timerRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    pcRef.current?.close()
    pcRef.current   = null
    streamRef.current = null
  }, [])

  // CALLER: Anruf starten
  const startCall = useCallback(async () => {
    addLog(`Starte Anruf → ${targetUserId}`)
    try {
      const s = await getStream(videoOn)
      streamRef.current = s
      if (localRef.current) localRef.current.srcObject = s
      addLog('Lokaler Stream OK')

      const pc = buildPC()
      pcRef.current = pc
      s.getTracks().forEach(t => pc.addTrack(t, s))

      const offer = await pc.createOffer({ offerToReceiveVideo: true, offerToReceiveAudio: true })
      await pc.setLocalDescription(offer)
      addLog('Offer erstellt, sende...')

      socket.emit('webrtc_offer', {
        to:           targetUserId,
        offer:        pc.localDescription,
        conversationId,
        callerName:   user?.username || 'Unbekannt',
      })
      addLog('Offer gesendet ✓')
    } catch (e: any) {
      addLog(`FEHLER: ${e.message}`)
      setError(e.name === 'NotReadableError' ? 'Kamera wird bereits verwendet (anderes Tab/App)' : e.message || 'Kamera/Mikrofon nicht verfügbar')
      setCallState('ended')
    }
  }, [videoOn, buildPC, socket, targetUserId, conversationId, user])

  // CALLEE: Anruf annehmen
  const acceptCall = useCallback(async () => {
    addLog('Anruf angenommen')
    setCallState('connecting')
    try {
      const s = await getStream(videoOn)
      streamRef.current = s
      if (localRef.current) localRef.current.srcObject = s

      const pc = buildPC()
      pcRef.current = pc
      s.getTracks().forEach(t => pc.addTrack(t, s))

      if (incomingOffer) {
        addLog('Setze Remote Description (offer)...')
        await pc.setRemoteDescription(new RTCSessionDescription(incomingOffer))
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        addLog('Sende Answer...')
        socket.emit('webrtc_answer', {
          to:           targetUserId,
          answer:       pc.localDescription,
          conversationId,
        })
        addLog('Answer gesendet ✓')
      } else {
        addLog('FEHLER: kein incomingOffer!')
        setError('Kein Angebot empfangen')
      }
    } catch (e: any) {
      addLog(`FEHLER acceptCall: ${e.message}`)
      setError(e.message)
    }
  }, [videoOn, buildPC, incomingOffer, socket, targetUserId, conversationId])

  const hangUp = useCallback(() => {
    addLog('Auflegen')
    socket.emit('webrtc_hangup', { to: targetUserId, conversationId })
    setCallState('ended')
    cleanup()
    setTimeout(onClose, 1500)
  }, [socket, targetUserId, conversationId, cleanup, onClose])

  // Socket Events
  useEffect(() => {
    addLog(`Init: isIncoming=${isIncoming}, target=${targetUserId}`)
    addLog(`incomingOffer: ${incomingOffer ? 'vorhanden' : 'FEHLT'}`)

    const onAnswer = async ({ answer, from }: any) => {
      addLog(`Answer von ${from}`)
      if (from !== targetUserId) { addLog(`Ignoriert (von ${from}, erwartet ${targetUserId})`); return }
      const pc = pcRef.current
      if (!pc) { addLog('FEHLER: kein PC!'); return }
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer))
        addLog('Remote Description (answer) gesetzt ✓')
      } catch (e: any) { addLog(`FEHLER setRemote: ${e.message}`) }
    }

    const onIce = async ({ candidate, from }: any) => {
      if (from !== targetUserId) return
      const pc = pcRef.current
      if (!pc || !candidate) return
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)) }
      catch (_e) {}
    }

    const onHangup = ({ from }: any) => {
      if (from !== targetUserId) return
      addLog('Gegenseite hat aufgelegt')
      setCallState('ended')
      cleanup()
      setTimeout(onClose, 1500)
    }

    socket.on('webrtc_answer',  onAnswer)
    socket.on('webrtc_ice',     onIce)
    socket.on('webrtc_hangup',  onHangup)

    if (!isIncoming) startCall()

    return () => {
      socket.off('webrtc_answer', onAnswer)
      socket.off('webrtc_ice',    onIce)
      socket.off('webrtc_hangup', onHangup)
      cleanup()
    }
  }, [])

  const toggleVideo = () => {
    const t = streamRef.current?.getVideoTracks()[0]
    if (t) { t.enabled = !videoOn; setVideoOn(v => !v) }
  }
  const toggleAudio = () => {
    const t = streamRef.current?.getAudioTracks()[0]
    if (t) { t.enabled = !audioOn; setAudioOn(a => !a) }
  }
  const fmt = (s: number) => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`

  return (
    <div style={{ position:'fixed', inset:0, background:'#070714', zIndex:1000, display:'flex', flexDirection:'column' }}>

      {/* Remote Video */}
      <div style={{ flex:1, position:'relative', overflow:'hidden' }}>
        <video ref={remoteRef} autoPlay playsInline
          style={{ width:'100%', height:'100%', objectFit:'cover', background:'#0a0a14' }} />

        {/* Lokales Video */}
        <div style={{ position:'absolute', top:'16px', right:'16px', width:'130px', height:'96px', borderRadius:'12px', overflow:'hidden', border:'2px solid rgba(255,255,255,0.3)', boxShadow:'0 4px 24px rgba(0,0,0,0.6)' }}>
          <video ref={localRef} autoPlay playsInline muted
            style={{ width:'100%', height:'100%', objectFit:'cover', transform:'scaleX(-1)', display: videoOn ? 'block' : 'none' }} />
          {!videoOn && <div style={{ width:'100%', height:'100%', background:'#1a1a2e', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'28px' }}>👤</div>}
        </div>

        {/* Status */}
        {callState !== 'connected' && (
          <div style={{ position:'absolute', inset:0, background:'rgba(7,7,20,0.85)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'12px' }}>
            <div style={{ width:'90px', height:'90px', borderRadius:'50%', background:'rgba(79,110,247,0.25)', border:'2px solid rgba(79,110,247,0.6)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'36px' }}>👤</div>
            <p style={{ fontWeight:700, fontSize:'22px', color:'white', margin:0 }}>{targetUsername}</p>
            <p style={{ color:'rgba(255,255,255,0.5)', fontSize:'14px', margin:0 }}>
              {callState === 'calling' ? '📞 Ruft an…' : callState === 'ringing' ? '📲 Eingehender Anruf' : callState === 'connecting' ? '🔗 Verbinde…' : '📵 Beendet'}
            </p>
            {error && <p style={{ color:'#f87171', fontSize:'12px', margin:0, maxWidth:'300px', textAlign:'center' }}>{error}</p>}


          </div>
        )}

        {callState === 'connected' && (
          <div style={{ position:'absolute', top:'16px', left:'16px', background:'rgba(0,0,0,0.6)', borderRadius:'99px', padding:'4px 14px', fontSize:'13px', color:'white', fontFamily:'monospace' }}>
            🔴 {fmt(duration)}
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{ padding:'28px', display:'flex', alignItems:'center', justifyContent:'center', gap:'20px', background:'rgba(7,7,20,0.95)' }}>
        {callState === 'ringing' ? (
          <>
            <div style={{ textAlign:'center' }}>
              <button onClick={acceptCall} style={{ width:'68px', height:'68px', borderRadius:'50%', background:'#16a34a', border:'none', cursor:'pointer', fontSize:'28px', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 8px', boxShadow:'0 0 24px rgba(22,163,74,0.6)' }}>📞</button>
              <span style={{ fontSize:'11px', color:'rgba(255,255,255,0.4)' }}>Annehmen</span>
            </div>
            <div style={{ textAlign:'center' }}>
              <button onClick={hangUp} style={{ width:'68px', height:'68px', borderRadius:'50%', background:'#dc2626', border:'none', cursor:'pointer', fontSize:'28px', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 8px', boxShadow:'0 0 24px rgba(220,38,38,0.6)' }}>📵</button>
              <span style={{ fontSize:'11px', color:'rgba(255,255,255,0.4)' }}>Ablehnen</span>
            </div>
          </>
        ) : (
          <>
            <div style={{ textAlign:'center' }}>
              <button onClick={toggleAudio} style={{ width:'54px', height:'54px', borderRadius:'50%', background: audioOn ? 'rgba(255,255,255,0.12)' : 'rgba(220,38,38,0.35)', border:'1px solid rgba(255,255,255,0.2)', cursor:'pointer', fontSize:'22px', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 8px' }}>
                {audioOn ? '🎤' : '🔇'}
              </button>
              <span style={{ fontSize:'11px', color:'rgba(255,255,255,0.4)' }}>Mikrofon</span>
            </div>
            <div style={{ textAlign:'center' }}>
              <button onClick={hangUp} style={{ width:'68px', height:'68px', borderRadius:'50%', background:'#dc2626', border:'none', cursor:'pointer', fontSize:'28px', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 8px', boxShadow:'0 0 28px rgba(220,38,38,0.7)' }}>📵</button>
              <span style={{ fontSize:'11px', color:'rgba(255,255,255,0.4)' }}>Auflegen</span>
            </div>
            <div style={{ textAlign:'center' }}>
              <button onClick={toggleVideo} style={{ width:'54px', height:'54px', borderRadius:'50%', background: videoOn ? 'rgba(255,255,255,0.12)' : 'rgba(220,38,38,0.35)', border:'1px solid rgba(255,255,255,0.2)', cursor:'pointer', fontSize:'22px', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 8px' }}>
                {videoOn ? '📹' : '🚫'}
              </button>
              <span style={{ fontSize:'11px', color:'rgba(255,255,255,0.4)' }}>Kamera</span>
            </div>
          </>
        )}
      </div>

      <style>{`@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(79,110,247,.4)}50%{box-shadow:0 0 0 20px rgba(79,110,247,0)}}`}</style>
    </div>
  )
}