import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { formatDistanceToNow } from 'date-fns'
import { de } from 'date-fns/locale'
import { useAuthStore } from '../../store/authStore'
import { useChatStore } from '../../store/chatStore'
import api from '../../services/api'

interface ProfileData {
  _id: string; uin: string; username: string; avatar?: string; bio?: string
  status: 'online' | 'away' | 'offline'; statusMessage?: string
  lastSeen?: string; createdAt: string
  sharedGroups: { _id: string; groupName: string; participants: unknown[] }[]
  showLastSeen: boolean; showStatus: boolean
}

interface Props { userId: string; onClose: () => void }

export default function UserProfile({ userId, onClose }: Props) {
  const currentUser = useAuthStore(s => s.user)
  const { createConversation, setActiveConversation } = useChatStore()
  const [profile,      setProfile]      = useState<ProfileData | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState('')
  const [blocked,      setBlocked]      = useState(false)
  const [availability, setAvailability] = useState<{available:boolean;localTime?:string;timezone?:string;message?:string;availability:any}|null>(null)
  const [blockLoading, setBlockLoading] = useState(false)
  const apiBase = import.meta.env.VITE_API_URL || ''

  useEffect(() => {
    api.get(`/api/users/${userId}/availability`)
      .then(r => setAvailability(r.data))
      .catch(() => {})
  }, [userId])

  useEffect(() => {
    api.get(`/api/users/${userId}/profile`)
      .then(({ data }) => { setProfile(data); setLoading(false) })
      .catch(() => { setError('Profil konnte nicht geladen werden.'); setLoading(false) })
  }, [userId])

  const handleStartChat = async () => {
    const convId = await createConversation(userId)
    setActiveConversation(convId)
    onClose()
  }

  const handleBlock = async () => {
    setBlockLoading(true)
    try {
      if (blocked) {
        await api.delete(`/api/users/${userId}/block`)
        setBlocked(false)
      } else {
        if (!confirm(`${profile?.username} wirklich blockieren?`)) { setBlockLoading(false); return }
        await api.post(`/api/users/${userId}/block`)
        setBlocked(true)
      }
    } catch (_err) { alert('Fehler.') }
    finally { setBlockLoading(false) }
  }

  const statusColor = { online:'#4ade80', away:'#fbbf24', offline:'rgba(255,255,255,0.3)' }
  const statusText  = { online:'Online', away:'Abwesend', offline:'Offline' }

  const modal = (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', backdropFilter:'blur(8px)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
      onClick={onClose}>
      <div style={{ background:'#0d0f18', border:'1px solid rgba(255,255,255,0.08)', borderRadius:22, width:'100%', maxWidth:400, boxShadow:'0 32px 80px rgba(0,0,0,0.7)', overflow:'hidden' }}
        onClick={e => e.stopPropagation()}>

        {/* Loading */}
        {loading && (
          <div style={{ padding:48, textAlign:'center', color:'rgba(255,255,255,0.3)' }}>
            <div style={{ fontSize:36, marginBottom:12 }}>👤</div>
            <p style={{ fontSize:13 }}>Lade Profil…</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ padding:40, textAlign:'center' }}>
            <div style={{ fontSize:32, marginBottom:12 }}>😕</div>
            <p style={{ fontSize:13, color:'rgba(255,255,255,0.5)', marginBottom:16 }}>{error}</p>
            <button onClick={onClose} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer', fontSize:13 }}>Schließen</button>
          </div>
        )}

        {/* Profile */}
        {profile && !loading && (
          <>
            {/* Hero Banner */}
            <div style={{ position:'relative', height:90, background:'linear-gradient(135deg, rgba(180,106,14,0.25), rgba(74,26,107,0.25))', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
              {/* Close Button */}
              <button onClick={onClose} style={{ position:'absolute', top:12, right:12, background:'rgba(0,0,0,0.4)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'50%', width:30, height:30, display:'flex', alignItems:'center', justifyContent:'center', color:'rgba(255,255,255,0.6)', cursor:'pointer', fontSize:14 }}>✕</button>
              
              {/* Avatar */}
              <div style={{ position:'absolute', bottom:-28, left:20 }}>
                <div style={{ position:'relative' }}>
                  <div style={{ width:60, height:60, borderRadius:16, overflow:'hidden', background:'linear-gradient(135deg,#b46a0e,#e8b86d)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, fontWeight:700, color:'#fff', border:'3px solid #0d0f18', boxShadow:'0 4px 16px rgba(0,0,0,0.4)' }}>
                    {profile.avatar
                      ? <img src={`${apiBase}${profile.avatar}`} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                      : profile.username[0]?.toUpperCase()
                    }
                  </div>
                  {profile.showStatus && (
                    <span style={{ position:'absolute', bottom:2, right:2, width:13, height:13, borderRadius:'50%', background: statusColor[profile.status], border:'2px solid #0d0f18' }} />
                  )}
                </div>
              </div>
            </div>

            {/* Content */}
            <div style={{ padding:'36px 20px 20px', display:'flex', flexDirection:'column', gap:14 }}>

              {/* Name + Status */}
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <h2 style={{ fontSize:18, fontWeight:700, color:'rgba(255,255,255,0.92)' }}>{profile.username}</h2>
                  {profile.showStatus && (
                    <span style={{ fontSize:11, color: statusColor[profile.status], display:'flex', alignItems:'center', gap:4 }}>
                      <span style={{ width:6, height:6, borderRadius:'50%', background: statusColor[profile.status], display:'inline-block' }} />
                      {statusText[profile.status]}
                    </span>
                  )}
                </div>
                <p style={{ fontSize:12, color:'#e8b86d', fontFamily:'monospace', opacity:0.7, marginTop:3 }}>#{profile.uin}</p>
                {profile.statusMessage && (
                  <p style={{ fontSize:12, color:'rgba(255,255,255,0.45)', marginTop:6, fontStyle:'italic' }}>„{profile.statusMessage}"</p>
                )}
              </div>

              {/* Bio */}
              {profile.bio && (
                <div style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:12, padding:'10px 14px' }}>
                  <p style={{ fontSize:10, color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:'0.08em', fontWeight:700, marginBottom:6 }}>Über mich</p>
                  <p style={{ fontSize:13, color:'rgba(255,255,255,0.75)', lineHeight:1.55 }}>{profile.bio}</p>
                </div>
              )}

              {/* Info-Zeilen */}
              <div style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:12, padding:'4px 14px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', padding:'9px 0', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize:12, color:'rgba(255,255,255,0.4)' }}>Mitglied seit</span>
                  <span style={{ fontSize:12, color:'rgba(255,255,255,0.7)' }}>
                    {formatDistanceToNow(new Date(profile.createdAt), { locale: de, addSuffix: true })}
                  </span>
                </div>
                {/* Zeitzone */}
              {availability?.timezone && (
                <div style={{ display:'flex', justifyContent:'space-between', padding:'9px 0', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize:12, color:'rgba(255,255,255,0.4)' }}>🌍 Lokale Zeit</span>
                  <span style={{ fontSize:12, color: availability.available ? '#4ade80' : 'rgba(255,255,255,0.7)' }}>
                    {availability.localTime} <span style={{ color:'rgba(255,255,255,0.3)', fontSize:11 }}>({availability.timezone?.split('/')[1]?.replace('_',' ')})</span>
                  </span>
                </div>
              )}
              {/* Verfügbarkeit */}
              {availability?.availability?.enabled && (
                <div style={{ display:'flex', justifyContent:'space-between', padding:'9px 0', borderBottom:'1px solid rgba(255,255,255,0.05)', alignItems:'center' }}>
                  <span style={{ fontSize:12, color:'rgba(255,255,255,0.4)' }}>🕐 Erreichbar</span>
                  <span style={{ fontSize:12, display:'flex', alignItems:'center', gap:5 }}>
                    <span style={{ width:7, height:7, borderRadius:'50%', background: availability.available ? '#4ade80' : '#f87171', display:'inline-block' }} />
                    <span style={{ color: availability.available ? '#4ade80' : '#f87171' }}>
                      {availability.available ? 'Gerade erreichbar' : 'Gerade nicht erreichbar'}
                    </span>
                  </span>
                </div>
              )}
              {!availability?.available && availability?.message && (
                <div style={{ padding:'8px 0', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
                  <p style={{ fontSize:12, color:'rgba(255,255,255,0.45)', fontStyle:'italic' }}>💬 {availability.message}</p>
                </div>
              )}
              {profile.showLastSeen && profile.lastSeen && profile.status !== 'online' && (
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'9px 0' }}>
                    <span style={{ fontSize:12, color:'rgba(255,255,255,0.4)' }}>Zuletzt online</span>
                    <span style={{ fontSize:12, color:'rgba(255,255,255,0.7)' }}>
                      {formatDistanceToNow(new Date(profile.lastSeen), { locale: de, addSuffix: true })}
                    </span>
                  </div>
                )}
              </div>

              {/* Gemeinsame Gruppen */}
              {profile.sharedGroups.length > 0 && (
                <div>
                  <p style={{ fontSize:10, color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:'0.08em', fontWeight:700, marginBottom:8 }}>
                    Gemeinsame Gruppen ({profile.sharedGroups.length})
                  </p>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {profile.sharedGroups.map(g => (
                      <div key={g._id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:10 }}>
                        <div style={{ width:28, height:28, borderRadius:8, background:'linear-gradient(135deg,#4a1a6b,#b46a0e)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'#fff', flexShrink:0 }}>
                          {(g.groupName || 'G')[0].toUpperCase()}
                        </div>
                        <span style={{ fontSize:13, fontWeight:500, flex:1 }}>{g.groupName}</span>
                        <span style={{ fontSize:11, color:'rgba(255,255,255,0.3)' }}>{(g.participants as unknown[]).length} Mitgl.</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Aktionen */}
              {currentUser?._id !== userId && (
                <div style={{ display:'flex', gap:8, paddingTop:4 }}>
                  <button onClick={handleStartChat} style={{ flex:1, padding:'11px', background:'linear-gradient(135deg,#b46a0e,#e8b86d)', border:'none', borderRadius:11, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', boxShadow:'0 4px 16px rgba(232,184,109,0.2)' }}>
                    💬 Nachricht
                  </button>
                  <button onClick={handleBlock} disabled={blockLoading} style={{ padding:'11px 16px', borderRadius:11, fontSize:13, fontWeight:600, cursor:'pointer', border: blocked ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(239,68,68,0.2)', background: blocked ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.08)', color: blocked ? '#4ade80' : '#f87171' }}>
                    {blockLoading ? '…' : blocked ? '✓ Entsperren' : '🚫 Blockieren'}
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}