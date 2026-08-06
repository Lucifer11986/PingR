import React, { useState, useRef, useEffect } from 'react'

function useIsMobile() {
  const [m, setM] = useState(typeof window !== 'undefined' && window.innerWidth < 768)
  useEffect(() => {
    const h = () => setM(window.innerWidth < 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])
  return m
}
import SoundSettings from '../components/SoundSettings/SoundSettings'
import AvailabilitySettings from '../components/AvailabilitySettings/AvailabilitySettings'
import LegacyClaimForm from '../components/LegacyClaim/LegacyClaimForm'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useSound } from '../hooks/useSound'
import api from '../services/api'
import { useThemeStore, applyTheme } from '../store/themeStore'
import { generateKeyPair, hasLocalKeys, exportKeysAsFile, importKeysFromFile } from '../utils/e2e'
import type { ColorTheme, ChatBackground } from '../store/themeStore'
import { useI18n } from '../hooks/useI18n'
import type { Lang } from '../utils/i18n'

type Tab = 'profile' | 'status' | 'privacy' | 'password' | 'sound' | 'twofa' | 'history' | 'account' | 'language' | 'theme' | 'e2e' | 'availability' | 'legacy' | 'identities' | 'fakepin'

// -- LoginHistory --------------------------------------------------------------
function LoginHistoryTab() {
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/users/login-history')
      .then(r => setHistory(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const icon = (d: string) => {
    const s = (d || '').toLowerCase()
    return s.includes('mobile') ? '📱' : '🖥️'
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
      <p style={{ color:'rgba(255,255,255,0.4)', fontSize:'12px' }}>
        Die letzten 20 Login-Ereignisse.
      </p>
      {loading && <div style={{ textAlign:'center', color:'rgba(255,255,255,0.3)', padding:'24px' }}>Lade...</div>}
      {!loading && history.length === 0 && (
        <div style={{ textAlign:'center', color:'rgba(255,255,255,0.3)', padding:'24px' }}>Keine Daten</div>
      )}
      {history.map((h, i) => (
        <div key={i} style={{
          background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)',
          borderRadius:'12px', padding:'10px 12px', display:'flex', alignItems:'center', gap:'10px'
        }}>
          <span style={{ fontSize:'18px', flexShrink:0 }}>{icon(h.device)}</span>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:'13px', fontWeight:600 }}>{h.os || '-'}</div>
            <div style={{ fontSize:'11px', color:'rgba(255,255,255,0.4)' }}>{h.browser || '-'} · {h.ipAddress || '-'}</div>
          </div>
          <div style={{ fontSize:'11px', color:'rgba(255,255,255,0.3)', flexShrink:0 }}>
            {h.timestamp ? new Date(h.timestamp).toLocaleString('de-DE', {
              day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit'
            }) : '-'}
          </div>
        </div>
      ))}
    </div>
  )
}

// -- 2FA -----------------------------------------------------------------------
function TwoFASetup() {
  const [step,    setStep]    = useState<'idle'|'setup'|'active'>('idle')
  const [qrUrl,   setQrUrl]   = useState('')
  const [secret,  setSecret]  = useState('')
  const [backup,  setBackup]  = useState<string[]>([])
  const [token,   setToken]   = useState('')
  const [error,   setError]   = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.get('/api/auth/me').then(r => {
      if (r.data.twoFactorEnabled) setStep('active')
    }).catch(() => {})
  }, [])

  const startSetup = async () => {
    setLoading(true); setError('')
    try {
      const { data } = await api.get('/api/2fa/setup')
      setQrUrl(data.qrUrl); setSecret(data.secret); setBackup(data.backupCodes)
      setStep('setup')
    } catch { setError('Fehler beim Setup') }
    finally { setLoading(false) }
  }

  const verifySetup = async () => {
    setLoading(true); setError('')
    try {
      await api.post('/api/2fa/verify-setup', { token })
      setSuccess('2FA aktiviert!'); setStep('active')
    } catch { setError('Ungültiger Code') }
    finally { setLoading(false) }
  }

  const disable2FA = async () => {
    if (!confirm('2FA deaktivieren?')) return
    setLoading(true); setError('')
    try {
      await api.post('/api/2fa/disable', { token })
      setSuccess('2FA deaktiviert.'); setStep('idle'); setToken('')
    } catch { setError('Ungültiger Code') }
    finally { setLoading(false) }
  }

  const box = (bg: string, border: string, children: React.ReactNode) => (
    <div style={{ background:bg, border:`1px solid ${border}`, borderRadius:'12px', padding:'12px 16px', marginBottom:'10px' }}>
      {children}
    </div>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
      {box('rgba(255,255,255,0.05)', 'rgba(255,255,255,0.1)',
        <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
          <span style={{ fontSize:'28px' }}>{step === 'active' ? '🔐' : '🔒'}</span>
          <div>
            <p style={{ fontWeight:600, fontSize:'13px' }}>Zwei-Faktor-Authentifizierung</p>
            <p style={{ fontSize:'11px', color: step === 'active' ? '#4ade80' : 'rgba(255,255,255,0.4)' }}>
              {step === 'active' ? '? Aktiv' : 'Nicht aktiv'}
            </p>
          </div>
        </div>
      )}

      {step === 'idle' && (
        <button onClick={startSetup} disabled={loading}
          style={{ background:'linear-gradient(135deg,#b46a0e,#e8b86d)', color:'white', border:'none', borderRadius:'10px', padding:'10px', fontWeight:600, cursor:'pointer', opacity:loading?0.5:1 }}>
          {loading ? 'Lade...' : '🔐 2FA einrichten'}
        </button>
      )}

      {step === 'setup' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
          <div style={{ background:'rgba(255,255,255,0.05)', borderRadius:'12px', padding:'16px', textAlign:'center' }}>
            <p style={{ fontSize:'12px', color:'rgba(255,255,255,0.6)', marginBottom:'12px' }}>
              QR-Code mit Google Authenticator scannen:
            </p>
            {qrUrl && <img src={qrUrl} alt="QR" style={{ borderRadius:'8px', display:'block', margin:'0 auto' }} width={160} />}
            <p style={{ fontSize:'10px', color:'rgba(255,255,255,0.3)', fontFamily:'monospace', wordBreak:'break-all', marginTop:'8px' }}>{secret}</p>
          </div>
          {backup.length > 0 && box('rgba(234,179,8,0.08)', 'rgba(234,179,8,0.2)',
            <>
              <p style={{ fontSize:'11px', color:'#fde047', fontWeight:600, marginBottom:'8px' }}>🔑 Backup-Codes (sicher aufbewahren!):</p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4px' }}>
                {backup.map((c, i) => (
                  <code key={i} style={{ fontSize:'11px', fontFamily:'monospace', background:'rgba(0,0,0,0.2)', padding:'3px 8px', borderRadius:'4px', color:'#fef08a' }}>{c}</code>
                ))}
              </div>
            </>
          )}
          <div>
            <label style={{ display:'block', fontSize:'12px', color:'rgba(255,255,255,0.7)', marginBottom:'6px' }}>6-stelliger Code:</label>
            <input value={token} onChange={e => setToken(e.target.value.replace(/[^0-9]/g,'').slice(0,6))}
              style={{ width:'100%', textAlign:'center', fontFamily:'monospace', fontSize:'20px', letterSpacing:'8px', padding:'10px', borderRadius:'10px', border:'1px solid rgba(255,255,255,0.2)', background:'rgba(255,255,255,0.08)', color:'white', outline:'none' }}
              placeholder="000000" maxLength={6} />
          </div>
          {error && <p style={{ color:'#f87171', fontSize:'12px' }}>{error}</p>}
          <button onClick={verifySetup} disabled={token.length !== 6 || loading}
            style={{ background:'linear-gradient(135deg,#b46a0e,#e8b86d)', color:'white', border:'none', borderRadius:'10px', padding:'10px', fontWeight:600, cursor:'pointer', opacity:(token.length!==6||loading)?0.5:1 }}>
            {loading ? 'Prüfe...' : '✓ 2FA aktivieren'}
          </button>
        </div>
      )}

      {step === 'active' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
          {success && <p style={{ color:'#4ade80', fontSize:'12px' }}>{success}</p>}
          {box('rgba(34,197,94,0.08)', 'rgba(34,197,94,0.2)',
            <p style={{ fontSize:'12px', color:'#86efac' }}>✓ 2FA ist aktiv und schützt dein Konto.</p>
          )}
          <div>
            <label style={{ display:'block', fontSize:'12px', color:'rgba(255,255,255,0.7)', marginBottom:'6px' }}>Code zum Deaktivieren:</label>
            <input value={token} onChange={e => setToken(e.target.value.replace(/[^0-9]/g,'').slice(0,6))}
              style={{ width:'100%', textAlign:'center', fontFamily:'monospace', fontSize:'20px', letterSpacing:'8px', padding:'10px', borderRadius:'10px', border:'1px solid rgba(255,255,255,0.2)', background:'rgba(255,255,255,0.08)', color:'white', outline:'none' }}
              placeholder="000000" maxLength={6} />
          </div>
          {error && <p style={{ color:'#f87171', fontSize:'12px' }}>{error}</p>}
          <button onClick={disable2FA} disabled={token.length !== 6 || loading}
            style={{ background:'rgba(220,38,38,0.2)', color:'#f87171', border:'1px solid rgba(220,38,38,0.3)', borderRadius:'10px', padding:'10px', fontWeight:600, cursor:'pointer', opacity:(token.length!==6||loading)?0.5:1 }}>
            2FA deaktivieren
          </button>
        </div>
      )}
    </div>
  )
}

// -- E2E Verschlüsselung Tab ---------------------------------------------------
function E2ETab() {
  const [e2eActive,  setE2eActive]  = useState(hasLocalKeys())
  const [e2eLoading, setE2eLoading] = useState(false)
  const [e2eMsg,     setE2eMsg]     = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const setup = async () => {
    setE2eLoading(true)
    try {
      const { publicKey } = await generateKeyPair()
      await api.post('/api/users/e2e-key', { publicKey })
      setE2eActive(true)
      setE2eMsg('✓ E2E-Verschlüsselung aktiviert!')
    } catch (_e) { setE2eMsg('Fehler beim Einrichten.') }
    finally { setE2eLoading(false) }
  }

  const importFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    const ok = await importKeysFromFile(f)
    if (ok) {
      setE2eActive(true)
      setE2eMsg('✓ Schlüssel importiert!')
      await api.post('/api/users/e2e-key', { publicKey: localStorage.getItem('pingr_e2e_pubkey') })
    } else { setE2eMsg('❌ Ungültige Schlüsseldatei.') }
    e.target.value = ''
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
      <div style={{ background: e2eActive ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.05)', border:`1px solid ${e2eActive?'rgba(34,197,94,0.2)':'rgba(255,255,255,0.1)'}`, borderRadius:'12px', padding:'14px 16px', display:'flex', alignItems:'center', gap:'12px' }}>
        <span style={{ fontSize:'28px' }}>{e2eActive ? '🔒' : '🔓'}</span>
        <div>
          <p style={{ fontWeight:600, fontSize:'13px', margin:0 }}>Ende-zu-Ende Verschlüsselung</p>
          <p style={{ fontSize:'11px', color: e2eActive ? '#4ade80' : 'rgba(255,255,255,0.4)', margin:0 }}>
            {e2eActive ? '✓ Aktiviert  Nachrichten werden verschlüsselt' : 'Nicht aktiviert'}
          </p>
        </div>
      </div>

      <div style={{ background:'rgba(79,110,247,0.08)', border:'1px solid rgba(79,110,247,0.2)', borderRadius:'12px', padding:'12px 16px' }}>
        <p style={{ fontSize:'12px', color:'#a5b4fc', margin:'0 0 8px', fontWeight:600 }}>ℹ️ So funktioniert E2E</p>
        <ul style={{ fontSize:'11px', color:'rgba(255,255,255,0.5)', paddingLeft:'16px', lineHeight:1.8, margin:0 }}>
          <li>Dein Schlüssel wird NUR auf diesem Gerät gespeichert</li>
          <li>Niemand  auch nicht Nokki  kann Nachrichten lesen</li>
          <li>Bei Gerätewechsel: Schlüssel-Backup exportieren und importieren</li>
          <li>Funktioniert nur wenn beide Gesprächspartner E2E aktiviert haben</li>
        </ul>
      </div>

      {!e2eActive ? (
        <button onClick={setup} disabled={e2eLoading}
          style={{ background:'linear-gradient(135deg,#b46a0e,#e8b86d)', border:'none', borderRadius:'10px', color:'white', padding:'11px', fontWeight:700, cursor:'pointer', fontSize:'13px', opacity:e2eLoading?0.6:1 }}>
          {e2eLoading ? 'Generiere Schlüssel...' : '🔐 E2E jetzt aktivieren'}
        </button>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
          <button onClick={exportKeysAsFile}
            style={{ background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'10px', color:'white', padding:'10px', cursor:'pointer', fontSize:'13px' }}>
            💾 Schlüssel-Backup exportieren
          </button>
          <p style={{ fontSize:'11px', color:'rgba(255,255,255,0.3)', textAlign:'center', margin:0 }}>
            ⚠️ Backup aufbewahren! Bei Verlust sind verschlüsselte Nachrichten nicht mehr lesbar.
          </p>
        </div>
      )}

      <div>
        <p style={{ fontSize:'12px', color:'rgba(255,255,255,0.5)', marginBottom:'8px' }}>Schlüssel von anderem Gerät importieren:</p>
        <button onClick={() => fileRef.current?.click()}
          style={{ background:'rgba(255,255,255,0.05)', border:'1px dashed rgba(255,255,255,0.2)', borderRadius:'10px', color:'rgba(255,255,255,0.6)', padding:'10px', cursor:'pointer', fontSize:'12px', width:'100%' }}>
          📂 Schlüsseldatei importieren
        </button>
        <input ref={fileRef} type="file" accept=".json" style={{ display:'none' }} onChange={importFile} />
      </div>

      {e2eMsg && (
        <p style={{ fontSize:'12px', color: e2eMsg.startsWith('✓') ? '#4ade80' : '#f87171', margin:0 }}>{e2eMsg}</p>
      )}
    </div>
  )
}


// -- Haupt Settings ------------------------------------------------------------

// ── Quiet Hours Helper ───────────────────────────────────────────────────────
export function isInQuietHours(identity: any): boolean {
  const s = identity?.settings
  if (!s?.quietHoursFrom || !s?.quietHoursTo) return false
  const now   = new Date()
  const h     = now.getHours() * 60 + now.getMinutes()
  const [fh, fm] = s.quietHoursFrom.split(':').map(Number)
  const [th, tm] = s.quietHoursTo.split(':').map(Number)
  const from  = fh * 60 + fm
  const to    = th * 60 + tm
  return from > to ? (h >= from || h < to) : (h >= from && h < to)
}

// ── Identity Settings Panel ──────────────────────────────────────────────────
function IdentitySettingsPanel() {
  const [identities, setIdentities] = useState<any[]>([])
  const [selected,   setSelected]   = useState<any>(null)
  const [saving,     setSaving]     = useState(false)
  const [msg,        setMsg]        = useState('')

  useEffect(() => {
    api.get('/api/identities').then(r => {
      const list = r.data || []
      setIdentities(list)
      setSelected(list.find((i: any) => i.isActive) || list[0] || null)
    }).catch(() => {})
  }, [])

  const save = async () => {
    if (!selected) return
    setSaving(true); setMsg('')
    try {
      await api.patch(`/api/identities/${selected._id}`, {
        username: selected.username,
        bio:      selected.bio,
        settings: selected.settings,
      })
      setMsg('✅ Gespeichert')
      setTimeout(() => setMsg(''), 2500)
    } catch (_e) { setMsg('❌ Fehler beim Speichern') }
    setSaving(false)
  }

  const upd = (patch: any) => setSelected((s: any) => ({ ...s, ...patch }))
  const updS = (patch: any) => setSelected((s: any) => ({ ...s, settings: { ...s.settings, ...patch } }))

  const iColor: Record<string, string> = {
    private:   'linear-gradient(135deg,#1a4a6b,#0d9488)',
    work:      'linear-gradient(135deg,#1e40af,#7c3aed)',
    anonymous: 'linear-gradient(135deg,#2d1b4e,#4a1a6b)',
  }
  const iIcon:  Record<string, string>  = { private:'🧍', work:'🧑‍💼', anonymous:'🕶️' }
  const iLabel: Record<string, string>  = { private:'Privat', work:'Arbeit', anonymous:'Anonym' }

  const inp = {
    width:'100%', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)',
    borderRadius:10, padding:'9px 13px', fontSize:13, color:'white', outline:'none',
    boxSizing:'border-box' as const,
  }
  const lbl = {
    fontSize:11, color:'rgba(255,255,255,0.4)', textTransform:'uppercase' as const,
    letterSpacing:'0.07em', fontWeight:700, marginBottom:6, display:'block',
  }
  const card = {
    background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)',
    borderRadius:12, padding:'14px 16px', marginBottom:10,
  }
  const toggle = (on: boolean) => ({
    width:38, height:22, borderRadius:99, position:'relative' as const, cursor:'pointer', flexShrink:0,
    background: on ? 'rgba(232,184,109,0.35)' : 'rgba(255,255,255,0.1)', transition:'background .2s',
  })
  const toggleDot = (on: boolean) => ({
    width:18, height:18, borderRadius:'50%', background:'white',
    position:'absolute' as const, top:2, left: on ? 18 : 2, transition:'left .2s',
  })

  if (!identities.length) return (
    <div style={{ textAlign:'center', padding:'40px 16px', color:'rgba(255,255,255,0.3)' }}>
      <p style={{ fontSize:40, marginBottom:8 }}>🪪</p>
      <p>Keine Identitäten gefunden</p>
    </div>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>

      {/* Identität auswählen */}
      <div>
        <p style={lbl}>Identität bearbeiten</p>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' as const }}>
          {identities.map(id => (
            <button key={id._id} onClick={() => setSelected(id)} style={{
              display:'flex', alignItems:'center', gap:8, padding:'8px 14px',
              borderRadius:12, cursor:'pointer', border:'none',
              background: selected?._id === id._id ? 'rgba(232,184,109,0.10)' : 'rgba(255,255,255,0.04)',
              outline: selected?._id === id._id ? '1.5px solid rgba(232,184,109,0.35)' : '1px solid rgba(255,255,255,0.07)',
            }}>
              <span style={{ fontSize:16, width:26, height:26, borderRadius:7, background:iColor[id.type], display:'flex', alignItems:'center', justifyContent:'center' }}>
                {iIcon[id.type]}
              </span>
              <div style={{ textAlign:'left' }}>
                <p style={{ fontSize:12, fontWeight:600, color: selected?._id === id._id ? '#e8b86d' : 'rgba(255,255,255,0.8)' }}>{id.username}</p>
                <p style={{ fontSize:10, color:'rgba(255,255,255,0.3)' }}>{iLabel[id.type]} · #{id.uin}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {selected && (<>

        {/* Allgemein */}
        <div style={card}>
          <p style={lbl}>Allgemein</p>
          <label style={{...lbl, marginTop:0}}>Nutzername</label>
          <input style={inp} value={selected.username || ''} maxLength={30}
            onChange={e => upd({ username: e.target.value })} />
          <label style={{...lbl, marginTop:10}}>Bio</label>
          <textarea style={{...inp, resize:'none' as const, minHeight:56}} rows={2} maxLength={200}
            value={selected.bio || ''}
            onChange={e => upd({ bio: e.target.value })} />
        </div>

        {/* 🔔 Notifications */}
        <div style={card}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <p style={{ fontSize:13, fontWeight:600, color:'rgba(255,255,255,0.85)' }}>🔔 Push-Notifications</p>
              <p style={{ fontSize:11, color:'rgba(255,255,255,0.35)', marginTop:2 }}>Benachrichtigungen für diese Identität</p>
            </div>
            <div style={toggle(selected.settings?.notifications !== false)}
              onClick={() => updS({ notifications: !(selected.settings?.notifications !== false) })}>
              <div style={toggleDot(selected.settings?.notifications !== false)} />
            </div>
          </div>
        </div>

        {/* 🕶️ Anonym: Chat-Limit */}
        {selected.type === 'anonymous' && (
          <div style={card}>
            <p style={lbl}>🕶️ Anonym-Einstellungen</p>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <p style={{ fontSize:13, fontWeight:600, color:'rgba(255,255,255,0.85)' }}>Max. neue Chats / 24h</p>
                <p style={{ fontSize:11, color:'rgba(255,255,255,0.35)', marginTop:2 }}>Schützt vor Spam von dieser Identität</p>
              </div>
              <input type="number" min={1} max={50} value={selected.settings?.newChatLimit ?? 10}
                onChange={e => updS({ newChatLimit: Number(e.target.value) })}
                style={{...inp, width:68, textAlign:'center' as const}} />
            </div>
          </div>
        )}

        {/* 🧑‍💼 Arbeit: Quiet Hours + Auto-Reply */}
        {selected.type === 'work' && (
          <div style={card}>
            <p style={lbl}>🧑‍💼 Arbeits-Einstellungen</p>

            {/* Quiet Hours Toggle */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: selected.settings?.quietHoursFrom ? 12 : 0 }}>
              <div>
                <p style={{ fontSize:13, fontWeight:600, color:'rgba(255,255,255,0.85)' }}>🔕 Quiet Hours</p>
                <p style={{ fontSize:11, color:'rgba(255,255,255,0.35)', marginTop:2 }}>Keine Notifications außerhalb dieser Zeit</p>
              </div>
              <div style={toggle(!!selected.settings?.quietHoursFrom)}
                onClick={() => updS({
                  quietHoursFrom: selected.settings?.quietHoursFrom ? null : '18:00',
                  quietHoursTo:   selected.settings?.quietHoursTo || '08:00',
                })}>
                <div style={toggleDot(!!selected.settings?.quietHoursFrom)} />
              </div>
            </div>

            {selected.settings?.quietHoursFrom && (
              <div style={{ display:'flex', gap:10, marginBottom:14 }}>
                <div style={{ flex:1 }}>
                  <label style={lbl}>Von</label>
                  <input type="time" value={selected.settings.quietHoursFrom}
                    onChange={e => updS({ quietHoursFrom: e.target.value })}
                    style={{...inp, colorScheme:'dark' as const}} />
                </div>
                <div style={{ flex:1 }}>
                  <label style={lbl}>Bis</label>
                  <input type="time" value={selected.settings.quietHoursTo || '08:00'}
                    onChange={e => updS({ quietHoursTo: e.target.value })}
                    style={{...inp, colorScheme:'dark' as const}} />
                </div>
              </div>
            )}

            {/* Auto-Reply */}
            <label style={lbl}>💬 Auto-Reply Text</label>
            <p style={{ fontSize:11, color:'rgba(255,255,255,0.3)', marginBottom:8 }}>Wird während Quiet Hours automatisch gesendet</p>
            <textarea rows={2} maxLength={200}
              style={{...inp, resize:'none' as const, minHeight:56}}
              value={selected.settings?.autoReply || ''}
              onChange={e => updS({ autoReply: e.target.value })}
              placeholder="z.B. Ich bin nach 18 Uhr nicht erreichbar." />
          </div>
        )}

        {/* Speichern */}
        <button onClick={save} disabled={saving} style={{
          padding:'11px', background:'linear-gradient(135deg,#b46a0e,#e8b86d)', border:'none',
          borderRadius:12, color:'white', fontSize:13, fontWeight:700,
          cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
        }}>
          {saving ? 'Speichere…' : '💾 Einstellungen speichern'}
        </button>
        {msg && <p style={{ textAlign:'center', fontSize:12, color: msg.includes('✅') ? '#4ade80' : '#f87171' }}>{msg}</p>}
      </>)}
    </div>
  )
}

// ── FakePinTab ────────────────────────────────────────────────────────────────
function FakePinTab() {
  const [fakePin,           setFakePin]           = useState('')
  const [fakeUsername,      setFakeUsername]      = useState('')
  const [fakeStatusMessage, setFakeStatusMessage] = useState('')
  const [saving,            setSaving]            = useState(false)
  const [saved,             setSaved]             = useState(false)
  const [removing,          setRemoving]          = useState(false)
  const [error,             setError]             = useState('')

  const save = async () => {
    setError('')
    if (fakePin && (fakePin.length < 4 || fakePin.length > 8)) {
      setError('PIN muss 4–8 Zeichen haben'); return
    }
    setSaving(true)
    try {
      await api.patch('/api/auth/fake-pin', { fakePin, fakeUsername, fakeStatusMessage })
      setSaved(true); setFakePin('')
      setTimeout(() => setSaved(false), 2500)
    } catch { setError('Fehler beim Speichern') }
    finally { setSaving(false) }
  }

  const remove = async () => {
    if (!confirm('Fake-PIN wirklich entfernen?')) return
    setRemoving(true)
    try {
      await api.patch('/api/auth/fake-pin', { fakePin: '', fakeUsername: '', fakeStatusMessage: '' })
      setFakePin(''); setFakeUsername(''); setFakeStatusMessage('')
      setSaved(true); setTimeout(() => setSaved(false), 2500)
    } catch { setError('Fehler') }
    finally { setRemoving(false) }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <p style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.3)', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:14 }}>Fake-PIN / Schein-Account</p>

      <div style={{ background:'rgba(139,92,246,0.06)', border:'1px solid rgba(139,92,246,0.15)', borderRadius:12, padding:'14px 16px', marginBottom:4 }}>
        <p style={{ fontSize:13, color:'rgba(255,255,255,0.55)', lineHeight:1.6 }}>
          Wenn jemand diesen PIN eingibt statt deines echten Passworts, sieht er einen <strong style={{ color:'#a78bfa' }}>leeren Schein-Account</strong> ohne deine echten Chats. Dein echtes Passwort bleibt unberührt.
        </p>
      </div>

      <div>
        <label style={{ display:'block', fontSize:12, color:'rgba(255,255,255,0.45)', marginBottom:6 }}>Fake-PIN (4–8 Zeichen)</label>
        <input
          type="password"
          value={fakePin}
          onChange={e => setFakePin(e.target.value)}
          placeholder="Neuen Fake-PIN eingeben…"
          maxLength={8}
          style={{ width:'100%', padding:'10px 13px', borderRadius:10, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.04)', color:'white', fontSize:13, outline:'none', colorScheme:'dark', boxSizing:'border-box' }}
        />
      </div>

      <div>
        <label style={{ display:'block', fontSize:12, color:'rgba(255,255,255,0.45)', marginBottom:6 }}>Angezeigter Name im Schein-Account (optional)</label>
        <input
          value={fakeUsername}
          onChange={e => setFakeUsername(e.target.value)}
          placeholder="z.B. Max Mustermann"
          maxLength={30}
          style={{ width:'100%', padding:'10px 13px', borderRadius:10, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.04)', color:'white', fontSize:13, outline:'none', colorScheme:'dark', boxSizing:'border-box' }}
        />
      </div>

      <div>
        <label style={{ display:'block', fontSize:12, color:'rgba(255,255,255,0.45)', marginBottom:6 }}>Status-Nachricht im Schein-Account (optional)</label>
        <input
          value={fakeStatusMessage}
          onChange={e => setFakeStatusMessage(e.target.value)}
          placeholder="z.B. Bin gerade beschäftigt"
          maxLength={100}
          style={{ width:'100%', padding:'10px 13px', borderRadius:10, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.04)', color:'white', fontSize:13, outline:'none', colorScheme:'dark', boxSizing:'border-box' }}
        />
      </div>

      {error && <p style={{ color:'#f87171', fontSize:12 }}>{error}</p>}
      {saved && <p style={{ color:'#4ade80', fontSize:12 }}>✅ Gespeichert</p>}

      <button onClick={save} disabled={saving}
        style={{ background:'linear-gradient(135deg,#7c3aed,#a78bfa)', color:'white', border:'none', borderRadius:10, padding:'11px 20px', fontWeight:600, cursor:'pointer', fontSize:13, width:'100%', opacity: saving ? 0.6 : 1 }}>
        {saving ? 'Speichere…' : '🎭 Fake-PIN speichern'}
      </button>

      <button onClick={remove} disabled={removing}
        style={{ background:'rgba(239,68,68,0.08)', color:'#f87171', border:'1px solid rgba(239,68,68,0.2)', borderRadius:10, padding:'11px 20px', fontWeight:600, cursor:'pointer', fontSize:13, width:'100%', opacity: removing ? 0.6 : 1 }}>
        {removing ? 'Entferne…' : '🗑️ Fake-PIN entfernen'}
      </button>
    </div>
  )
}

export default function Settings({ onClose }: { onClose: () => void }) {
  const { lang, tr, changeLang } = useI18n()
  const { colorTheme, chatBg, fontSize, bubbleStyle, setColorTheme, setChatBg, setFontSize, setBubbleStyle } = useThemeStore()
  const user     = useAuthStore(s => s.user)
  const logout   = useAuthStore(s => s.logout)
  const fetchMe  = useAuthStore(s => s.fetchMe)
  const navigate = useNavigate()
  const { setVolume, setTheme, getVolume, getTheme } = useSound()
  const [tab, setTab] = useState<Tab>('profile')

  // Profil
  const [bio,           setBio]           = useState((user as any)?.bio || '')
  const [avatarPreview, setAvatarPreview] = useState<string|null>(null)
  const [avatarFile,    setAvatarFile]    = useState<File|null>(null)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSaved,  setProfileSaved]  = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Privacy
  const [showStatus,   setShowStatus]   = useState((user as any)?.privacyShowStatus   || 'everyone')
  const [showLastSeen, setShowLastSeen] = useState((user as any)?.privacyShowLastSeen || 'everyone')
  const [showAvatar,   setShowAvatar]   = useState((user as any)?.privacyShowAvatar   || 'everyone')
  const [privacySaved, setPrivacySaved] = useState(false)

  // Password
  const [currentPw, setCurrentPw] = useState('')
  const [newPw,     setNewPw]     = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwError,   setPwError]   = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)

  // Status
  const [statusMsg,   setStatusMsg]   = useState((user as any)?.statusMessage || '')
  const [statusExp,   setStatusExp]   = useState('')
  const [statusSaved, setStatusSaved] = useState(false)

  // Sound
  const [volume,     setVolumeState] = useState(() => getVolume())
  const [soundTheme, setSoundTheme]  = useState(() => getTheme())

  // Delete
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteError,   setDeleteError]   = useState('')
  const [deleting,      setDeleting]      = useState(false)

  const apiBase     = import.meta.env.VITE_API_URL || ''
  const currentAvatar = avatarPreview || ((user as any)?.avatar ? `${apiBase}${(user as any).avatar}` : null)

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { alert('Nur Bilder erlaubt'); return }
    if (file.size > 5 * 1024 * 1024)    { alert('Max. 5 MB');          return }
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const saveProfile = async () => {
    setProfileSaving(true)
    try {
      if (avatarFile) {
        const form = new FormData()
        form.append('avatar', avatarFile)
        await api.patch('/api/users/avatar', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      }
      await api.patch('/api/users/profile', { bio })
      await fetchMe()
      setProfileSaved(true); setAvatarFile(null)
      setTimeout(() => setProfileSaved(false), 2000)
    } catch { alert('Fehler beim Speichern') }
    finally { setProfileSaving(false) }
  }

  const savePrivacy = async () => {
    await api.patch('/api/users/privacy', {
      privacyShowStatus: showStatus, privacyShowLastSeen: showLastSeen, privacyShowAvatar: showAvatar,
    })
    await fetchMe()
    setPrivacySaved(true); setTimeout(() => setPrivacySaved(false), 2000)
  }

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault(); setPwError('')
    if (newPw !== confirmPw) { setPwError('Passwörter stimmen nicht überein'); return }
    if (newPw.length < 10)   { setPwError('Mindestens 10 Zeichen'); return }
    try {
      await api.patch('/api/auth/change-password', { currentPassword: currentPw, newPassword: newPw })
      setPwSuccess(true); setCurrentPw(''); setNewPw(''); setConfirmPw('')
      setTimeout(() => setPwSuccess(false), 3000)
    } catch { setPwError('Aktuelles Passwort falsch.') }
  }

  const saveStatus = async () => {
    const body: Record<string,unknown> = { statusMessage: statusMsg }
    if (statusExp) body.statusExpiresAt = new Date(statusExp).toISOString()
    await api.patch('/api/users/status', body)
    await fetchMe()
    setStatusSaved(true); setTimeout(() => setStatusSaved(false), 2000)
  }

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault(); setDeleteError('')
    if (deleteConfirm !== 'LÖSCHEN') { setDeleteError('Bitte "LÖSCHEN" eingeben'); return }
    setDeleting(true)
    try {
      await api.delete('/api/users/me')
      // Alle lokalen Daten löschen  besonders E2E-Schlüssel (hochsensibel!)
      const keysToRemove = [
        'pingr_token', 'pingr_e2e_privkey', 'pingr_e2e_pubkey',
        'pingr_lang', 'pingr_theme', 'pingr_chatbg', 'pingr_chatbg_custom',
        'pingr_fontsize', 'pingr_bubble', 'pingr_volume', 'pingr_sound_theme',
        'pingr_retro',
      ]
      keysToRemove.forEach(k => localStorage.removeItem(k))
      logout()
      navigate('/login')
    }
    catch { setDeleteError('Fehler. Kontaktiere den Support.') }
    finally { setDeleting(false) }
  }

  // -- Styles ------------------------------------------------------------------
  const isMobile = useIsMobile()

  const S = {
    overlay: { position:'fixed' as const, inset:0, background:'rgba(0,0,0,0.8)', backdropFilter:'blur(8px)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding: isMobile ? '0' : '16px' },
    modal:   { background:'#0d0f18', border: isMobile ? 'none' : '1px solid rgba(255,255,255,0.07)', borderRadius: isMobile ? '0' : '22px', width:'100%', maxWidth: isMobile ? '100%' : '680px', boxShadow:'0 32px 80px rgba(0,0,0,0.7)', display:'flex', flexDirection:'column' as const, height: isMobile ? '100dvh' : 'auto', maxHeight: isMobile ? '100dvh' : '88vh', overflow:'hidden' },
    header:  { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)', flexShrink:0 },
    body:    { display:'flex', flex:1, overflow:'hidden', flexDirection: isMobile ? 'column' as const : 'row' as const },
    sidebar: isMobile ? { display:'flex', flexDirection:'row' as const, gap:0, overflowX:'auto' as const, borderBottom:'1px solid rgba(255,255,255,0.06)', padding:'0 8px', flexShrink:0, scrollbarWidth:'none' as const } : { width:'175px', flexShrink:0, borderRight:'1px solid rgba(255,255,255,0.06)', padding:'10px 8px', display:'flex', flexDirection:'column' as const, gap:'2px', overflowY:'auto' as const },
    sideBtn: (active: boolean): React.CSSProperties => isMobile ? ({
      display:'flex', alignItems:'center', gap:'6px', padding:'10px 12px', borderRadius:0,
      fontSize:'12px', border:'none', cursor:'pointer', whiteSpace:'nowrap' as const, flexShrink:0,
      background: 'transparent',
      color: active ? '#e8b86d' : 'rgba(255,255,255,0.4)',
      fontWeight: active ? 600 : 400, transition:'all .15s',
      borderBottom: active ? '2px solid #e8b86d' : '2px solid transparent',
    }) : ({
      display:'flex', alignItems:'center', gap:'10px', padding:'9px 12px', borderRadius:'10px',
      fontSize:'13px', border:'none', cursor:'pointer', textAlign:'left' as const, width:'100%',
      background: active ? 'rgba(232,184,109,0.1)' : 'transparent',
      color: active ? '#e8b86d' : 'rgba(255,255,255,0.45)',
      fontWeight: active ? 600 : 400, transition:'all .15s',
      borderLeft: active ? '2px solid #e8b86d' : '2px solid transparent',
    }),
    content: { flex:1, padding: isMobile ? '16px' : '20px 22px', overflowY:'auto' as const },
    secTitle: { fontSize:'11px', fontWeight:700, color:'rgba(255,255,255,0.3)', letterSpacing:'0.08em', textTransform:'uppercase' as const, marginBottom:'14px' },
    label:    { display:'block', fontSize:'12px', color:'rgba(255,255,255,0.45)', marginBottom:'6px' },
    input:    { width:'100%', padding:'10px 13px', borderRadius:'10px', border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.04)', color:'white', fontSize:'13px', outline:'none', colorScheme:'dark' as const, boxSizing:'border-box' as const },
    select:   { width:'100%', padding:'10px 13px', borderRadius:'10px', border:'1px solid rgba(255,255,255,0.08)', background:'#08090f', color:'white', fontSize:'13px', outline:'none', colorScheme:'dark' as const },
    btnPri:   { background:'linear-gradient(135deg,#b46a0e,#e8b86d)', color:'white', border:'none', borderRadius:'10px', padding:'11px 20px', fontWeight:600 as const, cursor:'pointer', fontSize:'13px', width:'100%' },
    btnGhost: { background:'rgba(255,255,255,0.05)', color:'rgba(255,255,255,0.65)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'10px', padding:'11px 20px', fontWeight:600 as const, cursor:'pointer', fontSize:'13px', width:'100%' },
    btnDanger:{ background:'rgba(239,68,68,0.08)', color:'#f87171', border:'1px solid rgba(239,68,68,0.2)', borderRadius:'10px', padding:'11px 20px', fontWeight:600 as const, cursor:'pointer', fontSize:'13px', width:'100%' },
    card:     { background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px', padding:'4px 14px', marginBottom:'12px' },
    row:      { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'11px 0', borderBottom:'1px solid rgba(255,255,255,0.05)' } as React.CSSProperties,
  }

  const tabs = [
    { id:'profile'      as Tab, icon:'👤', label:'Profil'          },
    { id:'status'       as Tab, icon:'💬', label:'Status'          },
    { id:'privacy'      as Tab, icon:'🔒', label:'Privatsphäre'    },
    { id:'sound'        as Tab, icon:'🔊', label:'Sound'           },
    { id:'twofa'        as Tab, icon:'🔐', label:'2FA'             },
    { id:'history'      as Tab, icon:'📋', label:'Login-Verlauf'   },
    { id:'password'     as Tab, icon:'🔑', label:'Passwort'        },
    { id:'language'     as Tab, icon:'🌍', label:'Sprache'         },
    { id:'theme'        as Tab, icon:'🎨', label:'Design'          },
    { id:'availability' as Tab, icon:'⏰', label:'Verfügbarkeit'   },
    { id:'legacy'       as Tab, icon:'📡', label:'ICQ Legacy'      },
    { id:'identities'   as Tab, icon:'🪪', label:'Identitäten'     },
    { id:'fakepin'      as Tab, icon:'🎭', label:'Fake-PIN'        },
    { id:'account'      as Tab, icon:'🗂', label:'Konto'           },
  ]

  return (
    <div style={S.overlay}>
      <div style={S.modal}>

        {/* Header */}
        <div style={S.header}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:10, background:'linear-gradient(135deg,#b46a0e,#e8b86d)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>⚙️</div>
            <h2 style={{ fontWeight:700, fontSize:16, color:'rgba(255,255,255,0.92)' }}>Einstellungen</h2>
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:8, color:'rgba(255,255,255,0.5)', cursor:'pointer', fontSize:16, width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
        </div>

        <div style={S.body}>
          {/* Sidebar */}
          <div style={S.sidebar}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={S.sideBtn(tab === t.id)}>
                <span style={{ fontSize: isMobile ? 16 : 15, flexShrink:0 }}>{t.icon}</span>
                {!isMobile && <span>{t.label}</span>}
              </button>
            ))}
          </div>

          {/* Content */}
          <div style={S.content}>

            {/* PROFIL */}
            {tab === 'profile' && (
              <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                <p style={S.secTitle}>Profil</p>
                <div style={{ display:'flex', alignItems:'center', gap:16 }}>
                  <div style={{ position:'relative', flexShrink:0 }}>
                    <div style={{ width:72, height:72, borderRadius:'50%', overflow:'hidden', background:'linear-gradient(135deg,#b46a0e,#e8b86d)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', border:'3px solid rgba(232,184,109,0.2)', boxShadow:'0 0 20px rgba(232,184,109,0.12)' }} onClick={() => fileRef.current?.click()}>
                      {currentAvatar ? <img src={currentAvatar} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <span style={{ fontSize:28, fontWeight:'bold', color:'white' }}>{user?.username?.[0]?.toUpperCase()}</span>}
                    </div>
                    <button onClick={() => fileRef.current?.click()} style={{ position:'absolute', bottom:0, right:0, width:24, height:24, borderRadius:'50%', background:'linear-gradient(135deg,#b46a0e,#e8b86d)', border:'2px solid #08090f', cursor:'pointer', fontSize:11, display:'flex', alignItems:'center', justifyContent:'center' }}>📷</button>
                  </div>
                  <div>
                    <p style={{ fontWeight:700, fontSize:15, color:'rgba(255,255,255,0.9)' }}>{user?.username}</p>
                    <p style={{ fontSize:12, color:'#e8b86d', fontFamily:'monospace', opacity:0.7, marginTop:2 }}>#{user?.uin}</p>
                    <p style={{ fontSize:11, color:'rgba(255,255,255,0.3)', marginTop:4 }}>Klicken um Bild zu ändern (max. 5 MB)</p>
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleAvatarChange} />
                </div>
                <div style={S.card}>
                  <div style={S.row}><span style={{ fontSize:12, color:'rgba(255,255,255,0.4)' }}>Username</span><span style={{ fontSize:13, fontWeight:600 }}>{user?.username}</span></div>
                  <div style={S.row}><span style={{ fontSize:12, color:'rgba(255,255,255,0.4)' }}>UIN</span><span style={{ fontSize:13, fontFamily:'monospace', color:'#e8b86d' }}>#{user?.uin}</span></div>
                  <div style={{ ...S.row, borderBottom:'none' }}><span style={{ fontSize:12, color:'rgba(255,255,255,0.4)' }}>E-Mail</span><span style={{ fontSize:13, color:'rgba(255,255,255,0.7)' }}>{user?.email}</span></div>
                </div>
                <div>
                  <label style={S.label}>Über mich <span style={{ color:'rgba(255,255,255,0.25)' }}>({bio.length}/200)</span></label>
                  <textarea value={bio} onChange={e => setBio(e.target.value)} maxLength={200} rows={3} style={{ ...S.input, resize:'vertical', minHeight:72 }} placeholder="Schreib etwas über dich..." />
                </div>
                <button onClick={saveProfile} disabled={profileSaving} style={{ ...S.btnPri, background: profileSaved ? 'rgba(34,197,94,0.15)' : 'linear-gradient(135deg,#b46a0e,#e8b86d)', color: profileSaved ? '#4ade80' : 'white', opacity:profileSaving?0.6:1 }}>
                  {profileSaving ? 'Speichere...' : profileSaved ? '✓ Gespeichert' : 'Profil speichern'}
                </button>
              </div>
            )}

            {/* STATUS */}
            {tab === 'status' && (
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <p style={S.secTitle}>Status</p>
                <div>
                  <label style={S.label}>Status-Nachricht</label>
                  <input type="text" value={statusMsg} onChange={e => setStatusMsg(e.target.value)} style={S.input} placeholder="z.B. Bin im Urlaub 🌴" maxLength={100} />
                </div>
                <div>
                  <label style={S.label}>Ablaufzeit <span style={{ color:'rgba(255,255,255,0.25)' }}>(optional)</span></label>
                  <input type="datetime-local" value={statusExp} onChange={e => setStatusExp(e.target.value)} style={{ ...S.input, colorScheme:'dark' }} />
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {[{e:'🎮',t:'Zocke gerade'},{e:'🎵',t:'Musik hören'},{e:'😴',t:'Schlafen'},{e:'🌴',t:'Im Urlaub'},{e:'🔕',t:'Nicht stören'},{e:'💼',t:'Bei der Arbeit'}].map(s => (
                    <button key={s.t} onClick={() => setStatusMsg(`${s.e} ${s.t}`)} style={{ padding:'6px 12px', borderRadius:9, fontSize:12, border:'1px solid rgba(255,255,255,0.1)', cursor:'pointer', background: statusMsg===`${s.e} ${s.t}` ? 'rgba(232,184,109,0.12)' : 'rgba(255,255,255,0.05)', color: statusMsg===`${s.e} ${s.t}` ? '#e8b86d' : 'rgba(255,255,255,0.6)' }}>
                      {s.e} {s.t}
                    </button>
                  ))}
                </div>
                <button onClick={saveStatus} style={{ ...S.btnPri, background: statusSaved ? 'rgba(34,197,94,0.15)' : 'linear-gradient(135deg,#b46a0e,#e8b86d)', color: statusSaved ? '#4ade80' : 'white' }}>
                  {statusSaved ? '✓ Gespeichert' : 'Status speichern'}
                </button>
              </div>
            )}

            {/* PRIVATSPHÄRE */}
            {tab === 'privacy' && (
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <p style={S.secTitle}>Privatsphäre</p>
                {[
                  { label:'Online-Status anzeigen', key:'showStatus',   val:showStatus,   set:setShowStatus   },
                  { label:'Zuletzt online anzeigen',key:'showLastSeen', val:showLastSeen, set:setShowLastSeen },
                  { label:'Profilbild anzeigen',    key:'showAvatar',   val:showAvatar,   set:setShowAvatar   },
                ].map(({ label, val, set }) => (
                  <div key={label} style={{ ...S.card, padding:'4px 14px' }}>
                    <div style={{ ...S.row, borderBottom:'none' }}>
                      <span style={{ fontSize:13, color:'rgba(255,255,255,0.75)' }}>{label}</span>
                      <select value={val} onChange={e => set(e.target.value)} style={{ ...S.select, width:'auto', padding:'5px 10px', fontSize:12 }}>
                        <option value="everyone">Alle</option>
                        <option value="contacts">Kontakte</option>
                        <option value="nobody">Niemand</option>
                      </select>
                    </div>
                  </div>
                ))}
                <button onClick={savePrivacy} style={{ ...S.btnPri, background: privacySaved ? 'rgba(34,197,94,0.15)' : 'linear-gradient(135deg,#b46a0e,#e8b86d)', color: privacySaved ? '#4ade80' : 'white' }}>
                  {privacySaved ? '✓ Gespeichert' : 'Datenschutz speichern'}
                </button>
              </div>
            )}

            {/* SOUND */}
            {tab === 'sound' && (
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <p style={S.secTitle}>Sound</p>
                <SoundSettings />
              </div>
            )}

            {/* 2FA */}
            {tab === 'twofa' && <TwoFASetup />}

            {/* LOGIN-VERLAUF */}
            {tab === 'history' && <LoginHistoryTab />}

            {/* PASSWORT */}
            {tab === 'password' && (
              <form onSubmit={savePassword} style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <p style={S.secTitle}>Passwort ändern</p>
                <div>
                  <label style={S.label}>Aktuelles Passwort</label>
                  <input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} style={S.input} placeholder="••••••••" required />
                </div>
                <div>
                  <label style={S.label}>Neues Passwort</label>
                  <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} style={S.input} placeholder="Mindestens 10 Zeichen" minLength={10} required />
                </div>
                <div>
                  <label style={S.label}>Neues Passwort bestätigen</label>
                  <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} style={S.input} placeholder="••••••••" required />
                </div>
                {pwError   && <p style={{ color:'#f87171', fontSize:12 }}>{pwError}</p>}
                {pwSuccess && <p style={{ color:'#4ade80', fontSize:12 }}>✓ Passwort geändert!</p>}
                <button type="submit" style={S.btnPri}>Passwort ändern</button>
              </form>
            )}

            {/* SPRACHE */}
            {tab === 'language' && (
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <p style={S.secTitle}>Sprache</p>
                <div>
                  <label style={S.label}>App-Sprache</label>
                  <select value={lang} onChange={e => changeLang(e.target.value as any)} style={S.select}>
                    <option value="de">🇩🇪 Deutsch</option>
                    <option value="en">🇬🇧 English</option>
                    <option value="fr">🇫🇷 Français</option>
                    <option value="es">🇪🇸 Español</option>
                    <option value="tr">🇹🇷 Türkçe</option>
                    <option value="ar">🇸🇦 العربية</option>
                  </select>
                </div>
              </div>
            )}

            {/* DESIGN */}
            {tab === 'theme' && (
              <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                <p style={S.secTitle}>Design</p>
                <div>
                  <label style={S.label}>Farbschema</label>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                    {(['default','ocean','sunset','forest','purple','rose'] as ColorTheme[]).map(c => (
                      <button key={c} onClick={() => { setColorTheme(c); applyTheme(c) }} style={{ padding:'7px 14px', borderRadius:9, fontSize:12, fontWeight:500, cursor:'pointer', border: colorTheme===c ? '1px solid rgba(232,184,109,0.5)' : '1px solid rgba(255,255,255,0.1)', background: colorTheme===c ? 'rgba(232,184,109,0.1)' : 'rgba(255,255,255,0.05)', color: colorTheme===c ? '#e8b86d' : 'rgba(255,255,255,0.55)' }}>
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={S.label}>Chat-Hintergrund</label>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                    {(['default','dots','lines','waves','custom'] as ChatBackground[]).map(b => (
                      <button key={b} onClick={() => setChatBg(b)} style={{ padding:'7px 14px', borderRadius:9, fontSize:12, fontWeight:500, cursor:'pointer', border: chatBg===b ? '1px solid rgba(232,184,109,0.5)' : '1px solid rgba(255,255,255,0.1)', background: chatBg===b ? 'rgba(232,184,109,0.1)' : 'rgba(255,255,255,0.05)', color: chatBg===b ? '#e8b86d' : 'rgba(255,255,255,0.55)' }}>
                        {b}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={S.label}>Schriftgröße</label>
                  <select value={fontSize} onChange={e => setFontSize(e.target.value as any)} style={S.select}>
                    <option value="small">Klein</option>
                    <option value="normal">Normal</option>
                    <option value="large">Groß</option>
                  </select>
                </div>
                <div>
                  <label style={S.label}>Nachrichten-Stil</label>
                  <select value={bubbleStyle} onChange={e => setBubbleStyle(e.target.value as any)} style={S.select}>
                    <option value="bubble">Blasen</option>
                    <option value="flat">Flach</option>
                    <option value="minimal">Minimal</option>
                  </select>
                </div>
              </div>
            )}

            {/* VERSCHLÜSSELUNG */}
            {tab === 'e2e' && <E2ETab />}

            {/* VERFÜGBARKEIT */}
            {tab === 'availability' && (
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <p style={S.secTitle}>Verfügbarkeit & Zeitzone</p>
                <AvailabilitySettings />
              </div>
            )}

            {/* ICQ LEGACY */}
            {tab === 'legacy' && (
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <p style={S.secTitle}>ICQ Legacy UIN</p>
                <LegacyClaimForm />
              </div>
            )}

            {/* KONTO */}
            {tab === 'identities' && (
              <IdentitySettingsPanel />
            )}

            {/* FAKE-PIN */}
            {tab === 'fakepin' && <FakePinTab />}

            {tab === 'account' && (
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <p style={S.secTitle}>Konto löschen</p>
                <div style={{ background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.15)', borderRadius:12, padding:'14px 16px', marginBottom:4 }}>
                  <p style={{ fontSize:13, color:'rgba(255,255,255,0.55)', lineHeight:1.6 }}>
                    Das Löschen deines Kontos ist <strong style={{ color:'#f87171' }}>permanent</strong> und kann nicht rückgängig gemacht werden. Alle deine Daten, Nachrichten und Kontakte werden unwiderruflich entfernt.
                  </p>
                </div>
                <form onSubmit={handleDeleteAccount} style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  <div>
                    <label style={S.label}>Tippe <strong style={{ color:'#f87171' }}>LÖSCHEN</strong> zur Bestätigung</label>
                    <input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} style={{ ...S.input, borderColor:'rgba(239,68,68,0.2)' }} placeholder="LÖSCHEN" />
                  </div>
                  {deleteError && <p style={{ color:'#f87171', fontSize:12 }}>{deleteError}</p>}
                  <button type="submit" disabled={deleting || deleteConfirm !== 'LÖSCHEN'} style={{ ...S.btnDanger, opacity: (deleting || deleteConfirm !== 'LÖSCHEN') ? 0.4 : 1 }}>
                    {deleting ? 'Lösche...' : '🗑️ Konto endgültig löschen'}
                  </button>
                </form>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
