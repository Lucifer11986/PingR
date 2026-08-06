import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import api from '../../services/api'
import { useChatStore } from '../../store/chatStore'
import type { Conversation } from '../../types'

interface Props {
  conversation:  Conversation
  currentUserId: string
  onClose:       () => void
}

export default function GroupSettings({ conversation, currentUserId, onClose }: Props) {
  const { fetchConversations, setActiveConversation } = useChatStore()
  const apiBase = import.meta.env.VITE_API_URL || ''

  // ── Einstellungs-State ───────────────────────────────────────────────────
  const [groupName,       setGroupName]       = useState(conversation.groupName || '')
  const [description,     setDescription]     = useState((conversation as any).description || '')
  const [isPublic,        setIsPublic]        = useState(conversation.isPublic || false)
  const [adminOnly,       setAdminOnly]       = useState((conversation as any).adminOnly || false)
  const [slowMode,        setSlowMode]        = useState<number>((conversation as any).slowMode || 0)
  const [maxMembers,      setMaxMembers]      = useState<number>((conversation as any).maxMembers || 100)
  const [requireApproval, setRequireApproval] = useState((conversation as any).requireApproval || false)

  // ── UI State ─────────────────────────────────────────────────────────────
  const [saving,        setSaving]        = useState(false)
  const [saved,         setSaved]         = useState(false)
  const [error,         setError]         = useState('')
  const [copied,        setCopied]        = useState(false)
  const [showQR,        setShowQR]        = useState(false)
  const [avatarPreview, setAvatarPreview] = useState<string|null>(null)
  const [activeTab,     setActiveTab]     = useState<'settings'|'members'|'danger'>('settings')
  const [clearing,      setClearing]      = useState(false)
  const [deleting,      setDeleting]      = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [addSearch,     setAddSearch]     = useState('')
  const [addResults,    setAddResults]    = useState<any[]>([])
  const [addLoading,    setAddLoading]    = useState(false)
  const [muteDuration,  setMuteDuration]  = useState<Record<string, number>>({})

  const avatarRef   = useRef<HTMLInputElement>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout>>()

  // ── Admin-Check ──────────────────────────────────────────────────────────
  const admins  = conversation.admins || []
  const isAdmin = admins.length === 0
    ? conversation.participants[0]?._id === currentUserId
    : admins.some(a => {
        const id = typeof a === 'string' ? a : (a as any)?._id?.toString?.() ?? String(a)
        return id === currentUserId
      })

  const joinLink = (conversation as any).joinCode
    ? `${window.location.origin}/join/${(conversation as any).joinCode}`
    : null

  // ── Handler ──────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setError(''); setSaving(true)
    const payload = { groupName, description, isPublic, adminOnly, slowMode, maxMembers, requireApproval }
    try {
      try {
        await api.patch(`/api/conversations/${conversation._id}/settings`, payload)
      } catch (e1: any) {
        if (e1?.response?.status === 404) {
          await api.patch(`/api/conversations/${conversation._id}`, payload)
        } else { throw e1 }
      }
      await fetchConversations()
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || ''
      setError('Fehler beim Speichern.' + (msg ? ' (' + msg + ')' : ''))
      console.error('[GroupSettings] save:', err?.response?.status, msg)
    } finally { setSaving(false) }
  }

  const handleKick = async (userId: string, username: string) => {
    if (!confirm(`${username} aus der Gruppe entfernen?`)) return
    try { await api.post(`/api/conversations/${conversation._id}/kick`, { userId }); await fetchConversations() }
    catch (_err) { alert('Fehler.') }
  }

  const handlePromote = async (userId: string, username: string) => {
    if (!confirm(`${username} zum Admin befördern?`)) return
    try { await api.post(`/api/conversations/${conversation._id}/promote`, { userId }); await fetchConversations() }
    catch (_err) { alert('Fehler.') }
  }

  const handleDemote = async (userId: string, username: string) => {
    if (!confirm(`${username} als Admin entfernen?`)) return
    try { await api.post(`/api/conversations/${conversation._id}/demote`, { userId }); await fetchConversations() }
    catch (_err) { alert('Fehler.') }
  }

  const handleMute = async (userId: string, username: string, minutes: number) => {
    if (!minutes) return
    if (!confirm(`${username} für ${minutes} Minute(n) stummschalten?`)) return
    try { await api.post(`/api/conversations/${conversation._id}/mute`, { userId, minutes }); await fetchConversations() }
    catch (_err) { alert('Fehler.') }
  }

  const handleLeave = async () => {
    if (!confirm('Gruppe wirklich verlassen?')) return
    try {
      await api.delete(`/api/conversations/${conversation._id}/leave`)
      await fetchConversations(); setActiveConversation(null); onClose()
    } catch (_err) { alert('Fehler.') }
  }

  const handleClearMessages = async () => {
    if (!confirm('Wirklich ALLE Nachrichten löschen? Nicht rückgängig!')) return
    setClearing(true)
    try { await api.delete(`/api/conversations/${conversation._id}/messages`); await fetchConversations(); alert('Chat geleert.') }
    catch (_err) { alert('Fehler.') }
    finally { setClearing(false) }
  }

  const handleDeleteGroup = async () => {
    if (deleteConfirm !== conversation.groupName) { setError('Gruppenname stimmt nicht.'); return }
    setDeleting(true)
    try { await api.delete(`/api/conversations/${conversation._id}`); await fetchConversations(); setActiveConversation(null); onClose() }
    catch (_err) { alert('Fehler.') }
    finally { setDeleting(false) }
  }

  const copyLink = () => {
    if (!joinLink) return
    navigator.clipboard.writeText(joinLink).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    if (!file.type.startsWith('image/')) { alert('Nur Bilder'); return }
    if (file.size > 5 * 1024 * 1024) { alert('Max. 5 MB'); return }
    setAvatarPreview(URL.createObjectURL(file))
    const form = new FormData(); form.append('avatar', file)
    try { await api.patch(`/api/conversations/${conversation._id}/avatar`, form, { headers: { 'Content-Type': 'multipart/form-data' } }) }
    catch (_err) { alert('Fehler beim Hochladen') }
  }

  const handleAddSearch = (q: string) => {
    setAddSearch(q); clearTimeout(searchTimer.current)
    if (!q.trim()) { setAddResults([]); return }
    setAddLoading(true)
    searchTimer.current = setTimeout(async () => {
      try {
        const { data } = await api.get(`/api/users/search?q=${encodeURIComponent(q)}`)
        const memberIds = conversation.participants.map((p: any) => p._id || p)
        setAddResults((data.users || data || []).filter((u: any) => !memberIds.includes(u._id)))
      } catch (_e) { setAddResults([]) }
      finally { setAddLoading(false) }
    }, 400)
  }

  const handleAddMember = async (userId: string, username: string) => {
    try {
      await api.post(`/api/conversations/${conversation._id}/add`, { userId })
      await fetchConversations(); setAddSearch(''); setAddResults([])
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Fehler'
      alert('Fehler beim Hinzufügen: ' + msg)
    }
  }

  // ── Styles ───────────────────────────────────────────────────────────────
  const S = {
    overlay:   { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
    modal:     { background: '#0d0f18', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, width: '100%', maxWidth: 540, boxShadow: '0 25px 60px rgba(0,0,0,0.7)', overflow: 'hidden', display: 'flex', flexDirection: 'column' as const, maxHeight: '90vh' },
    header:    { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 },
    tabBtn:    (active: boolean, danger?: boolean): React.CSSProperties => ({ flex: 1, padding: '10px', fontSize: 12, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', color: active ? (danger ? '#f87171' : '#e8b86d') : 'rgba(255,255,255,0.35)', borderBottom: active ? `2px solid ${danger ? '#f87171' : '#e8b86d'}` : '2px solid transparent' }),
    input:     { width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '9px 13px', fontSize: 13, color: 'white', outline: 'none', boxSizing: 'border-box' as const },
    secLabel:  { fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 8 },
    card:      { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '10px 14px' } as React.CSSProperties,
    toggle:    (on: boolean): React.CSSProperties => ({ width: 38, height: 22, borderRadius: 99, cursor: 'pointer', border: 'none', background: on ? 'rgba(232,184,109,0.8)' : 'rgba(255,255,255,0.12)', position: 'relative', flexShrink: 0, transition: 'background .2s' }),
    toggleDot: (on: boolean): React.CSSProperties => ({ position: 'absolute', top: 3, left: on ? 19 : 3, width: 16, height: 16, borderRadius: '50%', background: 'white', transition: 'left .2s' }),
    select:    { background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '9px 13px', fontSize: 13, color: 'white', outline: 'none', colorScheme: 'dark' as const, width: '100%' } as React.CSSProperties,
  }

  const Toggle = ({ on, onToggle }: { on: boolean; onToggle: () => void }) => (
    <button style={S.toggle(on)} onClick={onToggle} type="button"><span style={S.toggleDot(on)} /></button>
  )

  const modal = (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={S.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ position: 'relative', cursor: isAdmin ? 'pointer' : 'default' }} onClick={() => isAdmin && avatarRef.current?.click()}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#4a1a6b,#b46a0e)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#fff' }}>
                {avatarPreview ? <img src={avatarPreview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                  : (conversation as any).groupAvatar ? <img src={`${apiBase}${(conversation as any).groupAvatar}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                  : (conversation.groupName || 'G')[0].toUpperCase()}
              </div>
              {isAdmin && <div style={{ position: 'absolute', bottom: -3, right: -3, width: 18, height: 18, borderRadius: '50%', background: 'linear-gradient(135deg,#b46a0e,#e8b86d)', border: '2px solid #0d0f18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9 }}>📷</div>}
              <input ref={avatarRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
            </div>
            <div>
              <p style={{ fontWeight: 700, fontSize: 14, color: 'rgba(255,255,255,0.9)' }}>{conversation.groupName}</p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                {conversation.participants.length} Mitglieder
                {isPublic  && <span style={{ marginLeft: 6, color: '#e8b86d' }}>🌐 Öffentlich</span>}
                {adminOnly && <span style={{ marginLeft: 6, color: '#a78bfa' }}>🛡️ Admin-only</span>}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontSize: 18, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8 }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
          <button style={S.tabBtn(activeTab === 'settings')} onClick={() => setActiveTab('settings')}>⚙️ Einstellungen</button>
          <button style={S.tabBtn(activeTab === 'members')}  onClick={() => setActiveTab('members')}>👥 Mitglieder ({conversation.participants.length})</button>
          {isAdmin && <button style={S.tabBtn(activeTab === 'danger', true)} onClick={() => setActiveTab('danger')}>⚠️ Gefahrenzone</button>}
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>

          {/* ── EINSTELLUNGEN TAB ── */}
          {activeTab === 'settings' && (
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Einladungslink + QR */}
              <div>
                <p style={S.secLabel}>📋 Einladungslink</p>
                {joinLink ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ ...S.card, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <p style={{ fontSize: 12, color: '#93c5fd', fontFamily: 'monospace', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{joinLink}</p>
                      <button onClick={() => setShowQR(q => !q)} style={{ fontSize: 11, padding: '5px 10px', borderRadius: 8, cursor: 'pointer', flexShrink: 0, background: showQR ? 'rgba(232,184,109,0.2)' : 'rgba(255,255,255,0.06)', border: showQR ? '1px solid rgba(232,184,109,0.4)' : '1px solid rgba(255,255,255,0.1)', color: showQR ? '#e8b86d' : 'rgba(255,255,255,0.5)' }}>📱 QR</button>
                      <button onClick={copyLink} style={{ fontSize: 11, padding: '5px 12px', borderRadius: 8, cursor: 'pointer', flexShrink: 0, background: copied ? 'rgba(34,197,94,0.15)' : 'rgba(232,184,109,0.12)', border: copied ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(232,184,109,0.25)', color: copied ? '#4ade80' : '#e8b86d' }}>
                        {copied ? '✓ Kopiert!' : '📋 Kopieren'}
                      </button>
                    </div>
                    {showQR && (
                      <div style={{ ...S.card, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: 16 }}>
                        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(joinLink)}&bgcolor=13131f&color=e8b86d&qzone=2`} alt="QR-Code" style={{ width: 180, height: 180, borderRadius: 12 }} />
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textAlign: 'center' }}>QR-Code scannen um der Gruppe beizutreten</p>
                        <button onClick={() => { const a = document.createElement('a'); a.href = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(joinLink)}&bgcolor=13131f&color=e8b86d&qzone=2`; a.download = `nokki-${conversation.groupName || 'gruppe'}-qr.png`; a.click() }} style={{ fontSize: 11, padding: '5px 14px', borderRadius: 8, cursor: 'pointer', background: 'rgba(232,184,109,0.1)', border: '1px solid rgba(232,184,109,0.25)', color: '#e8b86d' }}>⬇️ QR herunterladen</button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ ...S.card, fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.7 }}>
                      {isAdmin
                        ? '🔒 Private Gruppe – Mitglieder können nur direkt hinzugefügt werden.'
                        : 'Kein Einladungslink (private Gruppe)'}
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => setActiveTab('members')}
                        style={{ padding: '8px 14px', borderRadius: 10, cursor: 'pointer', background: 'rgba(232,184,109,0.08)', border: '1px solid rgba(232,184,109,0.2)', color: '#e8b86d', fontSize: 12, fontWeight: 600, textAlign: 'left' as const }}
                      >
                        👥 Mitglieder-Tab öffnen um Leute hinzuzufügen →
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Admin-Einstellungen */}
              {isAdmin ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <p style={S.secLabel}>🛡️ Gruppeneinstellungen</p>

                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>Gruppenname</label>
                    <input value={groupName} onChange={e => setGroupName(e.target.value)} style={S.input} placeholder="Gruppenname…" maxLength={50} />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>📝 Beschreibung</label>
                    <textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={300} rows={3} placeholder="Worum geht es in dieser Gruppe…" style={{ ...S.input, resize: 'none', lineHeight: 1.5 }} />
                    <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 3, textAlign: 'right' }}>{description.length}/300</p>
                  </div>

                  {[
                    { label: '🌐 Öffentliche Gruppe',          sub: 'Jeder mit dem Link kann beitreten',     value: isPublic,        set: setIsPublic },
                    { label: '🛡️ Nur Admins dürfen schreiben', sub: 'Mitglieder können nur lesen',           value: adminOnly,       set: setAdminOnly },
                    { label: '✋ Beitritt bestätigen',          sub: 'Admin muss neue Mitglieder genehmigen', value: requireApproval, set: setRequireApproval },
                  ].map(({ label, sub, value, set }) => (
                    <label key={label} style={{ display: 'flex', alignItems: 'center', gap: 12, ...S.card, cursor: 'pointer' }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>{label}</p>
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{sub}</p>
                      </div>
                      <Toggle on={value} onToggle={() => set(!value)} />
                    </label>
                  ))}

                  <div style={S.card}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: slowMode > 0 ? 8 : 0 }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>🐌 Slow Mode</p>
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>Cooldown zwischen Nachrichten pro Nutzer</p>
                      </div>
                      <Toggle on={slowMode > 0} onToggle={() => setSlowMode(slowMode > 0 ? 0 : 30)} />
                    </div>
                    {slowMode > 0 && (
                      <select value={slowMode} onChange={e => setSlowMode(Number(e.target.value))} style={S.select}>
                        <option value={10}>10 Sekunden</option>
                        <option value={30}>30 Sekunden</option>
                        <option value={60}>1 Minute</option>
                        <option value={300}>5 Minuten</option>
                        <option value={600}>10 Minuten</option>
                        <option value={3600}>1 Stunde</option>
                      </select>
                    )}
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>👥 Max. Mitglieder</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <input type="number" min={2} max={500} value={maxMembers} onChange={e => setMaxMembers(Math.min(500, Math.max(2, Number(e.target.value))))} style={{ ...S.input, width: 100 }} />
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>max. 500</span>
                    </div>
                  </div>

                  {error && <p style={{ color: '#f87171', fontSize: 12 }}>{error}</p>}
                  <button onClick={handleSave} disabled={saving} style={{ width: '100%', padding: '11px', border: 'none', borderRadius: 12, cursor: 'pointer', background: saved ? 'rgba(34,197,94,0.2)' : 'linear-gradient(135deg,#b46a0e,#e8b86d)', color: saved ? '#4ade80' : '#fff', fontWeight: 700, fontSize: 14, opacity: saving ? 0.6 : 1 }}>
                    {saving ? 'Speichere…' : saved ? '✓ Gespeichert!' : '💾 Speichern'}
                  </button>
                </div>
              ) : (
                <div>
                  {description && (
                    <div style={{ ...S.card, marginBottom: 12 }}>
                      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Beschreibung</p>
                      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6 }}>{description}</p>
                    </div>
                  )}
                  <div style={{ ...S.card, fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>Nur Admins können die Gruppeneinstellungen bearbeiten.</div>
                </div>
              )}

              <button onClick={handleLeave} style={{ width: '100%', padding: '10px', borderRadius: 12, cursor: 'pointer', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', fontSize: 13, fontWeight: 500 }}>
                🚪 Gruppe verlassen
              </button>
            </div>
          )}

          {/* ── MITGLIEDER TAB ── */}
          {activeTab === 'members' && (
            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {isAdmin && (
                <div style={{ marginBottom: 8 }}>
                  <p style={{ ...S.secLabel, paddingLeft: 10 }}>➕ Mitglied hinzufügen</p>
                  <div style={{ position: 'relative' }}>
                    <input value={addSearch} onChange={e => handleAddSearch(e.target.value)} placeholder="Nutzername oder UIN suchen…" style={{ ...S.input, marginBottom: addResults.length > 0 ? 4 : 0 }} />
                    {addLoading && <span style={{ position: 'absolute', right: 12, top: 10, fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>…</span>}
                  </div>
                  {addResults.length > 0 && (
                    <div style={{ background: '#13131f', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, overflow: 'hidden', marginBottom: 8 }}>
                      {addResults.map((u: any) => (
                        <div key={u._id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg,#1a4a6b,#0d9488)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{u.username?.[0]?.toUpperCase()}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 13, fontWeight: 500 }}>{u.username}</p>
                            <p style={{ fontSize: 10, color: '#e8b86d', fontFamily: 'monospace', opacity: 0.6 }}>#{u.uin}</p>
                          </div>
                          <button onClick={() => handleAddMember(u._id, u.username)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 7, background: 'rgba(232,184,109,0.12)', border: '1px solid rgba(232,184,109,0.25)', color: '#e8b86d', cursor: 'pointer' }}>Hinzufügen</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}


              {/* 🤖 BOTS ANZEIGEN */}
              {(conversation.bots || []).map((bot: any) => {
                const botId = bot._id || bot
                const botName = bot.name || 'Bot'
                const botUsername = bot.botId || ''
                return (
                  <div key={botId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 12, background: 'rgba(232,184,109,0.05)', border: '1px solid rgba(232,184,109,0.1)' }}>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#b46a0e,#e8b86d)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                        🤖
                      </div>
                      <span style={{ position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: '50%', border: '2px solid #08090f', background: bot.status === 'active' ? '#4ade80' : 'rgba(255,255,255,0.2)' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <p style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.85)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{botName}</p>
                        <span style={{ fontSize: 10, background: 'rgba(232,184,109,0.12)', color: '#e8b86d', border: '1px solid rgba(232,184,109,0.25)', borderRadius: 99, padding: '1px 7px' }}>🤖 Bot</span>
                      </div>
                      {botUsername && <p style={{ fontSize: 11, color: '#e8b86d', opacity: 0.5, fontFamily: 'monospace' }}>{botUsername}</p>}
                    </div>
                  </div>
                )
              })}

              {conversation.participants.map((p: any) => {
                const pid      = p._id || p
                const pname    = p.username || '?'
                const puin     = p.uin || ''
                const isMe     = pid === currentUserId
                const pIsAdmin = admins.some(a => (typeof a === 'string' ? a : (a as any)._id?.toString?.()) === pid)
                const isMuted  = (p as any).mutedUntil && new Date((p as any).mutedUntil) > new Date()
                return (
                  <div key={pid} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 12, background: 'rgba(255,255,255,0.02)' }}>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#1a4a6b,#0d9488)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff' }}>
                        {p.avatar ? <img src={`${apiBase}${p.avatar}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : pname[0]?.toUpperCase()}
                      </div>
                      <span style={{ position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: '50%', border: '2px solid #08090f', background: p.status === 'online' ? '#4ade80' : p.status === 'away' ? '#fbbf24' : 'rgba(255,255,255,0.2)' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <p style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.85)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pname}</p>
                        {isMe     && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>(du)</span>}
                        {pIsAdmin && <span style={{ fontSize: 10, background: 'rgba(232,184,109,0.12)', color: '#e8b86d', border: '1px solid rgba(232,184,109,0.25)', borderRadius: 99, padding: '1px 7px' }}>Admin</span>}
                        {isMuted  && <span style={{ fontSize: 10, background: 'rgba(156,163,175,0.12)', color: '#9ca3af', border: '1px solid rgba(156,163,175,0.2)', borderRadius: 99, padding: '1px 7px' }}>🔇 Stumm</span>}
                      </div>
                      {puin && <p style={{ fontSize: 11, color: '#e8b86d', opacity: 0.5, fontFamily: 'monospace' }}>#{puin}</p>}
                    </div>
                    {isAdmin && !isMe && (
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        {!pIsAdmin
                          ? <button onClick={() => handlePromote(pid, pname)} title="Zum Admin befördern" style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(232,184,109,0.1)', border: '1px solid rgba(232,184,109,0.2)', color: '#e8b86d', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⭐</button>
                          : <button onClick={() => handleDemote(pid, pname)} title="Admin entfernen"     style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(232,184,109,0.06)', border: '1px solid rgba(232,184,109,0.15)', color: 'rgba(232,184,109,0.5)', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>👑</button>
                        }
                        <select value={muteDuration[pid] || 0} onChange={e => { const m = Number(e.target.value); setMuteDuration(d => ({ ...d, [pid]: m })); if (m > 0) handleMute(pid, pname, m) }} title="Stummschalten" style={{ height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 11, outline: 'none', padding: '0 4px', colorScheme: 'dark' as const }}>
                          <option value={0}>🔇</option>
                          <option value={5}>5 Min</option>
                          <option value={30}>30 Min</option>
                          <option value={60}>1 Std</option>
                          <option value={1440}>24 Std</option>
                          <option value={10080}>7 Tage</option>
                        </select>
                        <button onClick={() => handleKick(pid, pname)} title="Entfernen" style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* ── GEFAHRENZONE TAB ── */}
          {activeTab === 'danger' && isAdmin && (
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 12, padding: '12px 14px', fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.7 }}>
                ⚠️ Aktionen hier können <strong style={{ color: '#f87171' }}>nicht rückgängig</strong> gemacht werden.
              </div>

              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '14px 16px' }}>
                <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>🗑️ Chat leeren</p>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 12, lineHeight: 1.6 }}>Löscht alle Nachrichten. Mitglieder bleiben erhalten.</p>
                <button onClick={handleClearMessages} disabled={clearing} style={{ padding: '9px 16px', borderRadius: 10, cursor: 'pointer', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', fontSize: 13, fontWeight: 500, opacity: clearing ? 0.5 : 1 }}>
                  {clearing ? 'Leere…' : '🗑️ Alle Nachrichten löschen'}
                </button>
              </div>

              <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '14px 16px' }}>
                <p style={{ fontWeight: 600, fontSize: 13, color: '#f87171', marginBottom: 4 }}>❌ Gruppe löschen</p>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 12, lineHeight: 1.6 }}>Löscht die Gruppe und alle Nachrichten permanent.</p>
                <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>
                  Tippe <strong style={{ color: '#f87171' }}>{conversation.groupName}</strong> zur Bestätigung:
                </label>
                <input value={deleteConfirm} onChange={e => { setDeleteConfirm(e.target.value); setError('') }} placeholder={conversation.groupName} style={{ ...S.input, borderColor: 'rgba(239,68,68,0.2)', marginBottom: 10 }} />
                {error && <p style={{ color: '#f87171', fontSize: 12, marginBottom: 8 }}>{error}</p>}
                <button onClick={handleDeleteGroup} disabled={deleting || deleteConfirm !== conversation.groupName} style={{ padding: '9px 16px', borderRadius: 10, cursor: 'pointer', background: deleteConfirm === conversation.groupName ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.04)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', fontSize: 13, fontWeight: 600, opacity: (deleting || deleteConfirm !== conversation.groupName) ? 0.4 : 1 }}>
                  {deleting ? 'Lösche…' : '❌ Gruppe endgültig löschen'}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
