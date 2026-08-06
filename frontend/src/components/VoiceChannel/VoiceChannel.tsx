// /opt/pingr/frontend/src/components/VoiceChannel/VoiceChannel.tsx
import { useState } from 'react'
import { useVoiceChannel, VoicePeer } from '../../hooks/useVoiceChannel'
import { useAuthStore } from '../../store/authStore'

interface Props {
  conversationId: string
  groupName:      string
}

export default function VoiceChannel({ conversationId, groupName }: Props) {
  const user                                       = useAuthStore(s => s.user)
  const { peers, joined, isMuted, error, join, leave, toggleMute } = useVoiceChannel(conversationId)
  const [expanded, setExpanded]                    = useState(false)

  // ── Kleiner Bubble wenn nicht beigetreten ────────────────────────────────
  if (!joined) {
    return (
      <div style={{ padding:'6px 12px', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {/* Voice Channel Indikator */}
          <div style={{ display:'flex', alignItems:'center', gap:6, flex:1 }}>
            <span style={{ fontSize:13, color:'rgba(255,255,255,0.3)' }}>🔊</span>
            <span style={{ fontSize:11, color:'rgba(255,255,255,0.25)', fontWeight:600, letterSpacing:'0.05em', textTransform:'uppercase' }}>Voice</span>
            {peers.length > 0 && (
              <span style={{ fontSize:10, color:'#4ade80', fontWeight:600 }}>● {peers.length} aktiv</span>
            )}
          </div>

          {/* Join Button */}
          <button onClick={join}
            style={{ padding:'5px 14px', borderRadius:8, border:'none', cursor:'pointer', fontSize:12, fontWeight:700, background:'linear-gradient(135deg,#166534,#22c55e)', color:'#fff', letterSpacing:'0.03em' }}>
            Beitreten
          </button>
        </div>

        {/* Aktive Peers anzeigen wenn vorhanden */}
        {peers.length > 0 && (
          <div style={{ display:'flex', gap:4, marginTop:6, flexWrap:'wrap' }}>
            {peers.map(p => (
              <PeerBadge key={p.socketId} peer={p} small />
            ))}
          </div>
        )}

        {error && (
          <div style={{ fontSize:11, color:'#f87171', marginTop:4 }}>⚠️ {error}</div>
        )}
      </div>
    )
  }

  // ── Aktives Voice Panel ────────────────────────────────────────────────────
  return (
    <div style={{ background:'rgba(34,197,94,0.05)', borderBottom:'1px solid rgba(34,197,94,0.15)', padding:'8px 12px' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom: expanded ? 10 : 0 }}>
        {/* Grüner Puls */}
        <div style={{ position:'relative', width:10, height:10, flexShrink:0 }}>
          <div style={{ position:'absolute', inset:0, borderRadius:'50%', background:'#22c55e', animation:'pulse 2s infinite' }} />
          <div style={{ width:10, height:10, borderRadius:'50%', background:'#22c55e' }} />
        </div>

        <span style={{ fontSize:11, color:'#4ade80', fontWeight:700, letterSpacing:'0.05em', textTransform:'uppercase', flex:1 }}>
          Voice aktiv — {peers.length} {peers.length === 1 ? 'Teilnehmer' : 'Teilnehmer'}
        </span>

        {/* Toggle expand */}
        <button onClick={() => setExpanded(e => !e)}
          style={{ background:'none', border:'none', color:'rgba(255,255,255,0.3)', cursor:'pointer', fontSize:14, padding:'2px 6px' }}>
          {expanded ? '▲' : '▼'}
        </button>
      </div>

      {/* Peers + Controls */}
      {expanded && (
        <>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:10 }}>
            {peers.map(p => (
              <PeerBadge key={p.socketId} peer={p} isMe={p.userId === user?._id} />
            ))}
          </div>
        </>
      )}

      {/* Immer sichtbare Controls */}
      <div style={{ display:'flex', gap:6 }}>
        {/* Mute Toggle */}
        <button onClick={toggleMute}
          style={{
            flex:1, padding:'7px', borderRadius:9, border:'none', cursor:'pointer', fontSize:12, fontWeight:700,
            background: isMuted ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.12)',
            color:      isMuted ? '#f87171' : '#4ade80',
          }}>
          {isMuted ? '🔇 Stumm' : '🎤 Aktiv'}
        </button>

        {/* Leave Button */}
        <button onClick={leave}
          style={{ padding:'7px 16px', borderRadius:9, border:'none', cursor:'pointer', fontSize:12, fontWeight:700, background:'rgba(239,68,68,0.12)', color:'#f87171' }}>
          📵 Verlassen
        </button>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(2.5); opacity: 0; }
        }
      `}</style>
    </div>
  )
}

// ── Peer Badge ────────────────────────────────────────────────────────────────
function PeerBadge({ peer, isMe, small }: { peer: VoicePeer; isMe?: boolean; small?: boolean }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap: small ? 4 : 6,
      padding: small ? '3px 8px' : '5px 10px',
      borderRadius:20,
      background: isMe ? 'rgba(232,184,109,0.1)' : 'rgba(255,255,255,0.05)',
      border: isMe ? '1px solid rgba(232,184,109,0.2)' : '1px solid rgba(255,255,255,0.07)',
    }}>
      {/* Mute Indikator */}
      <span style={{ fontSize: small ? 9 : 11 }}>
        {peer.isMuted ? '🔇' : peer.hasAudio ? '🎤' : '⏳'}
      </span>
      <span style={{ fontSize: small ? 10 : 12, color: isMe ? '#e8b86d' : 'rgba(255,255,255,0.7)', fontWeight:600 }}>
        {peer.username}{isMe ? ' (du)' : ''}
      </span>
    </div>
  )
}