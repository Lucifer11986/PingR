import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { detectLanguageByIP } from '../utils/i18n'
import api from '../services/api'

export default function Register() {
  const [username,   setUsername]   = useState('')
  const [email,      setEmail]      = useState('')
  const [password,   setPassword]   = useState('')
  const [confirm,    setConfirm]    = useState('')
  const [error,      setError]      = useState('')
  const [captchaId,  setCaptchaId]  = useState('')
  const [captchaQ,   setCaptchaQ]   = useState('')
  const [captchaAns, setCaptchaAns] = useState('')
  const [captchaErr, setCaptchaErr] = useState(false)
  
  // ✅ authStore.register() speichert activeIdentityId automatisch
  const { register, loading } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => { detectLanguageByIP() }, [])
  useEffect(() => { loadCaptcha() }, [])

  const loadCaptcha = async () => {
    try {
      const { data } = await api.get('/api/auth/captcha')
      setCaptchaId(data.id); setCaptchaQ(data.question); setCaptchaAns(''); setCaptchaErr(false)
    } catch (_e) {}
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('')
    if (password !== confirm)  { setError('Passwörter stimmen nicht überein.'); return }
    if (password.length < 10)  { setError('Passwort muss mindestens 10 Zeichen haben.'); return }
    if (!captchaAns.trim())    { setError('Bitte CAPTCHA ausfüllen.'); return }
    
    try {
      const { data } = await api.post('/api/auth/captcha/verify', { id: captchaId, answer: parseInt(captchaAns) })
      if (!data.valid) { setCaptchaErr(true); loadCaptcha(); return }
    } catch (_e) { loadCaptcha(); return }
    
    try {
      // ✅ authStore.register() speichert Token UND activeIdentityId
      await register(username, email, password)
      navigate('/chat')
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      setError(e?.response?.data?.error || 'Registrierung fehlgeschlagen.')
      loadCaptcha()
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '11px', padding: '11px 14px', fontSize: '13px', color: 'white',
    outline: 'none', marginBottom: '14px', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: '11px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.05em',
    textTransform: 'uppercase', marginBottom: '6px', display: 'block',
  }

  return (
    <div className="register-page">
      {/* Aurora Glows */}
      <div style={{ position: 'absolute', width: '600px', height: '600px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(180,106,14,0.12) 0%, transparent 65%)', top: '-200px', left: '-150px', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(232,184,109,0.07) 0%, transparent 65%)', bottom: '-100px', right: '-50px', pointerEvents: 'none' }} />

      <div className="register-page-content">
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <a href="/landing.html" style={{ color: 'rgba(255,255,255,0.25)', fontSize: '12px', textDecoration: 'none', display: 'block', marginBottom: '20px' }}>← Startseite</a>
          <div style={{ width: '68px', height: '68px', borderRadius: '20px', background: 'linear-gradient(135deg,#b46a0e,#e8b86d)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 0 0 12px rgba(232,184,109,0.06), 0 8px 32px rgba(180,106,14,0.3)' }}>
            <svg width="30" height="30" fill="none" stroke="white" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: 700, color: 'rgba(255,255,255,0.95)', margin: '0 0 6px', letterSpacing: '-0.02em' }}>Nokki</h1>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px', margin: 0 }}>Konto erstellen & UIN erhalten</p>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', padding: '26px', backdropFilter: 'blur(24px)' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: '12px', padding: '4px', marginBottom: '22px' }}>
            <Link to="/login" style={{ flex: 1, padding: '9px', textAlign: 'center', fontSize: '13px', color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>Anmelden</Link>
            <div style={{ flex: 1, padding: '9px', borderRadius: '9px', background: 'rgba(232,184,109,0.1)', border: '1px solid rgba(232,184,109,0.2)', color: '#e8b86d', fontSize: '13px', fontWeight: 500, textAlign: 'center' }}>
              Registrieren
            </div>
          </div>

          {error && (
            <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: '10px', padding: '10px 14px', color: '#fca5a5', fontSize: '12px', marginBottom: '14px' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <label style={labelStyle}>Benutzername</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} style={inputStyle} placeholder="z.B. CoolUser42" required autoFocus />

            <label style={labelStyle}>E-Mail-Adresse</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} placeholder="deine@echte-email.de" required />
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', marginTop: '-10px', marginBottom: '14px' }}>ⓘ Nur echte E-Mail-Adressen. Wegwerf-Dienste sind nicht erlaubt.</p>

            <label style={labelStyle}>Passwort</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} placeholder="mindestens 10 Zeichen" minLength={10} required />

            <label style={labelStyle}>Passwort bestätigen</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} style={inputStyle} placeholder="••••••••" required />

            {captchaQ && (
              <>
                <label style={{ ...labelStyle, color: captchaErr ? '#fca5a5' : 'rgba(255,255,255,0.3)' }}>
                  🤖 Sicherheitsfrage: <strong style={{ color: '#e8b86d', fontFamily: 'monospace' }}>{captchaQ}</strong>
                  <button type="button" onClick={loadCaptcha} style={{ marginLeft: '8px', background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: '12px' }}>🔄</button>
                </label>
                <input type="number" value={captchaAns}
                  onChange={e => { setCaptchaAns(e.target.value); setCaptchaErr(false) }}
                  style={{ ...inputStyle, borderColor: captchaErr ? 'rgba(248,113,113,0.4)' : 'rgba(255,255,255,0.08)' }}
                  placeholder="Antwort" required />
                {captchaErr && <p style={{ fontSize: '11px', color: '#fca5a5', marginTop: '-10px', marginBottom: '14px' }}>❌ Falsche Antwort — neues CAPTCHA geladen</p>}
              </>
            )}

            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '10px 12px', fontSize: '11px', color: 'rgba(255,255,255,0.3)', lineHeight: 1.6, marginBottom: '16px' }}>
              Mit der Registrierung stimmst du zu, dass Nokki deine IP-Adresse und Gerätedaten
              entsprechend der <a href="/datenschutz.html" target="_blank" rel="noreferrer" style={{ color: '#e8b86d' }}>Datenschutzerklärung</a> verarbeitet.
            </div>

            <button type="submit" disabled={loading}
              style={{ width: '100%', padding: '12px', background: 'linear-gradient(135deg,#b46a0e,#e8b86d)', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 20px rgba(232,184,109,0.25)', opacity: loading ? 0.6 : 1 }}>
              {loading ? 'Registriere…' : '🎉 Konto erstellen'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
