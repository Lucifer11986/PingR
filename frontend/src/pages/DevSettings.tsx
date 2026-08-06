import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import DevSidebar from './DevSidebar'
import { devFetch, logoutDevSession } from '../services/devApi'

const token = () => localStorage.getItem('nokki_dev_token') || ''

const DevSettings: React.FC = () => {
  const navigate = useNavigate()
  const [username, setUsername]               = useState('')
  const [email, setEmail]                     = useState('')
  const [emailVerified, setEmailVerified]     = useState(false)
  const [currentPw, setCurrentPw]             = useState('')
  const [newPw, setNewPw]                     = useState('')
  const [confirmPw, setConfirmPw]             = useState('')
  const [notifApiErrors, setNotifApiErrors]   = useState(true)
  const [notifInstalls, setNotifInstalls]     = useState(true)
  const [notifWeekly, setNotifWeekly]         = useState(false)
  const [saving, setSaving]                   = useState(false)
  const [savingPw, setSavingPw]               = useState(false)
  const [loading, setLoading]                 = useState(true)
  const [toast, setToast]                     = useState('')

  useEffect(() => { loadProfile() }, [])

  const showToast = (msg: string) => {
    setToast(msg); setTimeout(() => setToast(''), 3000)
  }

  const loadProfile = async () => {
    setLoading(true)
    try {
      const r = await devFetch('/api/dev/auth/me', { headers: { Authorization: `Bearer ${token()}` } })
      const d = await r.json()
      if (d.user) {
        setUsername(d.user.username || ''); setEmail(d.user.email || '')
        setEmailVerified(d.user.emailVerified === true)
        setNotifApiErrors(d.user.notifications?.apiErrors ?? true)
        setNotifInstalls(d.user.notifications?.installs ?? true)
        setNotifWeekly(d.user.notifications?.weekly ?? false)
      }
    } catch {} finally { setLoading(false) }
  }

  const saveProfile = async () => {
    setSaving(true)
    try {
      const r = await devFetch('/api/dev/auth/me', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email })
      })
      if (r.ok) { const d = await r.json(); setEmailVerified(d.user?.emailVerified === true); showToast('✅ Profil gespeichert!') }
      else { const d = await r.json(); showToast('❌ ' + (d.error || 'Fehler')) }
    } catch { showToast('❌ Verbindungsfehler') } finally { setSaving(false) }
  }

  const changePassword = async () => {
    if (!currentPw || !newPw) { showToast('❌ Alle Felder ausfüllen'); return }
    if (newPw !== confirmPw) { showToast('❌ Passwörter stimmen nicht überein'); return }
    if (newPw.length < 10) { showToast('❌ Mindestens 10 Zeichen'); return }
    setSavingPw(true)
    try {
      const r = await devFetch('/api/dev/auth/change-password', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw })
      })
      if (r.ok) { await logoutDevSession(); navigate('/dev-login'); return }
      else { const d = await r.json(); showToast('❌ ' + (d.error || 'Falsches Passwort')) }
    } catch { showToast('❌ Verbindungsfehler') } finally { setSavingPw(false) }
  }

  const logout = async () => { await logoutDevSession(); navigate('/dev-login') }

  const resendVerification = async () => {
    const r = await devFetch('/api/dev/auth/resend-verification', { method: 'POST' })
    const d = await r.json()
    showToast(r.ok ? `✅ ${d.message}` : `❌ ${d.error || 'Versand fehlgeschlagen'}`)
  }

  const saveNotifications = async () => {
    try {
      const r = await devFetch('/api/dev/auth/notifications', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiErrors: notifApiErrors, installs: notifInstalls, weekly: notifWeekly })
      })
      const d = await r.json()
      showToast(r.ok ? '✅ Benachrichtigungen gespeichert!' : `❌ ${d.error || 'Fehler'}`)
    } catch { showToast('❌ Verbindungsfehler') }
  }

  const deleteAccount = async () => {
    if (!confirm('Account wirklich löschen?\n\nAlle Bots und Daten werden dauerhaft gelöscht!')) return
    if (!confirm('LETZTE WARNUNG: Diese Aktion kann nicht rückgängig gemacht werden!')) return
    try {
      const r = await devFetch('/api/dev/auth/delete', { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } })
      if (!r.ok) { const d = await r.json(); showToast('❌ ' + (d.error || 'Fehler beim Löschen')); return }
      localStorage.removeItem('nokki_dev_token'); navigate('/dev-login')
    } catch { showToast('❌ Fehler beim Löschen') }
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: '8px',
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
    color: '#f1f0f8', fontSize: '14px', outline: 'none', boxSizing: 'border-box'
  }
  const card: React.CSSProperties = {
    background: '#0d0f18', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '14px', padding: '24px', marginBottom: '20px'
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#08090f', color: '#f1f0f8' }}>
      <DevSidebar active="settings" />

      <div style={{ flex: 1, padding: '32px', overflowY: 'auto', maxHeight: '100vh' }}>

        {/* Header */}
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 900, marginBottom: '4px' }}>Einstellungen</h1>
          <p style={{ color: '#8b8aa8', fontSize: '14px' }}>Verwalte deinen Account und Benachrichtigungen</p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#8b8aa8' }}>
            <div style={{ width: '36px', height: '36px', border: '3px solid #b46a0e', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            Lade Einstellungen...
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: '20px', alignItems: 'start' }}>

            {/* Linke Spalte */}
            <div>
              {/* Profil */}
              <div style={card}>
                <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '20px' }}>Profil</h2>
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#8b8aa8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Username</label>
                  <input value={username} onChange={e => setUsername(e.target.value)} style={inp} />
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#8b8aa8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>E-Mail</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={inp} />
                  <div style={{fontSize:12,marginTop:7,color:emailVerified?'#86efac':'#fbbf24'}}>{emailVerified?'✓ E-Mail bestätigt':'E-Mail noch nicht bestätigt'}</div>
                </div>
                <button onClick={saveProfile} disabled={saving} style={{ padding: '10px 22px', borderRadius: '8px', background: 'linear-gradient(135deg,#b46a0e,#e8b86d)', border: 'none', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '13px', opacity: saving ? 0.7 : 1 }}>
                  {saving ? 'Speichert...' : 'Profil speichern'}
                </button>
                {!emailVerified && <button onClick={resendVerification} style={{marginLeft:8,padding:'10px 16px',borderRadius:8,background:'rgba(245,158,11,.08)',border:'1px solid rgba(245,158,11,.25)',color:'#fbbf24',cursor:'pointer'}}>Bestätigung erneut senden</button>}
              </div>

              {/* Passwort */}
              <div style={card}>
                <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '20px' }}>Passwort ändern</h2>
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#8b8aa8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Aktuelles Passwort</label>
                  <input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} placeholder="••••••••" style={inp} />
                </div>
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#8b8aa8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Neues Passwort</label>
                  <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Mindestens 10 Zeichen" style={inp} />
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#8b8aa8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Passwort bestätigen</label>
                  <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="••••••••" style={{ ...inp, borderColor: confirmPw && confirmPw !== newPw ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.1)' }} />
                  {confirmPw && confirmPw !== newPw && <div style={{ fontSize: '12px', color: '#f87171', marginTop: '4px' }}>Passwörter stimmen nicht überein</div>}
                </div>
                <button onClick={changePassword} disabled={savingPw} style={{ padding: '10px 22px', borderRadius: '8px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', color: '#93c5fd', cursor: savingPw ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '13px', opacity: savingPw ? 0.7 : 1 }}>
                  {savingPw ? 'Ändert...' : 'Passwort ändern'}
                </button>
              </div>
            </div>

            {/* Rechte Spalte */}
            <div>
              {/* Benachrichtigungen */}
              <div style={card}>
                <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '20px' }}>Benachrichtigungen</h2>
                <div style={{ display: 'grid', gap: '10px', marginBottom: '20px' }}>
                  {[
                    { label: 'API Fehler', desc: 'Bei Rate-Limit oder API-Fehlern benachrichtigen', checked: notifApiErrors, set: setNotifApiErrors },
                    { label: 'Bot Installationen', desc: 'Wenn jemand deinen Bot in einer Gruppe installiert', checked: notifInstalls, set: setNotifInstalls },
                    { label: 'Wöchentlicher Report', desc: 'Bot-Performance Zusammenfassung jeden Montag', checked: notifWeekly, set: setNotifWeekly },
                  ].map((n, i) => (
                    <label key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', padding: '14px', borderRadius: '10px', cursor: 'pointer', background: n.checked ? 'rgba(232,184,109,0.06)' : 'rgba(255,255,255,0.02)', border: `1px solid ${n.checked ? 'rgba(232,184,109,0.2)' : 'rgba(255,255,255,0.06)'}`, transition: 'all 0.15s' }}>
                      <input type="checkbox" checked={n.checked} onChange={e => n.set(e.target.checked)} style={{ marginTop: '2px', accentColor: '#e8b86d', cursor: 'pointer' }} />
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '3px', color: n.checked ? '#e8b86d' : '#f1f0f8' }}>{n.label}</div>
                        <div style={{ fontSize: '12px', color: '#8b8aa8', lineHeight: 1.5 }}>{n.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
                <button onClick={saveNotifications} style={{ padding: '10px 22px', borderRadius: '8px', background: 'linear-gradient(135deg,#b46a0e,#e8b86d)', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
                  Einstellungen speichern
                </button>
              </div>

              {/* Sicherheit */}
              <div style={card}>
                <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '20px' }}>Sicherheit & Session</h2>
                <div style={{ display: 'grid', gap: '10px' }}>
                  <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Aktuelle Session</div>
                    <div style={{ fontSize: '12px', color: '#8b8aa8', marginBottom: '12px' }}>Du bist aktuell eingeloggt. Beim Abmelden musst du dich neu einloggen.</div>
                    <button onClick={logout} style={{ padding: '8px 16px', borderRadius: '7px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', color: '#93c5fd', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
                      Abmelden
                    </button>
                  </div>
                </div>
              </div>

              {/* Danger Zone */}
              <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '14px', padding: '24px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px', color: '#ef4444' }}>Danger Zone</h2>
                <p style={{ color: '#8b8aa8', marginBottom: '16px', fontSize: '13px', lineHeight: 1.6 }}>
                  Das Löschen deines Accounts ist unwiderruflich. Alle Bots, API Keys und Daten werden dauerhaft entfernt.
                </p>
                <button onClick={deleteAccount} style={{ padding: '9px 18px', borderRadius: '7px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#f87171', cursor: 'pointer', fontWeight: 700, fontSize: '13px' }}>
                  Account löschen
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '12px 20px', fontSize: '13px', zIndex: 9999, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
          {toast}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

export default DevSettings
