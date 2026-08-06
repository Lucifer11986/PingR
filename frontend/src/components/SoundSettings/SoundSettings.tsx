import { useState, useEffect, useRef } from 'react'
import api from '../../services/api'
import { useSound, CustomSound } from '../../hooks/useSound'

const MAX_SOUNDS   = 10
const MAX_SIZE_MB  = 1
const MAX_DURATION = 5

export default function SoundSettings() {
  const { setVolume, setTheme, setCustomDing, playPreview, getVolume, getTheme, getCustomDing } = useSound()
  const [volume,       setVolumeState]  = useState(() => getVolume())
  const [theme,        setThemeState]   = useState(() => getTheme())
  const [customDing,   setCustomDingId] = useState(() => getCustomDing())
  const [sounds,       setSounds]       = useState<CustomSound[]>([])
  const [uploading,    setUploading]    = useState(false)
  const [uploadErr,    setUploadErr]    = useState('')
  const [labelInput,   setLabelInput]   = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const apiBase = import.meta.env.VITE_API_URL || ''

  const themes = [
    { id:'icq',     label:'🎵 ICQ Classic' },
    { id:'modern',  label:'✨ Modern'       },
    { id:'minimal', label:'🔕 Minimal'      },
    { id:'off',     label:'🔇 Aus'          },
  ]

  // Sounds vom Server laden
  useEffect(() => {
    api.get('/api/sounds').then(r => {
      setSounds(r.data || [])
      localStorage.setItem('pingr_custom_sounds', JSON.stringify(r.data || []))
    }).catch(() => {})
  }, [])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setUploadErr('')

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setUploadErr(`Datei zu groß (max. ${MAX_SIZE_MB} MB)`); return
    }

    // Dauer prüfen
    const checkDuration = (): Promise<number> => new Promise(resolve => {
      const audio = new Audio(URL.createObjectURL(file))
      audio.addEventListener('loadedmetadata', () => resolve(audio.duration))
      audio.addEventListener('error', () => resolve(0))
    })

    const duration = await checkDuration()
    if (duration > MAX_DURATION) {
      setUploadErr(`Zu lang — maximal ${MAX_DURATION} Sekunden erlaubt (deine Datei: ${duration.toFixed(1)}s)`); return
    }
    if (sounds.length >= MAX_SOUNDS) {
      setUploadErr(`Maximal ${MAX_SOUNDS} Sounds erlaubt`); return
    }

    setUploading(true)
    try {
      const form = new FormData()
      form.append('sound', file)
      form.append('label', labelInput || file.name.replace(/\.[^.]+$/, '').slice(0, 30))
      const { data } = await api.post('/api/sounds', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      const updated = [...sounds, data]
      setSounds(updated)
      localStorage.setItem('pingr_custom_sounds', JSON.stringify(updated))
      setLabelInput('')
    } catch (err: any) {
      setUploadErr(err?.response?.data?.error || 'Upload fehlgeschlagen')
    } finally { setUploading(false) }
  }

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/sounds/${id}`)
      const updated = sounds.filter(s => s.id !== id)
      setSounds(updated)
      localStorage.setItem('pingr_custom_sounds', JSON.stringify(updated))
      if (customDing === id) {
        setCustomDingId('')
        setCustomDing('')
      }
    } catch (_e) { alert('Fehler beim Löschen') }
  }

  const selectDing = (id: string) => {
    const newId = customDing === id ? '' : id
    setCustomDingId(newId)
    setCustomDing(newId)
  }

  const S = {
    card:     { background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:12, padding:'12px 14px', marginBottom:10 } as React.CSSProperties,
    label:    { fontSize:11, color:'rgba(255,255,255,0.4)', textTransform:'uppercase' as const, letterSpacing:'0.07em', fontWeight:700, marginBottom:6, display:'block' },
    secTitle: { fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.3)', letterSpacing:'0.08em', textTransform:'uppercase' as const, marginBottom:10 },
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>

      {/* Lautstärke */}
      <div>
        <p style={S.secTitle}>Lautstärke</p>
        <div style={S.card}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <span style={{ fontSize:18 }}>{volume === 0 ? '🔇' : volume < 0.4 ? '🔈' : volume < 0.7 ? '🔉' : '🔊'}</span>
            <input type="range" min="0" max="1" step="0.05" value={volume}
              onChange={e => { const v = parseFloat(e.target.value); setVolumeState(v); setVolume(v) }}
              onMouseUp={e => {
                // Kurzen Test-Ton abspielen wenn der Regler losgelassen wird
                if (theme !== 'off') {
                  const v = parseFloat((e.target as HTMLInputElement).value)
                  const sMap: Record<string,string> = { icq:'/sounds/icq-ding.mp3', modern:'/sounds/modern-ding.mp3', minimal:'/sounds/minimal-ding.mp3' }
                  const a = new Audio(sMap[theme] || '/sounds/icq-ding.mp3')
                  a.volume = Math.max(0, Math.min(1, v))
                  a.play().catch(() => {})
                }
              }}
              onTouchEnd={e => {
                if (theme !== 'off') {
                  const sMap2: Record<string,string> = { icq:'/sounds/icq-ding.mp3', modern:'/sounds/modern-ding.mp3', minimal:'/sounds/minimal-ding.mp3' }
                  const a = new Audio(sMap2[theme] || '/sounds/icq-ding.mp3')
                  a.volume = Math.max(0, Math.min(1, volume))
                  a.play().catch(() => {})
                }
              }}
              style={{ flex:1, accentColor:'#e8b86d' }} />
            <span style={{ fontSize:12, color:'#e8b86d', fontWeight:600, minWidth:36 }}>{Math.round(volume * 100)}%</span>
          </div>
        </div>
      </div>

      {/* Theme */}
      <div>
        <p style={S.secTitle}>Sound-Theme</p>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          {themes.map(t => (
            <button key={t.id} onClick={() => {
              setThemeState(t.id as any)
              setTheme(t.id)
              // Preview: ding-Sound des gewählten Themes abspielen
              if (t.id !== 'off') {
                const srcMap: Record<string,string> = {
                  icq:     '/sounds/icq-ding.mp3',
                  modern:  '/sounds/modern-ding.mp3',
                  minimal: '/sounds/minimal-ding.mp3',
                }
                const src = srcMap[t.id]
                if (src) {
                  const a = new Audio(src)
                  a.volume = Math.max(0, Math.min(1, volume))
                  a.play().catch(() => {})
                }
              }
            }}
              style={{ padding:'10px 14px', borderRadius:11, fontSize:13, fontWeight: theme===t.id ? 600 : 400, cursor:'pointer', textAlign:'left', border: theme===t.id ? '1px solid rgba(232,184,109,0.4)' : '1px solid rgba(255,255,255,0.08)', background: theme===t.id ? 'rgba(232,184,109,0.1)' : 'rgba(255,255,255,0.04)', color: theme===t.id ? '#e8b86d' : 'rgba(255,255,255,0.6)', transition:'all .15s' }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Sounds */}
      <div>
        <p style={S.secTitle}>🎵 Eigene Sounds ({sounds.length}/{MAX_SOUNDS})</p>
        <p style={{ fontSize:11, color:'rgba(255,255,255,0.3)', marginBottom:10, lineHeight:1.5 }}>
          Lade eigene Sounds hoch (max. {MAX_DURATION} Sek, max. {MAX_SIZE_MB} MB). Wähle einen als Nachrichtenton aus.
        </p>

        {/* Upload */}
        {sounds.length < MAX_SOUNDS && (
          <div style={S.card}>
            <div style={{ display:'flex', gap:8, marginBottom: uploadErr ? 8 : 0 }}>
              <input
                type="text" value={labelInput} onChange={e => setLabelInput(e.target.value)}
                placeholder="Name (optional)"
                style={{ flex:1, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:9, padding:'8px 12px', fontSize:12, color:'white', outline:'none' }}
              />
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                style={{ padding:'8px 14px', background:'linear-gradient(135deg,#b46a0e,#e8b86d)', border:'none', borderRadius:9, color:'white', fontSize:12, fontWeight:600, cursor:'pointer', opacity: uploading ? 0.6 : 1, flexShrink:0 }}>
                {uploading ? '⏳ Lädt…' : '📁 Hochladen'}
              </button>
            </div>
            {uploadErr && <p style={{ fontSize:11, color:'#f87171', marginTop:6 }}>⚠ {uploadErr}</p>}
            <input ref={fileRef} type="file" accept=".mp3,.wav,.ogg,.m4a,.webm,audio/*" style={{ display:'none' }} onChange={handleUpload} />
            <p style={{ fontSize:10, color:'rgba(255,255,255,0.25)', marginTop:6 }}>Erlaubt: MP3, WAV, OGG, M4A, WebM — max. {MAX_DURATION} Sek, max. {MAX_SIZE_MB} MB</p>
          </div>
        )}

        {/* Sound-Liste */}
        {sounds.length === 0 && (
          <div style={{ ...S.card, textAlign:'center', color:'rgba(255,255,255,0.25)', fontSize:13, padding:'20px 14px' }}>
            Noch keine eigenen Sounds hochgeladen
          </div>
        )}

        {sounds.map(s => (
          <div key={s.id} style={{ ...S.card, display:'flex', alignItems:'center', gap:10 }}>
            {/* Aktiv-Indikator */}
            <button onClick={() => selectDing(s.id)}
              style={{ width:20, height:20, borderRadius:'50%', flexShrink:0, cursor:'pointer', border: customDing===s.id ? '2px solid #e8b86d' : '2px solid rgba(255,255,255,0.2)', background: customDing===s.id ? '#e8b86d' : 'transparent' }}
              title={customDing===s.id ? 'Aktiver Nachrichtenton' : 'Als Nachrichtenton setzen'} />

            <div style={{ flex:1, minWidth:0 }}>
              <p style={{ fontSize:13, fontWeight: customDing===s.id ? 600 : 400, color: customDing===s.id ? '#e8b86d' : 'rgba(255,255,255,0.8)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {s.label}
              </p>
              <p style={{ fontSize:10, color:'rgba(255,255,255,0.3)', marginTop:2 }}>
                {(s.size / 1024).toFixed(0)} KB
              </p>
            </div>

            {/* Vorschau */}
            <button onClick={() => playPreview(s.url)}
              style={{ width:30, height:30, borderRadius:'50%', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.7)', cursor:'pointer', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center' }}
              title="Vorschau">▶</button>

            {/* Löschen */}
            <button onClick={() => handleDelete(s.id)}
              style={{ width:30, height:30, borderRadius:'50%', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', color:'#f87171', cursor:'pointer', fontSize:13, display:'flex', alignItems:'center', justifyContent:'center' }}
              title="Löschen">✕</button>
          </div>
        ))}

        {customDing && (
          <p style={{ fontSize:11, color:'#e8b86d', marginTop:6 }}>
            ✓ Aktiver Nachrichtenton: <strong>{sounds.find(s => s.id === customDing)?.label}</strong>
            {' '}<button onClick={() => { setCustomDingId(''); setCustomDing('') }} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer', fontSize:11 }}>(zurücksetzen)</button>
          </p>
        )}
      </div>
    </div>
  )
}