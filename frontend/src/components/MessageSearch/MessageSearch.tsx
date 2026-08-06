import { useState, useRef } from 'react'
import api from '../../services/api'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'

interface SearchResult {
  _id: string; content: string; type: string
  sender: { username: string }; createdAt: string
  conversationId: string
}
interface Props { conversationId?: string; onJumpTo?: (msgId: string, convId: string) => void; onClose: () => void }

export default function MessageSearch({ conversationId, onJumpTo, onClose }: Props) {
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>()

  const search = async (q: string) => {
    if (q.length < 2) { setResults([]); return }
    setLoading(true)
    try {
      const url = conversationId
        ? `/api/messages/search?q=${encodeURIComponent(q)}&convId=${conversationId}`
        : `/api/messages/search?q=${encodeURIComponent(q)}`
      const { data } = await api.get(url)
      setResults(data || [])
    } catch (_e) { setResults([]) }
    finally { setLoading(false) }
  }

  const handleInput = (q: string) => {
    setQuery(q)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => search(q), 400)
  }

  // Text mit Highlight
  const highlight = (text: string, q: string) => {
    if (!q) return text
    const parts = text.split(new RegExp(`(${q})`, 'gi'))
    return parts.map((p, i) =>
      p.toLowerCase() === q.toLowerCase()
        ? <mark key={i} style={{ background:'rgba(250,204,21,0.3)', color:'#fde047', borderRadius:'2px' }}>{p}</mark>
        : p
    )
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:100, display:'flex', alignItems:'flex-start', justifyContent:'center', paddingTop:'80px' }}
      onClick={onClose}>
      <div style={{ background:'#13131f', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'16px', width:'100%', maxWidth:'560px', overflow:'hidden', boxShadow:'0 24px 64px rgba(0,0,0,0.6)', maxHeight:'80vh', display:'flex', flexDirection:'column' }}
        onClick={e => e.stopPropagation()}>

        {/* Suchfeld */}
        <div style={{ padding:'16px', borderBottom:'1px solid rgba(255,255,255,0.08)', display:'flex', gap:'10px', alignItems:'center' }}>
          <span style={{ fontSize:'18px' }}>🔍</span>
          <input
            value={query} onChange={e => handleInput(e.target.value)}
            placeholder={conversationId ? 'In diesem Chat suchen…' : 'In allen Chats suchen…'}
            autoFocus
            style={{ flex:1, background:'none', border:'none', outline:'none', color:'white', fontSize:'15px' }}
          />
          {loading && <span style={{ fontSize:'12px', color:'rgba(255,255,255,0.3)' }}>suche…</span>}
          <button onClick={onClose} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer', fontSize:'18px' }}>✕</button>
        </div>

        {/* Ergebnisse */}
        <div style={{ overflowY:'auto', flex:1 }}>
          {query.length > 0 && query.length < 2 && (
            <div style={{ padding:'24px', textAlign:'center', color:'rgba(255,255,255,0.3)', fontSize:'12px' }}>Mindestens 2 Zeichen eingeben</div>
          )}
          {!loading && query.length >= 2 && results.length === 0 && (
            <div style={{ padding:'24px', textAlign:'center', color:'rgba(255,255,255,0.3)', fontSize:'12px' }}>Keine Ergebnisse für „{query}"</div>
          )}
          {results.map(msg => (
            <div key={msg._id}
              onClick={() => onJumpTo?.(msg._id, msg.conversationId)}
              style={{ padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.05)', cursor:'pointer', display:'flex', gap:'10px', alignItems:'flex-start', transition:'background 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
                  <span style={{ fontSize:'12px', fontWeight:600, color:'#60a5fa' }}>{msg.sender?.username}</span>
                  <span style={{ fontSize:'10px', color:'rgba(255,255,255,0.3)' }}>
                    {format(new Date(msg.createdAt), 'dd.MM.yy HH:mm', { locale: de })}
                  </span>
                </div>
                <p style={{ fontSize:'13px', color:'rgba(255,255,255,0.8)', margin:0, lineHeight:1.5 }}>
                  {highlight(msg.content || '', query)}
                </p>
              </div>
            </div>
          ))}
          {results.length > 0 && (
            <div style={{ padding:'10px 16px', textAlign:'center', fontSize:'11px', color:'rgba(255,255,255,0.2)' }}>
              {results.length} Ergebnis{results.length !== 1 ? 'se' : ''}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}