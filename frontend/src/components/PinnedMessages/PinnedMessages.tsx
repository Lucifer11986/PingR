import { useEffect, useState } from 'react'
import api from '../../services/api'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'

interface PinnedMsg {
  _id: string; content: string; type: string
  sender: { username: string }; createdAt: string
}
interface Props { conversationId: string; onJumpTo: (id: string) => void; onClose: () => void }

export default function PinnedMessages({ conversationId, onJumpTo, onClose }: Props) {
  const [pins, setPins]       = useState<PinnedMsg[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/api/conversations/${conversationId}/pins`)
      .then(r => setPins(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [conversationId])

  const unpin = async (e: React.MouseEvent, msgId: string) => {
    e.stopPropagation()
    await api.post(`/api/conversations/${conversationId}/pin/${msgId}`)
    setPins(p => p.filter(m => m._id !== msgId))
  }

  return (
    <div style={{ position:'absolute', top:'52px', left:0, right:0, background:'#13131f', borderBottom:'1px solid rgba(255,255,255,0.1)', zIndex:20, maxHeight:'280px', overflowY:'auto', boxShadow:'0 8px 24px rgba(0,0,0,0.4)' }}>
      <div style={{ padding:'10px 16px', borderBottom:'1px solid rgba(255,255,255,0.08)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <span style={{ fontWeight:600, fontSize:'13px' }}>📌 Angepinnte Nachrichten ({pins.length}/5)</span>
        <button onClick={onClose} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer', fontSize:'18px' }}>✕</button>
      </div>
      {loading && <div style={{ padding:'20px', textAlign:'center', color:'rgba(255,255,255,0.3)', fontSize:'12px' }}>Lade…</div>}
      {!loading && !pins.length && <div style={{ padding:'24px', textAlign:'center', color:'rgba(255,255,255,0.3)', fontSize:'12px' }}>Keine angepinnten Nachrichten</div>}
      {pins.map((msg, i) => (
        <div key={msg._id}
          onClick={() => { onJumpTo(msg._id); onClose() }}
          style={{ padding:'10px 16px', borderBottom: i < pins.length-1 ? '1px solid rgba(255,255,255,0.05)' : 'none', display:'flex', alignItems:'flex-start', gap:'10px', cursor:'pointer' }}>
          <span style={{ fontSize:'14px', flexShrink:0, marginTop:'2px' }}>📌</span>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'3px' }}>
              <span style={{ fontSize:'11px', fontWeight:600, color:'#60a5fa' }}>{msg.sender?.username}</span>
              <span style={{ fontSize:'10px', color:'rgba(255,255,255,0.3)' }}>
                {format(new Date(msg.createdAt), 'dd.MM.yy HH:mm', { locale: de })}
              </span>
            </div>
            <p style={{ fontSize:'12px', color:'rgba(255,255,255,0.7)', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {msg.type === 'voice' ? '🎤 Sprachnachricht' : msg.type === 'file' ? '📎 Datei' : msg.content}
            </p>
          </div>
          <button onClick={e => unpin(e, msg._id)}
            style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'6px', color:'rgba(255,255,255,0.4)', cursor:'pointer', padding:'3px 8px', fontSize:'11px', flexShrink:0 }}
            title="Loslösen">✕</button>
        </div>
      ))}
    </div>
  )
}