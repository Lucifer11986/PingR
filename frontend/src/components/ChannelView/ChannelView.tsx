import { useState, useEffect, useRef } from 'react'
import { useAuthStore } from '../../store/authStore'
import api from '../../services/api'

interface Props {
  channelId: string
  channel:   any
}

interface Msg {
  _id:       string
  content:   string
  type:      string
  sender:    { _id: string; username: string; avatar?: string }
  createdAt: string
  fileUrl?:  string
}

const ChannelIcon = () => (
  <svg width="18" height="18" fill="none" stroke="white" strokeWidth="1.8" viewBox="0 0 24 24">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.47 2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.57a16 16 0 0 0 6 6l.72-.94a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.27 16z"/>
  </svg>
)

export default function ChannelView({ channelId, channel }: Props) {
  const user    = useAuthStore(s => s.user)
  const apiBase = import.meta.env.VITE_API_URL || ''

  const [msgs,       setMsgs]       = useState<Msg[]>([])
  const [input,      setInput]      = useState('')
  const [loading,    setLoading]    = useState(true)
  const [sending,    setSending]    = useState(false)
  const [subscribed,  setSubscribed]  = useState(false)
  const [subCount,    setSubCount]    = useState(0)
  const [showEdit,    setShowEdit]    = useState(false)
  const [editName,    setEditName]    = useState('')
  const [editDesc,    setEditDesc]    = useState('')
  const [editIsAdult, setEditIsAdult] = useState(false)
  const [editIsPublic,setEditIsPublic]= useState(true)
  const [editSaving,  setEditSaving]  = useState(false)
  const [reactions,   setReactions]   = useState<Record<string, { emoji: string; count: number; reacted: boolean }[]>>({})
  const bottomRef = useRef<HTMLDivElement>(null)

  const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '🔥', '👏']

  const addReaction = async (msgId: string, emoji: string) => {
    try {
      await api.post(`/api/channels/${channelId}/messages/${msgId}/react`, { emoji })
      setReactions(prev => {
        const msgReactions = [...(prev[msgId] || [])]
        const existing = msgReactions.find(r => r.emoji === emoji)
        if (existing) {
          existing.count += existing.reacted ? -1 : 1
          existing.reacted = !existing.reacted
        } else {
          msgReactions.push({ emoji, count: 1, reacted: true })
        }
        return { ...prev, [msgId]: msgReactions.filter(r => r.count > 0) }
      })
    } catch {}
  }

  const isAdmin = !!(user && (
    channel.owner === user._id ||
    channel.owner?._id === user._id ||
    (channel.admins || []).some((a: any) => a === user._id || a?._id === user._id)
  ))

  useEffect(() => {
    setSubscribed((channel.subscribers || []).some(
      (s: any) => s === user?._id || s?._id === user?._id
    ))
    setSubCount(channel.subscriberCount || channel.subscribers?.length || 0)
    loadMessages()
    api.post(`/api/channels/${channelId}/mark-read`).catch(() => {})
  }, [channelId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs])

  const loadMessages = async () => {
    setLoading(true)
    try {
      const { data } = await api.get(`/api/channels/${channelId}/messages`)
      setMsgs(data)
    } catch (_e) {}
    setLoading(false)
  }

  const send = async () => {
    if (!input.trim() || !isAdmin || sending) return
    setSending(true)
    try {
      const { data } = await api.post(`/api/channels/${channelId}/messages`, { content: input.trim() })
      setMsgs(prev => [...prev, data])
      setInput('')
    } catch (_e) {}
    setSending(false)
  }

  const toggleSubscribe = async () => {
    try {
      const { data } = await api.post(`/api/channels/${channelId}/subscribe`)
      setSubscribed(data.subscribed)
      setSubCount(data.subscriberCount)
    } catch (_e) {}
  }

  const formatTime = (date: string) =>
    new Date(date).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })

  const formatDate = (date: string) => {
    const d = new Date(date)
    const now = new Date()
    if (d.toDateString() === now.toDateString()) return 'Heute'
    const y = new Date(now); y.setDate(now.getDate() - 1)
    if (d.toDateString() === y.toDateString()) return 'Gestern'
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'long' })
  }

  let lastDate = ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, width: '100%', height: '100%', background: '#08090f', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0, background: '#0d0f18' }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg,#1e40af,#7c3aed)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {channel.groupAvatar
            ? <img src={`${apiBase}${channel.groupAvatar}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
            : <ChannelIcon />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{channel.groupName}</span>
            {channel.verified && <span style={{ color: '#60a5fa', fontSize: 13, fontWeight: 700 }}>&#10003;</span>}
            {(channel as any).isAdult && (
              <span style={{ fontSize: 9, background: 'rgba(239,68,68,0.2)', color: '#f87171', padding: '0 4px', borderRadius: 3, fontWeight: 700 }}>18+</span>
            )}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
            @{channel.channelHandle} &middot; {subCount.toLocaleString()} Abonnenten
          </div>
        </div>
        <div style={{ display:'flex', gap:8, flexShrink:0 }}>
          {isAdmin && (
            <button onClick={() => {
              setEditName(channel.groupName || '')
              setEditDesc(channel.description || '')
              setEditIsAdult(!!(channel as any).isAdult)
              setEditIsPublic((channel as any).isPublic !== false)
              setShowEdit(true)
            }} style={{ padding:'7px 14px', borderRadius:10, cursor:'pointer', fontWeight:600, fontSize:12, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.7)', display:'flex', alignItems:'center', gap:5 }}>
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Bearbeiten
            </button>
          )}
          {user && channel.owner !== user._id && channel.owner?._id !== user._id && (
            <button onClick={toggleSubscribe} style={{
              padding: '7px 18px', borderRadius: 10, cursor: 'pointer',
              fontWeight: 600, fontSize: 13, border: 'none', transition: 'all .15s',
              background: subscribed ? 'rgba(255,255,255,0.07)' : 'linear-gradient(135deg,#1e40af,#7c3aed)',
              color: subscribed ? 'rgba(255,255,255,0.5)' : '#fff',
            }}>
              {subscribed ? 'Abonniert ✓' : 'Abonnieren'}
            </button>
          )}
        </div>
      </div>

      {/* Beschreibung */}
      {channel.description && (
        <div style={{ padding: '9px 20px', background: 'rgba(59,130,246,0.05)', borderBottom: '1px solid rgba(59,130,246,0.1)', fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6, flexShrink: 0 }}>
          {channel.description}
        </div>
      )}

      {/* Nachrichten */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
            <div style={{ width: 28, height: 28, border: '2px solid rgba(59,130,246,0.3)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            Lade Nachrichten...
          </div>
        ) : msgs.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 300, color: 'rgba(255,255,255,0.25)', textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ width: 60, height: 60, borderRadius: 18, background: 'rgba(30,64,175,0.12)', border: '1px solid rgba(30,64,175,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <ChannelIcon />
            </div>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Noch keine Beiträge</p>
            <p style={{ fontSize: 12 }}>
              {isAdmin ? 'Schreibe den ersten Beitrag!' : 'Folge diesem Channel für neue Beiträge.'}
            </p>
          </div>
        ) : msgs.map(msg => {
          const dateStr  = formatDate(msg.createdAt)
          const showDate = dateStr !== lastDate
          lastDate = dateStr
          return (
            <div key={msg._id}>
              {showDate && (
                <div style={{ textAlign: 'center', margin: '12px 0 8px' }}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.04)', padding: '3px 14px', borderRadius: 99, border: '1px solid rgba(255,255,255,0.06)' }}>
                    {dateStr}
                  </span>
                </div>
              )}
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: '14px 16px', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(135deg,#1e40af,#7c3aed)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                    {msg.sender?.avatar
                      ? <img src={`${apiBase}${msg.sender.avatar}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                      : (msg.sender?.username?.[0] || '?').toUpperCase()}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#60a5fa' }}>{channel.groupName}</span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginLeft: 'auto' }}>{formatTime(msg.createdAt)}</span>
                </div>
                {msg.type === 'image' && msg.fileUrl ? (
                  <img src={`${apiBase}${msg.fileUrl}`} style={{ maxWidth: '100%', borderRadius: 10, maxHeight: 400, objectFit: 'contain' }} alt="" />
                ) : (
                  <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.88)', lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>
                    {msg.content}
                  </p>
                )}
                {/* Reaktionen */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 8, flexWrap: 'wrap' }}>
                  {(reactions[msg._id] || []).map(r => (
                    <button key={r.emoji} onClick={() => addReaction(msg._id, r.emoji)} style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 9px', borderRadius:99, border:`1px solid ${r.reacted ? 'rgba(232,184,109,0.4)' : 'rgba(255,255,255,0.1)'}`, background: r.reacted ? 'rgba(232,184,109,0.1)' : 'rgba(255,255,255,0.04)', cursor:'pointer', fontSize:13, transition:'all .15s' }}>
                      <span>{r.emoji}</span>
                      <span style={{ fontSize:11, color: r.reacted ? '#e8b86d' : 'rgba(255,255,255,0.4)', fontWeight:600 }}>{r.count}</span>
                    </button>
                  ))}
                  <div style={{ position:'relative' }}>
                    <button style={{ padding:'3px 8px', borderRadius:99, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.03)', cursor:'pointer', color:'rgba(255,255,255,0.3)', lineHeight:1, fontSize:14 }}
                      onClick={e => {
                        const picker = (e.currentTarget as HTMLElement).nextElementSibling as HTMLElement
                        if (picker) picker.style.display = picker.style.display === 'flex' ? 'none' : 'flex'
                      }}>
                      <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M8 13s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
                    </button>
                    <div style={{ display:'none', position:'absolute', bottom:'110%', left:0, background:'#0d0f18', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:'6px 8px', flexDirection:'row', gap:3, zIndex:99, boxShadow:'0 8px 24px rgba(0,0,0,0.5)' }}>
                      {REACTION_EMOJIS.map(em => (
                        <button key={em} onClick={() => { addReaction(msg._id, em); const d = document.activeElement as HTMLElement; d?.blur?.() }} style={{ width:30, height:30, borderRadius:7, border:'none', background:'none', cursor:'pointer', fontSize:17, display:'flex', alignItems:'center', justifyContent:'center' }}>
                          {em}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {isAdmin ? (
        <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.07)', background: '#0d0f18', display: 'flex', gap: 10, flexShrink: 0 }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Beitrag schreiben… (Enter senden, Shift+Enter neue Zeile)"
            rows={2}
            style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: '#fff', outline: 'none', resize: 'none', lineHeight: 1.5 }}
          />
          <button onClick={send} disabled={!input.trim() || sending} style={{
            padding: '10px 20px', borderRadius: 12, border: 'none', alignSelf: 'flex-end',
            background: input.trim() ? 'linear-gradient(135deg,#1e40af,#7c3aed)' : 'rgba(255,255,255,0.06)',
            color: input.trim() ? '#fff' : 'rgba(255,255,255,0.3)',
            cursor: input.trim() ? 'pointer' : 'not-allowed',
            fontWeight: 600, fontSize: 16, transition: 'all .15s',
          }}>
            {sending ? '…' : '›'}
          </button>
        </div>
      ) : (
        <div style={{ padding: '10px 20px', borderTop: '1px solid rgba(255,255,255,0.07)', background: '#0d0f18', textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>
          Nur Admins können in diesem Channel schreiben
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── Channel Bearbeiten Modal ── */}
      {showEdit && (
        <div onClick={() => setShowEdit(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', backdropFilter:'blur(8px)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background:'#0d0f18', border:'1px solid rgba(255,255,255,0.08)', borderRadius:20, padding:24, maxWidth:440, width:'100%', boxShadow:'0 24px 60px rgba(0,0,0,0.7)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h2 style={{ fontSize:17, fontWeight:800, color:'#fff' }}>Channel bearbeiten</h2>
              <button onClick={() => setShowEdit(false)} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer', fontSize:22 }}>x</button>
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:600, color:'rgba(255,255,255,0.4)', marginBottom:5, textTransform:'uppercase' as const, letterSpacing:'0.05em' }}>Name</label>
              <input value={editName} onChange={e => setEditName(e.target.value)} style={{ width:'100%', padding:'9px 13px', borderRadius:9, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'#fff', fontSize:13, outline:'none', boxSizing:'border-box' as const }} />
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:600, color:'rgba(255,255,255,0.4)', marginBottom:5, textTransform:'uppercase' as const, letterSpacing:'0.05em' }}>Beschreibung</label>
              <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={3} maxLength={300} style={{ width:'100%', padding:'9px 13px', borderRadius:9, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'#fff', fontSize:13, outline:'none', resize:'none' as const, boxSizing:'border-box' as const, lineHeight:1.5 }} />
            </div>
            <div style={{ display:'flex', gap:8, marginBottom:14 }}>
              {[{v:true,l:'Oeffentlich'},{v:false,l:'Privat'}].map(opt => (
                <button key={String(opt.v)} onClick={() => setEditIsPublic(opt.v)} style={{ flex:1, padding:'9px', borderRadius:9, cursor:'pointer', background: editIsPublic===opt.v ? 'rgba(30,64,175,0.15)' : 'rgba(255,255,255,0.04)', border:`1px solid ${editIsPublic===opt.v ? 'rgba(30,64,175,0.4)' : 'rgba(255,255,255,0.08)'}`, color: editIsPublic===opt.v ? '#93c5fd' : 'rgba(255,255,255,0.5)', fontSize:12, fontWeight:600 }}>{opt.l}</button>
              ))}
            </div>
            <label style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:10, cursor:'pointer', background: editIsAdult ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)', border:`1px solid ${editIsAdult ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.07)'}`, marginBottom:20, transition:'all .15s' }}>
              <input type="checkbox" checked={editIsAdult} onChange={e => setEditIsAdult(e.target.checked)} style={{ width:16, height:16, accentColor:'#ef4444', cursor:'pointer' }} />
              <div>
                <div style={{ fontSize:13, fontWeight:700, color: editIsAdult ? '#f87171' : 'rgba(255,255,255,0.8)' }}>FSK18 / Nur fuer Erwachsene</div>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.35)', marginTop:2 }}>Channel wird mit 18+ Badge markiert</div>
              </div>
            </label>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setShowEdit(false)} style={{ flex:1, padding:'10px', borderRadius:9, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.6)', cursor:'pointer' }}>Abbrechen</button>
              <button disabled={editSaving || !editName.trim()} onClick={async () => {
                setEditSaving(true)
                try {
                  await api.patch('/api/channels/' + channelId, { name: editName.trim(), description: editDesc.trim(), isPublic: editIsPublic, isAdult: editIsAdult })
                  setShowEdit(false)
                  // Channel-Daten aktualisieren
                  channel.groupName   = editName.trim()
                  channel.description = editDesc.trim()
                  ;(channel as any).isPublic = editIsPublic
                  ;(channel as any).isAdult  = editIsAdult
                } catch {}
                setEditSaving(false)
              }} style={{ flex:2, padding:'10px', borderRadius:9, border:'none', background: editName.trim() ? 'linear-gradient(135deg,#1e40af,#7c3aed)' : 'rgba(255,255,255,0.06)', color: editName.trim() ? '#fff' : 'rgba(255,255,255,0.3)', cursor: editName.trim() ? 'pointer' : 'not-allowed', fontWeight:700, opacity: editSaving ? 0.7 : 1 }}>
                {editSaving ? 'Speichert...' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}