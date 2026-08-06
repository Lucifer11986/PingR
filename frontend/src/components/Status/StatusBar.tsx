import React, { useEffect, useRef, useState } from 'react'
import api from '../../services/api'

const apiBase = import.meta.env.VITE_API_URL || ''

interface StatusItem {
  _id: string
  type: 'image' | 'video' | 'text'
  mediaUrl?: string
  text?: string
  color?: string
  duration?: number
  expiresAt: string
  createdAt: string
  isViewed: boolean
}

interface StatusGroup {
  user: { _id: string; username: string; avatar?: string }
  statuses: StatusItem[]
  isOwn: boolean
  hasUnread: boolean
}

interface Props {
  onUpload?: () => void
}

// -- Upload Modal --------------------------------------------------------------
function UploadModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [type,      setType]      = useState<'image' | 'video' | 'text'>('image')
  const [text,      setText]      = useState('')
  const [color,     setColor]     = useState('linear-gradient(135deg,#b46a0e,#e8b86d)')
  const [file,      setFile]      = useState<File | null>(null)
  const [preview,   setPreview]   = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error,     setError]     = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const colors = [
    'linear-gradient(135deg,#b46a0e,#e8b86d)',
    'linear-gradient(135deg,#1a4a6b,#0d9488)',
    'linear-gradient(135deg,#3b1a6b,#7c3aed)',
    'linear-gradient(135deg,#1a2e1a,#16a34a)',
    'linear-gradient(135deg,#1a1a2e,#1e3a8a)',
    'linear-gradient(135deg,#4a1a1a,#dc2626)',
  ]

  const handleFile = (f: File) => {
    if (f.type.startsWith('video/')) {
      const vid = document.createElement('video')
      vid.preload = 'metadata'
      vid.onloadedmetadata = () => {
        if (vid.duration > 60) {
          setError('Video darf max. 60 Sekunden lang sein')
          return
        }
        setFile(f); setPreview(URL.createObjectURL(f)); setType('video'); setError('')
      }
      vid.src = URL.createObjectURL(f)
    } else {
      setFile(f); setPreview(URL.createObjectURL(f)); setType('image'); setError('')
    }
  }

  const submit = async () => {
    if (type !== 'text' && !file) { setError('Bitte Datei wählen'); return }
    if (type === 'text' && !text.trim()) { setError('Bitte Text eingeben'); return }
    setUploading(true); setError('')
    try {
      const form = new FormData()
      form.append('type', type)
      if (file)  form.append('media', file)
      if (text)  form.append('text', text)
      if (color) form.append('color', color)
      await api.post('/api/status', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      onSuccess(); onClose()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler beim Hochladen')
    } finally { setUploading(false) }
  }

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', backdropFilter:'blur(10px)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'#0d0f18', border:'1px solid rgba(255,255,255,0.08)', borderRadius:20, padding:24, maxWidth:420, width:'100%', boxShadow:'0 24px 60px rgba(0,0,0,0.7)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <h2 style={{ fontSize:16, fontWeight:800, color:'#fff' }}>Status erstellen</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer', fontSize:20 }}>x</button>
        </div>

        <div style={{ display:'flex', gap:6, marginBottom:16 }}>
          {(['image', 'video', 'text'] as const).map(t => (
            <button key={t} onClick={() => { setType(t); setFile(null); setPreview(null) }}
              style={{ flex:1, padding:'8px', borderRadius:9, border:'none', cursor:'pointer', fontSize:12, fontWeight:600,
                background: type === t ? 'rgba(232,184,109,0.15)' : 'rgba(255,255,255,0.05)',
                color: type === t ? '#e8b86d' : 'rgba(255,255,255,0.4)' }}>
              {t === 'image' ? 'Bild' : t === 'video' ? 'Video' : 'Text'}
            </button>
          ))}
        </div>

        {type === 'text' ? (
          <div>
            <textarea value={text} onChange={e => setText(e.target.value)} maxLength={200} rows={4}
              placeholder="Was moechtest du teilen?"
              style={{ width:'100%', padding:'12px', borderRadius:10, background:color, border:'none', color:'#fff', fontSize:15, fontWeight:600, outline:'none', resize:'none', boxSizing:'border-box' as const }} />
            <div style={{ display:'flex', gap:6, marginTop:8, flexWrap:'wrap' as const }}>
              {colors.map(c => (
                <div key={c} onClick={() => setColor(c)}
                  style={{ width:28, height:28, borderRadius:'50%', background:c, cursor:'pointer', border: color === c ? '2px solid #fff' : '2px solid transparent' }} />
              ))}
            </div>
          </div>
        ) : (
          <div>
            <input ref={fileRef} type="file" accept={type === 'video' ? 'video/*' : 'image/*'} style={{ display:'none' }}
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
            {preview ? (
              <div style={{ position:'relative', borderRadius:12, overflow:'hidden', marginBottom:8 }}>
                {type === 'video'
                  ? <video src={preview} controls style={{ width:'100%', maxHeight:200, borderRadius:12, display:'block' }} />
                  : <img src={preview} alt="Preview" style={{ width:'100%', maxHeight:200, objectFit:'cover', borderRadius:12, display:'block' }} />
                }
                <button onClick={() => { setFile(null); setPreview(null) }}
                  style={{ position:'absolute', top:8, right:8, width:28, height:28, borderRadius:'50%', background:'rgba(0,0,0,0.6)', border:'none', color:'#fff', cursor:'pointer' }}>x</button>
              </div>
            ) : (
              <div onClick={() => fileRef.current?.click()}
                style={{ border:'2px dashed rgba(255,255,255,0.15)', borderRadius:12, padding:'32px 20px', textAlign:'center', cursor:'pointer', marginBottom:8 }}>
                <div style={{ fontSize:32, marginBottom:8 }}>{type === 'video' ? 'Film' : 'Bild'}</div>
                <div style={{ fontSize:13, color:'rgba(255,255,255,0.5)' }}>
                  {type === 'video' ? 'Video auswaehlen (max. 60 Sek, 50 MB)' : 'Bild auswaehlen'}
                </div>
              </div>
            )}
          </div>
        )}

        {error && <div style={{ color:'#f87171', fontSize:12, marginTop:8 }}>{error}</div>}

        <div style={{ display:'flex', gap:10, marginTop:16 }}>
          <button onClick={onClose} style={{ flex:1, padding:'10px', borderRadius:9, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.6)', cursor:'pointer' }}>Abbrechen</button>
          <button onClick={submit} disabled={uploading}
            style={{ flex:2, padding:'10px', borderRadius:9, border:'none', background:'linear-gradient(135deg,#b46a0e,#e8b86d)', color:'#fff', fontWeight:700, cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.7 : 1 }}>
            {uploading ? 'Laedt hoch...' : 'Status teilen'}
          </button>
        </div>
      </div>
    </div>
  )
}

// -- StatusViewer — Fullscreen Viewer -----------------------------------------
function StatusViewer({ groups, startIndex, onClose, onViewed }: {
  groups: StatusGroup[]; startIndex: number; onClose: () => void; onViewed: (id: string) => void
}) {
  const [groupIdx,  setGroupIdx]  = useState(startIndex)
  const [statusIdx, setStatusIdx] = useState(0)
  const [progress,  setProgress]  = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval>>()

  const group  = groups[groupIdx]
  const status = group?.statuses[statusIdx]
  const DURATION = status?.type === 'video' ? (status.duration || 15) * 1000 : 5000

  const next = () => {
    clearInterval(timerRef.current)
    if (statusIdx < (group?.statuses.length || 0) - 1) { setStatusIdx(i => i + 1) }
    else if (groupIdx < groups.length - 1) { setGroupIdx(i => i + 1); setStatusIdx(0) }
    else { onClose() }
  }

  const prev = () => {
    clearInterval(timerRef.current)
    if (statusIdx > 0) setStatusIdx(i => i - 1)
    else if (groupIdx > 0) { setGroupIdx(i => i - 1); setStatusIdx(0) }
  }

  useEffect(() => {
    if (!status) return
    setProgress(0)
    onViewed(status._id)
    timerRef.current = setInterval(() => {
      setProgress(p => {
        if (p >= 100) { clearInterval(timerRef.current); next(); return 100 }
        return p + (100 / (DURATION / 100))
      })
    }, 100)
    return () => clearInterval(timerRef.current)
  }, [groupIdx, statusIdx])

  if (!group || !status) return null

  const timeAgo = (d: string) => {
    const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
    if (s < 60) return 'gerade'
    if (s < 3600) return `vor ${Math.floor(s/60)} Min`
    return `vor ${Math.floor(s/3600)} Std`
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'#000', zIndex:2000, display:'flex', flexDirection:'column' }}>
      {/* Progress Bars */}
      <div style={{ display:'flex', gap:3, padding:'12px 16px 8px', position:'absolute', top:0, left:0, right:0, zIndex:10 }}>
        {group.statuses.map((_, i) => (
          <div key={i} style={{ flex:1, height:2, borderRadius:1, background:'rgba(255,255,255,0.25)', overflow:'hidden' }}>
            <div style={{ height:'100%', background:'#fff', width: i < statusIdx ? '100%' : i === statusIdx ? `${progress}%` : '0%', transition: i === statusIdx ? 'none' : 'width 0s' }} />
          </div>
        ))}
      </div>

      {/* Header */}
      <div style={{ position:'absolute', top:28, left:0, right:0, zIndex:10, display:'flex', alignItems:'center', gap:10, padding:'0 16px' }}>
        <div style={{ width:36, height:36, borderRadius:'50%', background:'linear-gradient(135deg,#b46a0e,#e8b86d)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, color:'#fff', flexShrink:0 }}>
          {group.user.username[0]?.toUpperCase()}
        </div>
        <div>
          <div style={{ fontSize:13, fontWeight:700, color:'#fff' }}>{group.user.username}</div>
          <div style={{ fontSize:11, color:'rgba(255,255,255,0.5)' }}>{timeAgo(status.createdAt)}</div>
        </div>
        <button onClick={onClose} style={{ marginLeft:'auto', background:'none', border:'none', color:'rgba(255,255,255,0.7)', fontSize:24, cursor:'pointer' }}>x</button>
      </div>

      {/* Content */}
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', position:'relative' }}>
        {status.type === 'video' && status.mediaUrl && (
          <video src={`${apiBase}${status.mediaUrl}`} autoPlay style={{ maxWidth:'100%', maxHeight:'100%', objectFit:'contain' }} onEnded={next} />
        )}
        {status.type === 'image' && status.mediaUrl && (
          <img src={`${apiBase}${status.mediaUrl}`} alt="Status" style={{ maxWidth:'100%', maxHeight:'100%', objectFit:'contain' }} />
        )}
        {status.type === 'text' && (
          <div style={{ background:status.color, width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', padding:40 }}>
            <p style={{ fontSize:24, fontWeight:700, color:'#fff', textAlign:'center', lineHeight:1.4 }}>{status.text}</p>
          </div>
        )}
        <div onClick={prev} style={{ position:'absolute', left:0, top:0, width:'35%', height:'100%', cursor:'pointer' }} />
        <div onClick={next} style={{ position:'absolute', right:0, top:0, width:'35%', height:'100%', cursor:'pointer' }} />
      </div>
    </div>
  )
}

// -- StatusBar — Kreise oben in der ContactList --------------------------------
export default function StatusBar({ onUpload }: Props) {
  const [groups,     setGroups]     = useState<StatusGroup[]>([])
  const [loading,    setLoading]    = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [viewer,     setViewer]     = useState<{ groupIdx: number } | null>(null)

  const load = async () => {
    try {
      const { data } = await api.get('/api/status')
      setGroups(data.statuses || [])
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleViewed = async (statusId: string) => {
    try { await api.post(`/api/status/${statusId}/view`) } catch {}
  }

  const ownGroup = groups.find(g => g.isOwn)

  if (loading) return null

  return (
    <>
      <div style={{ display:'flex', gap:10, padding:'10px 12px 4px', overflowX:'auto', scrollbarWidth:'none' }}>
        {/* Eigener Status */}
        <div onClick={() => ownGroup ? setViewer({ groupIdx: 0 }) : setShowUpload(true)}
          style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, cursor:'pointer', flexShrink:0 }}>
          <div style={{ position:'relative' }}>
            <div style={{ width:52, height:52, borderRadius:'50%', background: ownGroup ? 'linear-gradient(135deg,#b46a0e,#e8b86d)' : 'rgba(255,255,255,0.06)', border: ownGroup ? '2px solid #e8b86d' : '2px dashed rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
              {ownGroup?.statuses[0]?.type === 'image' && ownGroup.statuses[0].mediaUrl
                ? <img src={`${apiBase}${ownGroup.statuses[0].mediaUrl}`} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                : <span style={{ fontSize: ownGroup ? 22 : 24, color:'rgba(255,255,255,0.6)' }}>{ownGroup ? 'Me' : '+'}</span>
              }
            </div>
            {!ownGroup && (
              <div style={{ position:'absolute', bottom:0, right:0, width:18, height:18, borderRadius:'50%', background:'linear-gradient(135deg,#b46a0e,#e8b86d)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, border:'2px solid #08090f' }}>+</div>
            )}
          </div>
          <span style={{ fontSize:10, color:'rgba(255,255,255,0.4)', maxWidth:54, textAlign:'center', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {ownGroup ? 'Mein Status' : 'Neu'}
          </span>
        </div>

        {/* Kontakt-Status */}
        {groups.filter(g => !g.isOwn).map((group) => (
          <div key={group.user._id} onClick={() => setViewer({ groupIdx: groups.indexOf(group) })}
            style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, cursor:'pointer', flexShrink:0 }}>
            <div style={{ width:52, height:52, borderRadius:'50%', background:'linear-gradient(135deg,#1a4a6b,#0d9488)', border: group.hasUnread ? '2px solid #e8b86d' : '2px solid rgba(255,255,255,0.12)', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', opacity: group.hasUnread ? 1 : 0.55 }}>
              {group.statuses[0]?.type === 'image' && group.statuses[0].mediaUrl
                ? <img src={`${apiBase}${group.statuses[0].mediaUrl}`} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                : <span style={{ fontSize:18, fontWeight:700, color:'#fff' }}>{group.user.username[0]?.toUpperCase()}</span>
              }
            </div>
            <span style={{ fontSize:10, color: group.hasUnread ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.3)', maxWidth:54, textAlign:'center', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {group.user.username}
            </span>
          </div>
        ))}

        {/* Neuen Status hinzufügen wenn eigener existiert */}
        {ownGroup && (
          <div onClick={() => setShowUpload(true)}
            style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, cursor:'pointer', flexShrink:0 }}>
            <div style={{ width:52, height:52, borderRadius:'50%', background:'rgba(255,255,255,0.04)', border:'2px dashed rgba(255,255,255,0.12)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <span style={{ fontSize:22, color:'rgba(255,255,255,0.4)' }}>+</span>
            </div>
            <span style={{ fontSize:10, color:'rgba(255,255,255,0.3)' }}>Neu</span>
          </div>
        )}
      </div>

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} onSuccess={() => { load(); onUpload?.() }} />}
      {viewer && (
        <StatusViewer groups={groups} startIndex={viewer.groupIdx}
          onClose={() => { setViewer(null); load() }}
          onViewed={handleViewed} />
      )}
    </>
  )
}