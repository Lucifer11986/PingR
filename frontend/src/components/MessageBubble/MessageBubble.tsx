import { useRef, useState } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import { de } from 'date-fns/locale'
import { useAuthStore } from '../../store/authStore'
import { useChatStore } from '../../store/chatStore'
import api from '../../services/api'
import LinkPreview from '../LinkPreview/LinkPreview'
import { parseMarkdown, extractUrls } from '../../utils/markdown'
import type { Message } from '../../types'

interface Props {
  message:      Message
  isOwn:        boolean
  showAvatar:   boolean
  isLastInGroup?: boolean
  isFirstInGroup?: boolean
  onReply:      (msg: Message) => void
  onForward:    (msg: Message) => void
}

function VoicePlayer({ url, duration, isOwn }: { url: string; duration?: number; isOwn?: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing,  setPlaying]  = useState(false)
  const [current,  setCurrent]  = useState(0)
  const [speed,    setSpeed]    = useState(1)
  const [realDur,  setRealDur]  = useState(0)
  const total = realDur || duration || 0
  const fmt   = (s: number) => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`
  const pct   = total > 0 ? current / total : 0
  const toggle = () => {
    const a = audioRef.current; if (!a) return
    if (playing) { a.pause() } else { a.playbackRate = speed; a.play() }
    setPlaying(p => !p)
  }
  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current; if (!a || !total) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    a.currentTime = ratio * total; setCurrent(a.currentTime)
  }
  const cycleSpeed = () => {
    const a = audioRef.current
    const next = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1
    setSpeed(next); if (a) a.playbackRate = next
  }
  const bars = Array.from({ length: 28 }, (_, i) => {
    const seed = (url.length * 3 + i * 7) % 100
    return 3 + Math.abs(Math.sin(seed * 0.4) * 10 + Math.cos(seed * 0.7) * 5)
  })
  const accent = isOwn ? 'rgba(255,255,255,0.9)' : '#e8b86d'
  const dim    = isOwn ? 'rgba(255,255,255,0.25)' : 'rgba(232,184,109,0.3)'
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6, minWidth:200, maxWidth:260 }}>
      <audio ref={audioRef} src={url}
        onTimeUpdate={e => setCurrent((e.target as HTMLAudioElement).currentTime)}
        onLoadedMetadata={e => setRealDur((e.target as HTMLAudioElement).duration)}
        onEnded={() => { setPlaying(false); setCurrent(0) }} />
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <button onClick={toggle} style={{ width:34, height:34, borderRadius:'50%', background:isOwn?'rgba(255,255,255,0.2)':'rgba(232,184,109,0.2)', border:'none', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0, color:'white', fontSize:15 }}>
          {playing ? '⏸' : '▶'}
        </button>
        <div onClick={seek} style={{ flex:1, display:'flex', alignItems:'center', gap:1.5, height:28, cursor:'pointer' }}>
          {bars.map((h, i) => (
            <div key={i} style={{ height:`${i/bars.length<pct?Math.min(h*1.1,20):h}px`, width:3, borderRadius:2, flexShrink:0, background:i/bars.length<pct?accent:dim, transition:'height .08s ease' }} />
          ))}
        </div>
        <span style={{ fontSize:11, color:isOwn?'rgba(255,255,255,0.6)':'rgba(255,255,255,0.5)', flexShrink:0, fontFamily:'monospace', minWidth:34, textAlign:'right' }}>
          {playing ? fmt(current) : fmt(total)}
        </span>
      </div>
      <div style={{ display:'flex', justifyContent:'flex-end' }}>
        <button onClick={cycleSpeed} style={{ fontSize:10, padding:'2px 7px', borderRadius:5, background:speed!==1?'rgba(232,184,109,0.15)':'rgba(255,255,255,0.06)', border:speed!==1?'1px solid rgba(232,184,109,0.3)':'1px solid rgba(255,255,255,0.08)', color:speed!==1?'#e8b86d':'rgba(255,255,255,0.35)', cursor:'pointer', fontWeight:600 }}>
          {speed}x
        </button>
      </div>
    </div>
  )
}

// ── ViewOnce Image ────────────────────────────────────────────────────────────
function ViewOnceImage({ message, isOwn, apiBase }: { message: Message; isOwn: boolean; apiBase: string }) {
  const user = useAuthStore(s => s.user)
  const [viewed,    setViewed]    = useState(false)
  const [revealing, setRevealing] = useState(false)
  const viewedBy    = (message as any).viewedBy || []
  const alreadySeen = viewedBy.some((v: any) => v === user?._id || v?._id === user?._id)

  const handleView = async () => {
    if (isOwn || alreadySeen || viewed) return
    setRevealing(true)
    try { await api.post(`/api/messages/${message._id}/view-once`); setViewed(true) }
    catch {} finally { setRevealing(false) }
  }

  // Empfaenger hat bereits gesehen
  if (!isOwn && (alreadySeen || viewed)) {
    return (
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 12px', background:'rgba(255,255,255,0.05)', borderRadius:10, marginBottom:4 }}>
        <span style={{ fontSize:18 }}>👁️</span>
        <span style={{ fontSize:12, color:'rgba(255,255,255,0.4)' }}>Einmal angesehen · gelöscht</span>
      </div>
    )
  }

  // Empfaenger sieht verschwommenes Bild
  if (!isOwn) {
    return (
      <div style={{ position:'relative', borderRadius:10, overflow:'hidden', marginBottom:4, cursor:revealing?'wait':'pointer', userSelect:'none' }}
        onClick={handleView}>
        <img src={`${apiBase}${message.fileUrl}`} alt=""
          style={{ borderRadius:10, maxWidth:'100%', display:'block', filter:'blur(24px)', transform:'scale(1.08)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:6, background:'rgba(0,0,0,0.2)' }}>
          <span style={{ fontSize:30 }}>👁️</span>
          <span style={{ fontSize:12, fontWeight:700, color:'#fff', textShadow:'0 1px 4px rgba(0,0,0,0.8)' }}>
            {revealing ? 'Wird geöffnet...' : 'Tippen zum Ansehen'}
          </span>
          <span style={{ fontSize:10, color:'rgba(255,255,255,0.7)', background:'rgba(0,0,0,0.4)', padding:'2px 8px', borderRadius:99 }}>
            Einmal ansehen · danach gelöscht
          </span>
        </div>
      </div>
    )
  }

  // Absender sieht Bild mit Badge
  return (
    <div style={{ position:'relative', display:'inline-block', marginBottom:4 }}>
      <img src={`${apiBase}${message.fileUrl}`} alt={message.fileName||'Bild'}
        style={{ borderRadius:10, maxWidth:'100%', display:'block', cursor:'pointer' }}
        onClick={() => window.open(`${apiBase}${message.fileUrl}`, '_blank')} />
      <div style={{ position:'absolute', top:6, right:6, display:'flex', alignItems:'center', gap:4, background:'rgba(0,0,0,0.65)', borderRadius:8, padding:'3px 8px' }}>
        <span style={{ fontSize:11 }}>👁️</span>
        <span style={{ fontSize:10, color:'#e8b86d', fontWeight:600 }}>Einmal</span>
      </div>
    </div>
  )
}

function ReportMenu({ messageId, senderId, onClose }: { messageId: string; senderId: string; onClose: () => void }) {
  const [reason, setReason] = useState('')
  const [desc, setDesc] = useState('')
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const reasons = [
    { value: 'hate_speech',  label: '😡 Hassrede / Cybermobbing' },
    { value: 'harassment',   label: '🎯 Belästigung' },
    { value: 'extremism',    label: '⚠️ Extremismus / Terrorismus' },
    { value: 'child_safety', label: '🚨 Kinderschutz-Verstoß' },
    { value: 'spam',         label: '📢 Spam' },
    { value: 'other',        label: '❓ Sonstiges' },
  ]
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!reason) return; setSending(true)
    try {
      await api.post(`/api/messages/${messageId}/report`, { reason, description: desc, reportedUserId: senderId })
      setSent(true); setTimeout(onClose, 2000)
    } catch {} finally { setSending(false) }
  }
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', backdropFilter:'blur(4px)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }} onClick={onClose}>
      <div style={{ background:'#0d0f18', border:'1px solid rgba(255,255,255,0.08)', borderRadius:20, width:'100%', maxWidth:360, padding:22 }} onClick={e => e.stopPropagation()}>
        {sent ? (
          <div style={{ textAlign:'center', padding:'16px 0' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>✅</div>
            <p style={{ fontWeight:700, color:'white' }}>Meldung eingereicht</p>
          </div>
        ) : (
          <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <h3 style={{ fontWeight:700, color:'white', fontSize:15 }}>🚨 Inhalt melden</h3>
              <button type="button" onClick={onClose} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer', fontSize:16 }}>✕</button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              {reasons.map(r => (
                <label key={r.value} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', borderRadius:11, cursor:'pointer', background:reason===r.value?'rgba(239,68,68,0.12)':'transparent', border:reason===r.value?'1px solid rgba(239,68,68,0.3)':'1px solid transparent' }}>
                  <input type="radio" name="reason" value={r.value} checked={reason===r.value} onChange={() => setReason(r.value)} style={{ accentColor:'#ef4444' }} />
                  <span style={{ fontSize:13, color:'rgba(255,255,255,0.8)' }}>{r.label}</span>
                </label>
              ))}
            </div>
            <textarea value={desc} onChange={e => setDesc(e.target.value)}
              style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:10, padding:'9px 12px', fontSize:13, color:'white', outline:'none', resize:'none', fontFamily:'inherit' }}
              rows={2} placeholder="Optionale Details…" maxLength={300} />
            <button type="submit" disabled={!reason||sending}
              style={{ width:'100%', padding:'10px', borderRadius:11, background:'#dc2626', border:'none', color:'white', fontWeight:600, fontSize:13, cursor:reason&&!sending?'pointer':'not-allowed', opacity:reason&&!sending?1:0.5 }}>
              {sending ? 'Sende…' : 'Meldung abschicken'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default function MessageBubble({ message, isOwn, showAvatar, isFirstInGroup = true, isLastInGroup = true, onReply, onForward }: Props) {
  const editMessage   = useChatStore(s => s.editMessage)
  const deleteMessage = useChatStore(s => s.deleteMessage)
  const [editing,    setEditing]    = useState(false)
  const [editText,   setEditText]   = useState(message.content)
  const [showReport, setShowReport] = useState(false)
  const time    = format(new Date(message.createdAt), 'HH:mm', { locale: de })
  const apiBase = import.meta.env.VITE_API_URL || ''
  const canEdit = isOwn && message.type === 'text' && !message.deleted &&
    Date.now() - new Date(message.createdAt).getTime() < 5 * 60 * 1000
  const handleEdit = async () => {
    if (!editText.trim() || editText === message.content) { setEditing(false); return }
    await editMessage(message._id, message.conversationId, editText); setEditing(false)
  }

  if (message.expiresAt && new Date(message.expiresAt) < new Date()) return null

  const isTimeCapsule = (message as any).delivered === false && (message as any).deliverAt
  if (isTimeCapsule && isOwn) {
    const deliverDate = new Date((message as any).deliverAt)
    const handleDeleteCapsule = async () => {
      if (!confirm('Zeitkapsel löschen?')) return
      try { await api.delete(`/api/messages/capsules/${message._id}`) }
      catch (_e) { alert('Fehler beim Löschen') }
    }
    return (
      <div style={{ display:'flex', alignItems:'flex-end', gap:8, flexDirection:'row-reverse' }}>
        <div style={{ width:28, height:28, borderRadius:'50%', flexShrink:0, visibility:'hidden' }} />
        <div style={{ maxWidth:320 }}>
          <div style={{ background:'linear-gradient(135deg,rgba(180,106,14,0.15),rgba(232,184,109,0.1))', border:'1px dashed rgba(232,184,109,0.4)', borderRadius:'18px 18px 4px 18px', padding:'10px 14px', position:'relative' }}>
            <div style={{ position:'absolute', top:-8, right:-8, width:22, height:22, borderRadius:'50%', background:'linear-gradient(135deg,#b46a0e,#e8b86d)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11 }}>⏳</div>
            <p style={{ fontSize:13, color:'rgba(255,255,255,0.5)', fontStyle:'italic', userSelect:'none' }}>🔒 Zeitkapsel-Nachricht</p>
            <p style={{ fontSize:11, color:'rgba(255,255,255,0.35)', marginTop:4 }}>„{message.content.length>40?message.content.slice(0,40)+'…':message.content}"</p>
            <div style={{ marginTop:8, padding:'6px 10px', background:'rgba(232,184,109,0.08)', borderRadius:8, display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ fontSize:11 }}>📅</span>
              <span style={{ fontSize:11, color:'#e8b86d' }}>Zustellung: <strong>{deliverDate.toLocaleString('de-DE',{weekday:'short',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</strong></span>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', gap:6, marginTop:4 }}>
            <span style={{ fontSize:10, color:'rgba(255,255,255,0.25)' }}>{time}</span>
            <button onClick={handleDeleteCapsule} style={{ fontSize:10, color:'rgba(239,68,68,0.6)', background:'none', border:'none', cursor:'pointer', padding:'2px 6px', borderRadius:6 }}>Abbrechen ✕</button>
          </div>
        </div>
      </div>
    )
  }
  if (isTimeCapsule && !isOwn) return null

  if (message.deleted) {
    return (
      <div style={{ display:'flex', alignItems:'flex-end', gap:8, flexDirection:isOwn?'row-reverse':'row' }}>
        <div style={{ width:28, height:28, flexShrink:0 }} />
        <div style={{ padding:'8px 12px', borderRadius:16, fontSize:13, fontStyle:'italic', color:'rgba(255,255,255,0.3)', border:'1px solid rgba(255,255,255,0.08)' }}>
          🗑 Nachricht gelöscht
        </div>
      </div>
    )
  }

  const bubbleOwn: React.CSSProperties   = { background:'rgba(180,106,14,0.2)', border:'1px solid rgba(232,184,109,0.2)', borderRadius:'18px 18px 4px 18px', padding:'10px 14px', fontSize:13, color:'#f1f0f8', lineHeight:1.55, wordBreak:'break-word' }
  const bubbleOther: React.CSSProperties = { background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)', backdropFilter:'blur(16px)', borderRadius:'18px 18px 18px 4px', padding:'10px 14px', fontSize:13, color:'rgba(255,255,255,0.88)', lineHeight:1.55, wordBreak:'break-word' }
  const actionBtn: React.CSSProperties   = { fontSize:11, background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.1)', backdropFilter:'blur(12px)', padding:'4px 8px', borderRadius:8, color:'rgba(255,255,255,0.7)', cursor:'pointer' }
  const actionBtnRed: React.CSSProperties = { ...actionBtn, background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', color:'#fca5a5' }

  const isViewOnce = !!(message as any).viewOnce

  return (
    <>
      <div style={{ display:'flex', alignItems:'flex-end', gap:8, flexDirection:isOwn?'row-reverse':'row', position:'relative', marginBottom:isLastInGroup?12:2 }} className="group">
        <div style={{ width:28, height:28, borderRadius:'50%', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'#fff',
          background:(message.sender as any)?.botId?'linear-gradient(135deg,#b46a0e,#e8b86d)':isOwn?'linear-gradient(135deg,#b46a0e,#e8b86d)':(message as any).anonymMode?'linear-gradient(135deg,#3b1a6b,#7c3aed)':'linear-gradient(135deg,#1a4a6b,#0d9488)',
          visibility:showAvatar?'visible':'hidden' }}>
          {(message.sender as any)?.botId?'🤖':(message as any).anonymMode?'🎭':(message.sender?.username??'?')[0]?.toUpperCase()??'?'}
        </div>

        <div style={{ maxWidth:'68%', minWidth:60, position:'relative' }}>
          {showAvatar && !isOwn && (
            <p style={{ fontSize:11, color:'rgba(255,255,255,0.4)', marginBottom:4, marginLeft:2 }}>
              {(message.sender as any)?.botId?(message.sender as any).name:(message as any).anonymMode?'🎭 Anonym':(message.sender?.username??'')}
            </p>
          )}
          {(message as any).whisperTo && (
            <div style={{ display:'inline-flex', alignItems:'center', gap:4, background:'rgba(59,130,246,0.1)', border:'1px solid rgba(59,130,246,0.25)', borderRadius:99, padding:'1px 8px', fontSize:10, color:'#93c5fd', marginBottom:4 }}>
              🤫 Flüsternachricht
            </div>
          )}
          {!editing && (
            <div style={{ position:'absolute', right:isOwn?'100%':'auto', left:isOwn?'auto':'100%', marginRight:isOwn?8:0, marginLeft:isOwn?0:8, top:0, display:'none', gap:4, alignItems:'center', zIndex:10, whiteSpace:'nowrap' }} className="group-hover:flex">
              <button onClick={() => onReply(message)} style={actionBtn} title="Antworten">↩</button>
              <button onClick={() => onForward(message)} style={actionBtn} title="Weiterleiten">↪</button>
              {!isOwn && <button onClick={() => setShowReport(true)} style={actionBtnRed} title="Melden">🚨</button>}
              {isOwn && canEdit && <button onClick={() => setEditing(true)} style={actionBtn} title="Bearbeiten">✏️</button>}
              {isOwn && <button onClick={() => deleteMessage(message._id, message.conversationId)} style={actionBtnRed} title="Löschen">🗑</button>}
            </div>
          )}
          {message.replyTo && !editing && (
            <div style={{ marginBottom:6, padding:'6px 12px', borderRadius:12, borderLeft:'2px solid #e8b86d', background:isOwn?'rgba(180,106,14,0.15)':'rgba(255,255,255,0.05)', fontSize:11 }}>
              <p style={{ color:'#e8b86d', fontWeight:600, marginBottom:2 }}>{(message.replyTo as Message).sender?.username}</p>
              <p style={{ color:'rgba(255,255,255,0.45)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {(message.replyTo as Message).type==='voice'?'🎤 Sprachnachricht':(message.replyTo as Message).content}
              </p>
            </div>
          )}
          {editing ? (
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <textarea value={editText} onChange={e => setEditText(e.target.value)}
                style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(232,184,109,0.3)', borderRadius:10, padding:'9px 12px', fontSize:13, color:'white', outline:'none', resize:'none', fontFamily:'inherit', minHeight:60 }}
                rows={2} autoFocus onKeyDown={e => { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleEdit()} if(e.key==='Escape')setEditing(false) }} />
              <div style={{ display:'flex', gap:6, justifyContent:'flex-end' }}>
                <button onClick={() => setEditing(false)} style={{ fontSize:12, padding:'4px 10px', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, color:'rgba(255,255,255,0.6)', cursor:'pointer' }}>Abbrechen</button>
                <button onClick={handleEdit} style={{ fontSize:12, padding:'4px 10px', background:'linear-gradient(135deg,#b46a0e,#e8b86d)', border:'none', borderRadius:8, color:'white', fontWeight:600, cursor:'pointer' }}>Speichern</button>
              </div>
            </div>
          ) : (
            <div style={isOwn?bubbleOwn:bubbleOther}>
              {message.type==='voice' && message.fileUrl && (
                <VoicePlayer url={`${apiBase}${message.fileUrl}`} duration={message.duration} isOwn={isOwn} />
              )}
              {/* Einmal ansehen */}
              {message.type==='image' && message.fileUrl && isViewOnce && (
                <ViewOnceImage message={message} isOwn={isOwn} apiBase={apiBase} />
              )}
              {/* Normales Bild */}
              {message.type==='image' && message.fileUrl && !isViewOnce && (
                <img src={`${apiBase}${message.fileUrl}`} alt={message.fileName||'Bild'}
                  style={{ borderRadius:10, maxWidth:'100%', marginBottom:4, cursor:'pointer', display:'block' }}
                  onClick={() => window.open(`${apiBase}${message.fileUrl}`,'_blank')} />
              )}
              {message.type==='file' && message.fileUrl && (
                <a href={`${apiBase}${message.fileUrl}`} target="_blank" rel="noreferrer"
                  style={{ display:'flex', alignItems:'center', gap:8, color:'rgba(255,255,255,0.8)', textDecoration:'none', marginBottom:4 }}>
                  <span>📎</span><span style={{ textDecoration:'underline', fontSize:12 }}>{message.fileName}</span>
                </a>
              )}
              {message.content && (() => {
                const isGif = typeof message.content==='string' &&
                  (message.content.includes('tenor.com')||message.content.includes('giphy.com')) &&
                  message.content.startsWith('http')
                if (isGif) return <img src={message.content} alt="GIF" style={{ maxWidth:200, maxHeight:150, borderRadius:8, display:'block' }} />
                const urls = extractUrls(message.content)
                return (
                  <>
                    <p dangerouslySetInnerHTML={{ __html:parseMarkdown(message.content) }} style={{ lineHeight:1.5, wordBreak:'break-word' }} />
                    {urls.map(url => <LinkPreview key={url} url={url} isOwn={isOwn} />)}
                  </>
                )
              })()}
              {message.edited && <span style={{ fontSize:10, opacity:0.5, fontStyle:'italic', marginLeft:4 }}>(bearbeitet)</span>}
            </div>
          )}
          {message.reactions.length>0 && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:4, justifyContent:isOwn?'flex-end':'flex-start' }}>
              {Object.entries(message.reactions.reduce((acc,r)=>{acc[r.emoji]=(acc[r.emoji]||0)+1;return acc},{}as Record<string,number>)).map(([emoji,count])=>(
                <span key={emoji} style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:99, padding:'2px 8px', fontSize:12 }}>
                  {emoji}{count>1&&count}
                </span>
              ))}
            </div>
          )}
          {isLastInGroup && (
            <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:2, flexWrap:'wrap', justifyContent:isOwn?'flex-end':'flex-start' }}>
              <span style={{ fontSize:10, color:'rgba(255,255,255,0.25)' }}>{time}</span>
              {isOwn && (() => {
                const status=(message.readBy?.length||0)>1?'read':'sent'
                return (
                  <span title={status==='read'?'Gelesen':'Gesendet'}>
                    {status==='read'?(
                      <svg width="16" height="10" viewBox="0 0 16 10" fill="none">
                        <path d="M1 5L4.5 8.5L10 2" stroke="#4ade80" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M5 5L8.5 8.5L14 2" stroke="#4ade80" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    ):(
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M1 5L4 8L9 2" stroke="rgba(255,255,255,0.5)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </span>
                )
              })()}
              {message.expiresAt && (
                <span style={{ fontSize:10, color:'#fb923c', background:'rgba(251,146,60,0.1)', border:'1px solid rgba(251,146,60,0.2)', borderRadius:99, padding:'1px 8px' }}>
                  ⏱ {formatDistanceToNow(new Date(message.expiresAt),{locale:de,addSuffix:true})}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
      {showReport && <ReportMenu messageId={message._id} senderId={message.sender?._id??''} onClose={() => setShowReport(false)} />}
    </>
  )
}