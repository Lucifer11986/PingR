import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { restoreDevSession } from '../services/devApi'

// Diese Seite wird nach OAuth-Login aufgerufen:
// /dev-oauth-callback#token=xxx  → Token speichern → Dashboard
// /dev-login?error=xxx           ? Fehler anzeigen

const DevOAuthCallback: React.FC = () => {
  const navigate       = useNavigate()
  const [params]       = useSearchParams()
  const [status, setStatus] = useState('Anmeldung wird abgeschlossen...')

  useEffect(() => {
    const error = params.get('error') || params.get('oauth_error')

    if (error) {
      const messages: Record<string, string> = {
        github_no_code:    'GitHub hat keinen Code zurückgegeben.',
        github_token:      'GitHub Token konnte nicht abgerufen werden.',
        github_no_email:   'Keine öffentliche E-Mail bei GitHub hinterlegt. Bitte E-Mail in GitHub-Einstellungen öffentlich machen.',
        github_server:     'Serverfehler beim GitHub Login.',
        google_cancelled:  'Google Login wurde abgebrochen.',
        google_token:      'Google Token konnte nicht abgerufen werden.',
        google_no_email:   'Keine E-Mail von Google erhalten.',
        google_server:     'Serverfehler beim Google Login.',
      }
      setStatus(messages[error] || `Fehler: ${error}`)
      setTimeout(() => navigate(`/dev-login?error=${encodeURIComponent(messages[error] || error)}`), 2500)
      return
    }

    restoreDevSession().then(token => {
      if (!token) { navigate('/dev-login?oauth_error=session'); return }
      setStatus('Erfolgreich angemeldet! Weiterleitung...')
      setTimeout(() => navigate('/dev-dashboard'), 500)
    })
  }, [])

  const isError = !!(params.get('error') || params.get('oauth_error'))

  return (
    <div style={{
      minHeight: '100vh', background: '#08090f', color: '#f1f0f8',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
    }}>
      <div style={{ textAlign: 'center', maxWidth: 400, padding: 24 }}>
        {/* Logo */}
        <div style={{
          width: 56, height: 56, borderRadius: 16, margin: '0 auto 24px',
          background: 'linear-gradient(135deg,#b46a0e,#e8b86d)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
        }}>??</div>

        {/* Spinner oder Error-Icon */}
        {!isError ? (
          <div style={{
            width: 40, height: 40, border: '3px solid rgba(232,184,109,0.3)',
            borderTopColor: '#e8b86d', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite', margin: '0 auto 20px',
          }} />
        ) : (
          <div style={{ fontSize: 40, marginBottom: 20 }}>?</div>
        )}

        <p style={{ fontSize: 15, color: isError ? '#fca5a5' : 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
          {status}
        </p>

        {isError && (
          <button
            onClick={() => navigate('/dev-login')}
            style={{
              marginTop: 20, padding: '10px 24px', borderRadius: 10,
              background: 'linear-gradient(135deg,#b46a0e,#e8b86d)',
              border: 'none', color: '#fff', cursor: 'pointer',
              fontSize: 14, fontWeight: 600,
            }}
          >
            Zurück zum Login
          </button>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

export default DevOAuthCallback
