import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import api from '../../services/api'
import { useChatStore } from '../../store/chatStore'
import { useAuthStore } from '../../store/authStore'  // ✅ NEU

interface Identity {
  _id:      string
  type:     'private' | 'work' | 'anonymous'
  uin:      string
  username: string
  avatar?:  string
  isActive: boolean
  isDefault: boolean
}

interface Props {
  onSwitch?: (identity: Identity) => void
}

const TYPE_ICON: Record<string, string> = {
  private:   '🧍',
  work:      '🧑‍💼',
  anonymous: '🕶️',
}

const TYPE_COLOR: Record<string, string> = {
  private:   'linear-gradient(135deg,#1a4a6b,#0d9488)',
  work:      'linear-gradient(135deg,#1e40af,#7c3aed)',
  anonymous: 'linear-gradient(135deg,#2d1b4e,#4a1a6b)',
}

const TYPE_LABEL: Record<string, string> = {
  private:   'Privat',
  work:      'Arbeit',
  anonymous: 'Anonym',
}

export default function IdentitySwitcher({ onSwitch }: Props) {
  const [identities,  setIdentities]  = useState<Identity[]>([])
  const [active,      setActive]      = useState<Identity | null>(null)
  const [open,        setOpen]        = useState(false)
  const [showCreate,  setShowCreate]  = useState(false)
  const [creating,    setCreating]    = useState(false)
  const [newType,     setNewType]     = useState<'private'|'work'|'anonymous'>('work')
  const [newUsername, setNewUsername] = useState('')
  const [newBio,      setNewBio]      = useState('')
  const [error,       setError]       = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const resetForIdentitySwitch = useChatStore(s => s.resetForIdentitySwitch)
  const fetchConversations     = useChatStore(s => s.fetchConversations)
  const setToken               = useAuthStore(s => s.setToken)  // ✅ NEU
  const apiBase = import.meta.env.VITE_API_URL || ''

  useEffect(() => {
    loadIdentities()
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const loadIdentities = async () => {
    try {
      const { data } = await api.get('/api/identities')
      setIdentities(data)
      setActive(data.find((i: Identity) => i.isActive) || data[0] || null)
    } catch (_e) {}
  }

  const switchIdentity = async (id: Identity) => {
    try {
      // ✅ Backend gibt NEUES Token zurück
      const { data } = await api.post(`/api/identities/${id._id}/switch`)
      
      // ✅ WICHTIG: Neues Token speichern (enthält neue activeIdentityId im JWT)
      if (data.token) {
        setToken(data.token, id._id)
      }
      
      // 1. UI sofort aktualisieren
      setActive(id)
      setIdentities(prev => prev.map(i => ({ ...i, isActive: i._id === id._id })))
      setOpen(false)
      
      // 2. Identity in localStorage für useSound/useNotification
      localStorage.setItem('nokki_active_identity', JSON.stringify(id))
      
      // 3. ChatStore komplett zurücksetzen (keine Ghost-Daten)
      resetForIdentitySwitch()
      
      // 4. Neue Conversations für diese Identity laden
      await fetchConversations()
      
      // 5. Event für andere Komponenten
      onSwitch?.(id)
      window.dispatchEvent(new CustomEvent('nokki_identity_switch', { detail: { identity: id } }))
    } catch (_e) {
      console.error('Identity switch error:', _e)
    }
  }

  const createIdentity = async () => {
    if (!newUsername.trim()) { setError('Nutzername erforderlich'); return }
    setCreating(true); setError('')
    try {
      await api.post('/api/identities', { type: newType, username: newUsername.trim(), bio: newBio.trim() })
      await loadIdentities()
      setShowCreate(false)
      setNewUsername(''); setNewBio('')
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Fehler')
    } finally { setCreating(false) }
  }

  if (!active) return null

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Aktive Identität — Button */}
      <button onClick={() => setOpen(o => !o)} style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 8px 4px 4px', borderRadius: 10, cursor: 'pointer',
        background: open ? 'rgba(255,255,255,0.06)' : 'none',
        border: 'none', transition: 'all .15s', width: '100%', textAlign: 'left',
      }}>
        {/* Typ-Badge */}
        <span style={{
          fontSize: 14, width: 22, height: 22, borderRadius: 7,
          background: TYPE_COLOR[active.type],
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>{TYPE_ICON[active.type]}</span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.92)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.2 }}>
            {active.username}
          </p>
          <p style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.3)', lineHeight: 1.2 }}>
            {TYPE_LABEL[active.type]} · #{active.uin}
          </p>
        </div>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', flexShrink: 0 }}>
          {open ? '▲' : '▼'}
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 6,
          background: '#0d0f18', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14, overflow: 'hidden', minWidth: 220,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)', zIndex: 9999,
        }}>
          {/* Identitäten-Liste */}
          {identities.map(id => (
            <button key={id._id} onClick={() => switchIdentity(id)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px', cursor: 'pointer', textAlign: 'left',
              background: id.isActive ? 'rgba(232,184,109,0.08)' : 'transparent',
              border: 'none', borderBottom: '1px solid rgba(255,255,255,0.05)',
              transition: 'background .12s',
            }}
              onMouseEnter={e => { if (!id.isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)' }}
              onMouseLeave={e => { if (!id.isActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <div style={{
                width: 34, height: 34, borderRadius: '50%',
                background: TYPE_COLOR[id.type],
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 15, flexShrink: 0, overflow: 'hidden',
                border: id.isActive ? '2px solid #e8b86d' : '2px solid transparent',
              }}>
                {id.avatar
                  ? <img src={`${apiBase}${id.avatar}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                  : TYPE_ICON[id.type]}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: id.isActive ? 700 : 500, color: id.isActive ? '#e8b86d' : 'rgba(255,255,255,0.85)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {id.username}
                </p>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
                  {TYPE_LABEL[id.type]} · #{id.uin}
                </p>
              </div>
              {id.isActive && <span style={{ fontSize: 12, color: '#e8b86d' }}>✓</span>}
            </button>
          ))}

          {/* Neue Identität */}
          {identities.length < 5 && (
            <button onClick={() => { setShowCreate(true); setOpen(false) }} style={{
              width: '100%', padding: '10px 14px', cursor: 'pointer',
              background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
              fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ fontSize: 16 }}>＋</span> Neue Identität erstellen
            </button>
          )}
        </div>
      )}

      {/* Neue Identität erstellen — Modal */}
      {showCreate && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#0d0f18', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, width: '100%', maxWidth: 400, padding: 24 }}>
            <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 20 }}>Neue Identität erstellen</h3>

            {/* Typ wählen */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 18 }}>
              {(['private','work','anonymous'] as const).map(t => (
                <button key={t} onClick={() => setNewType(t)} style={{
                  padding: '10px 8px', borderRadius: 12, cursor: 'pointer',
                  background: newType === t ? 'rgba(232,184,109,0.1)' : 'rgba(255,255,255,0.04)',
                  border: newType === t ? '1px solid rgba(232,184,109,0.3)' : '1px solid rgba(255,255,255,0.08)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                }}>
                  <span style={{ fontSize: 20 }}>{TYPE_ICON[t]}</span>
                  <span style={{ fontSize: 11, color: newType === t ? '#e8b86d' : 'rgba(255,255,255,0.5)', fontWeight: newType === t ? 600 : 400 }}>{TYPE_LABEL[t]}</span>
                </button>
              ))}
            </div>

            {/* Typ-Erklärung */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 12px', marginBottom: 16, fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
              {newType === 'private' && '🧍 Privat — für Freunde & Familie. Voller Zugriff auf alle Features.'}
              {newType === 'work' && '🧑‍💼 Arbeit — für Kunden & Kollegen. Auto-Antwort und Erreichbarkeitszeiten.'}
              {newType === 'anonymous' && '🕶️ Anonym — kein Bezug zum echten Account. Limitierte neue Chats pro Tag.'}
            </div>

            {/* Username */}
            <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Nutzername *</label>
            <input value={newUsername} onChange={e => setNewUsername(e.target.value)} maxLength={30}
              style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '9px 13px', fontSize: 13, color: 'white', outline: 'none', boxSizing: 'border-box' as const, marginBottom: 14 }}
              placeholder={newType === 'anonymous' ? 'ShadowUser42' : newType === 'work' ? 'Max Müller (Support)' : 'Max'} />

            {/* Bio */}
            <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Bio (optional)</label>
            <textarea value={newBio} onChange={e => setNewBio(e.target.value)} rows={2} maxLength={200}
              style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '9px 13px', fontSize: 13, color: 'white', outline: 'none', resize: 'none' as const, boxSizing: 'border-box' as const, marginBottom: 16 }}
              placeholder="Kurze Beschreibung..." />

            {error && <p style={{ color: '#f87171', fontSize: 12, marginBottom: 12 }}>{error}</p>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setShowCreate(false); setError('') }} style={{
                flex: 1, padding: '10px', borderRadius: 11, cursor: 'pointer',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.6)', fontSize: 13,
              }}>Abbrechen</button>
              <button onClick={createIdentity} disabled={creating} style={{
                flex: 2, padding: '10px', borderRadius: 11, cursor: 'pointer',
                background: 'linear-gradient(135deg,#b46a0e,#e8b86d)', border: 'none',
                color: '#fff', fontSize: 13, fontWeight: 700, opacity: creating ? 0.6 : 1,
              }}>{creating ? 'Erstelle…' : `${TYPE_ICON[newType]} Identität erstellen`}</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}