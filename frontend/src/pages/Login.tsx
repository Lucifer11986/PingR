import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { useAuthStore } from '../store/authStore'
import { detectLanguageByIP } from '../utils/i18n'

export default function Login() {
  const [login,     setLogin]     = useState('')
  const [password,  setPassword]  = useState('')
  const [twoFaCode, setTwoFaCode] = useState('')
  const [needs2FA,  setNeeds2FA]  = useState(false)
  const [error,     setError]     = useState('')
  const [loading,   setLoading]   = useState(false)

  useEffect(() => { detectLanguageByIP() }, [])

  const doLogin = async (code?: string) => {
    setLoading(true); setError('')
    try {
      // Trusted Device Token aus localStorage holen
      const trustedToken = localStorage.getItem('pingr_trusted_device') || ''
      const body: Record<string, string> = { login, password }
      if (code)         body.twoFaCode = code
      if (trustedToken) body.trustedDeviceToken = trustedToken
      
      const { data } = await api.post('/api/auth/login', body)
      
      if (data.requires2FA) { setNeeds2FA(true); setLoading(false); return }
      if (!data.token) { setError('Login fehlgeschlagen.'); setLoading(false); return }
      
      // ✅ Token und activeIdentityId speichern
      localStorage.setItem('pingr_token', data.token)
      
      // ✅ activeIdentityId aus Response speichern
      if (data.user?.activeIdentityId) {
        localStorage.setItem('pingr_active_identity', data.user.activeIdentityId)
      }
      
      useAuthStore.setState({ 
        token: data.token, 
        user: data.user,
        activeIdentityId: data.user?.activeIdentityId || null  // ✅ NEU
      })
      
      // Flag setzen damit Chat.tsx den "Gerät vertrauen" Banner zeigen kann
      // (nur wenn kein trusted token vorhanden war)
      if (!trustedToken) {
        sessionStorage.setItem('pingr_show_trust_banner', '1')
      }
      
      window.location.href = '/chat'
    } catch (err: any) {
      if (err?.response?.data?.requires2FA) { setNeeds2FA(true); setLoading(false); return }
      setError(err?.response?.data?.error || 'Login fehlgeschlagen.')
      setLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    needs2FA ? doLogin(twoFaCode) : doLogin()
  }

  return (
    <div style={{ minHeight: '100vh', background: '#08090f', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', position: 'relative', overflow: 'hidden' }}>
      {/* Aurora Glows */}
      <div style={{ position: 'absolute', width: '600px', height: '600px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(180,106,14,0.12) 0%, transparent 65%)', top: '-200px', left: '-150px', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(232,184,109,0.07) 0%, transparent 65%)', bottom: '-100px', right: '-50px', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: '380px', position: 'relative', zIndex: 1 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <a href="/landing.html" style={{ color: 'rgba(255,255,255,0.25)', fontSize: '12px', textDecoration: 'none', display: 'block', marginBottom: '24px' }}>
            ← Startseite
          </a>
          {/* Logo Icon mit Glow */}
          <div style={{ width: '68px', height: '68px', borderRadius: '20px', background: 'linear-gradient(135deg,#b46a0e,#e8b86d)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 0 0 12px rgba(232,184,109,0.06), 0 0 0 24px rgba(232,184,109,0.03), 0 8px 32px rgba(180,106,14,0.3)' }}>
            <svg width="30" height="30" fill="none" stroke="white" strokeWidth="1.8" viewBox="0 0 24 24">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: 700, color: 'rgba(255,255,255,0.95)', margin: '0 0 6px', letterSpacing: '-0.02em' }}>Nokki</h1>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px', margin: 0 }}>Sicher. Schnell. Persönlich.</p>
        </div>

        {/* Card */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', padding: '26px', backdropFilter: 'blur(24px)' }}>
          {/* Tabs */}
          {!needs2FA && (
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: '12px', padding: '4px', marginBottom: '22px' }}>
              <div style={{ flex: 1, padding: '9px', borderRadius: '9px', background: 'rgba(232,184,109,0.1)', border: '1px solid rgba(232,184,109,0.2)', color: '#e8b86d', fontSize: '13px', fontWeight: 500, textAlign: 'center' }}>
                Anmelden
              </div>
              <Link to="/register" style={{ flex: 1, padding: '9px', textAlign: 'center', fontSize: '13px', color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>
                Registrieren
              </Link>
            </div>
          )}

          {error && (
            <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: '10px', padding: '10px 14px', color: '#fca5a5', fontSize: '12px', marginBottom: '14px' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {!needs2FA ? (
              <>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '6px' }}>UIN oder E-Mail</div>
                <input type="text" value={login} onChange={e => setLogin(e.target.value)}
                  placeholder="12345678 oder name@email.de" required autoFocus
                  style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '11px', padding: '11px 14px', fontSize: '13px', color: 'white', outline: 'none', marginBottom: '14px', boxSizing: 'border-box' }} />
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '6px' }}>Passwort</div>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required
                  style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '11px', padding: '11px 14px', fontSize: '13px', color: 'white', outline: 'none', marginBottom: '8px', boxSizing: 'border-box' }} />
                <div style={{ textAlign: 'right', marginBottom: '18px' }}>
                  <Link to="/forgot-password" style={{ fontSize: '12px', color: '#e8b86d', textDecoration: 'none', opacity: 0.8 }}>
                    Passwort vergessen?
                  </Link>
                </div>
              </>
            ) : (
              <>
                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                  <div style={{ fontSize: '36px', marginBottom: '8px' }}>🔐</div>
                  <p style={{ fontWeight: 600, fontSize: '15px', color: 'white', margin: '0 0 6px' }}>Zwei-Faktor-Authentifizierung</p>
                  <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', margin: 0 }}>Gib den 6-stelligen Code aus deiner App ein.</p>
                </div>
                <input type="text" inputMode="numeric" value={twoFaCode}
                  onChange={e => setTwoFaCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                  placeholder="000000" maxLength={6} autoFocus
                  style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '11px', padding: '12px', fontSize: '22px', fontFamily: 'monospace', letterSpacing: '10px', textAlign: 'center', color: 'white', outline: 'none', marginBottom: '16px', boxSizing: 'border-box' }} />
                <button type="button" onClick={() => { setNeeds2FA(false); setTwoFaCode(''); setError('') }}
                  style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: '12px', padding: '4px', marginBottom: '12px' }}>
                  ← Zurück zum Login
                </button>
              </>
            )}

            <button type="submit" disabled={loading || (needs2FA && twoFaCode.length !== 6)}
              style={{ width: '100%', padding: '12px', background: 'linear-gradient(135deg,#b46a0e,#e8b86d)', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 20px rgba(232,184,109,0.25)', opacity: (loading || (needs2FA && twoFaCode.length !== 6)) ? 0.6 : 1 }}>
              {loading ? 'Einen Moment…' : needs2FA ? '✓ Bestätigen' : 'Anmelden'}
            </button>
          </form>

          {!needs2FA && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '14px 0' }}>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)' }}>oder</span>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
              </div>
              <Link to="/register" style={{ textDecoration: 'none' }}>
                <button style={{ width: '100%', padding: '11px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', color: 'rgba(255,255,255,0.55)', fontSize: '13px', cursor: 'pointer' }}>
                  Neues Konto erstellen
                </button>
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
