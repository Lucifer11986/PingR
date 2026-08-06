import { useState } from 'react'
import { createPortal } from 'react-dom'
import api from '../../services/api'

interface Props {
  onClose:   () => void
  onCreate:  (channel: any) => void
}

export default function CreateChannelModal({ onClose, onCreate }: Props) {
  const [name,      setName]      = useState('')
  const [handle,    setHandle]    = useState('')
  const [desc,      setDesc]      = useState('')
  const [isPublic,  setIsPublic]  = useState(true)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')

  // Handle automatisch aus Name generieren
  const onNameChange = (v: string) => {
    setName(v)
    if (!handle || handle === name.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_')) {
      setHandle(v.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').slice(0, 32))
    }
  }

  const submit = async () => {
    setError('')
    if (!name.trim())   return setError('Name erforderlich')
    if (!handle.trim()) return setError('Handle erforderlich')
    if (handle.length < 3) return setError('Handle muss mindestens 3 Zeichen haben')

    setLoading(true)
    try {
      const { data } = await api.post('/api/channels', { name: name.trim(), handle, description: desc, isPublic })
      onCreate(data)
      onClose()
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Fehler beim Erstellen')
    }
    setLoading(false)
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: 10,
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' as const,
  }

  const modal = (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0d0f18', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 28, maxWidth: 440, width: '100%', boxShadow: '0 24px 60px rgba(0,0,0,0.7)' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 4 }}>📢 Channel erstellen</h2>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>Nur Admins können schreiben  alle können lesen</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 22, lineHeight: 1 }}>×</button>
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '10px 14px', color: '#fca5a5', fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {/* Name */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Channel Name
          </label>
          <input value={name} onChange={e => onNameChange(e.target.value)} placeholder="z.B. Nokki News" maxLength={64} style={inp} autoFocus />
        </div>

        {/* Handle */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Handle <span style={{ color: 'rgba(255,255,255,0.25)', textTransform: 'none', fontWeight: 400 }}>(nur a-z, 0-9, _)</span>
          </label>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>@</span>
            <input value={handle} onChange={e => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 32))} placeholder="nokki_news" maxLength={32} style={{ ...inp, paddingLeft: 28 }} />
          </div>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 4 }}>
            Channel-Link: lumestack.de/channel/@{handle || 'handle'}
          </p>
        </div>

        {/* Beschreibung */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Beschreibung <span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: 400, textTransform: 'none' }}>(optional)</span>
          </label>
          <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Worum geht es in diesem Channel?" maxLength={300} rows={3} style={{ ...inp, resize: 'none' as const, lineHeight: 1.5 }} />
        </div>

        {/* Öffentlich/Privat */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            {[
              { val: true,  label: '🌐 Öffentlich', desc: 'Jeder kann abonnieren und lesen' },
              { val: false, label: '🔒 Privat',     desc: 'Nur per Einladung beitreten' },
            ].map(opt => (
              <button key={String(opt.val)} onClick={() => setIsPublic(opt.val)} style={{ flex: 1, padding: '10px 14px', borderRadius: 10, cursor: 'pointer', textAlign: 'left' as const, background: isPublic === opt.val ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.04)', border: `1px solid ${isPublic === opt.val ? 'rgba(59,130,246,0.35)' : 'rgba(255,255,255,0.08)'}`, color: isPublic === opt.val ? '#93c5fd' : 'rgba(255,255,255,0.5)', transition: 'all .15s' }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{opt.label}</div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 14 }}>
            Abbrechen
          </button>
          <button onClick={submit} disabled={loading || !name.trim() || handle.length < 3} style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: !loading && name.trim() && handle.length >= 3 ? 'linear-gradient(135deg,#1e40af,#7c3aed)' : 'rgba(255,255,255,0.06)', color: !loading && name.trim() && handle.length >= 3 ? '#fff' : 'rgba(255,255,255,0.3)', cursor: loading || !name.trim() || handle.length < 3 ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 14, opacity: loading ? 0.7 : 1, transition: 'all .15s' }}>
            {loading ? 'Erstellt…' : '📢 Channel erstellen'}
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}