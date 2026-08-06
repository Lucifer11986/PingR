import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const DevLogin: React.FC = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const code = params.get('oauth_error') || params.get('error')
    if (!code) return
    const messages: Record<string, string> = {
      github_no_code: 'GitHub hat keinen Anmeldecode zurückgegeben.',
      github_token: 'GitHub-Anmeldung konnte nicht abgeschlossen werden.',
      github_no_email: 'Keine bestätigte GitHub-E-Mail gefunden.',
      github_server: 'GitHub-Anmeldung ist derzeit nicht verfügbar.',
      google_cancelled: 'Google-Anmeldung wurde abgebrochen.',
      google_token: 'Google-Anmeldung konnte nicht abgeschlossen werden.',
      google_no_email: 'Google hat keine E-Mail-Adresse übermittelt.',
      google_server: 'Google-Anmeldung ist derzeit nicht verfügbar.',
      oauth_state: 'Die OAuth-Anfrage ist abgelaufen oder ungültig. Bitte erneut versuchen.',
      session: 'Die Anmeldung konnte nicht in eine sichere Sitzung übernommen werden.',
    }
    setError(messages[code] || code)
  }, [params])

  useEffect(() => {
    const verification = params.get('verification')
    if (verification === 'success') setNotice('E-Mail erfolgreich bestätigt. Du kannst dich jetzt anmelden.')
    if (verification === 'invalid') setError('Bestätigungslink ist ungültig oder abgelaufen.')
  }, [params])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/dev/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, remember }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('nokki_dev_token', data.token);
        navigate('/dev-dashboard');
      } else {
        setError(data.error || 'Login fehlgeschlagen');
      }
    } catch (err) {
      setError('Verbindungsfehler. Bitte versuche es später erneut.');
    } finally {
      setLoading(false);
    }
  };

  const loginWithGitHub = () => {
    window.location.href = '/api/dev/auth/github';
  };

  const loginWithGoogle = () => {
    window.location.href = '/api/dev/auth/google';
  };

  return (
    <div className="dev-login-page">
      <style>{`
        .dev-login-page {
          background: #08090f;
          color: #f1f0f8;
          min-height: 100dvh;
          height: 100dvh;
          overflow-y: auto;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        }

        .dev-login-container {
          max-width: 440px;
          width: 100%;
        }

        .dev-login-logo-container {
          text-align: center;
          margin-bottom: 40px;
        }

        .dev-login-logo {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          font-size: 24px;
          font-weight: 800;
          cursor: pointer;
        }

        .dev-login-logo-icon {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          background: linear-gradient(135deg, #b46a0e, #e8b86d);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          box-shadow: 0 0 0 8px rgba(232, 184, 109, 0.08);
        }

        .dev-login-card {
          background: #0d0f18;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          padding: 40px;
        }

        .dev-login-title {
          font-size: 28px;
          font-weight: 800;
          text-align: center;
          margin-bottom: 10px;
          letter-spacing: -0.8px;
        }

        .dev-login-subtitle {
          text-align: center;
          color: #8b8aa8;
          font-size: 14px;
          margin-bottom: 32px;
        }

        .dev-error {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 20px;
          font-size: 13px;
          color: #fca5a5;
        }

        .dev-form-group {
          margin-bottom: 20px;
        }

        .dev-label {
          display: block;
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 8px;
          color: #f1f0f8;
        }

        .dev-input {
          width: 100%;
          padding: 12px 16px;
          background: #13141f;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          color: #f1f0f8;
          font-size: 14px;
          transition: all 0.2s;
          outline: none;
        }

        .dev-input:focus {
          border-color: rgba(232, 184, 109, 0.4);
          background: rgba(232, 184, 109, 0.03);
        }

        .dev-checkbox-group {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 12px;
        }

        .dev-checkbox {
          width: auto;
          margin: 0;
        }

        .dev-checkbox-label {
          margin: 0;
          font-weight: 400;
          font-size: 13px;
          color: #8b8aa8;
        }

        .dev-btn {
          width: 100%;
          padding: 14px;
          border: none;
          border-radius: 10px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.25s;
          margin-top: 8px;
        }

        .dev-btn-primary {
          background: linear-gradient(135deg, #b46a0e, #e8b86d);
          color: #fff;
          box-shadow: 0 4px 20px rgba(180, 106, 14, 0.25);
        }

        .dev-btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 28px rgba(232, 184, 109, 0.35);
        }

        .dev-btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .dev-divider {
          display: flex;
          align-items: center;
          margin: 28px 0;
          color: #8b8aa8;
          font-size: 13px;
        }

        .dev-divider::before,
        .dev-divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: rgba(255, 255, 255, 0.08);
        }

        .dev-divider::before {
          margin-right: 12px;
        }

        .dev-divider::after {
          margin-left: 12px;
        }

        .dev-oauth-buttons {
          display: grid;
          gap: 12px;
        }

        .dev-oauth-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 12px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          color: #f1f0f8;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .dev-oauth-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(232, 184, 109, 0.3);
        }

        .dev-footer-link {
          text-align: center;
          margin-top: 24px;
          font-size: 14px;
          color: #8b8aa8;
        }

        .dev-link {
          color: #e8b86d;
          text-decoration: none;
          font-weight: 600;
          cursor: pointer;
        }

        .dev-link:hover {
          text-decoration: underline;
        }
      `}</style>

      <div className="dev-login-container">
        <div className="dev-login-logo-container">
          <div className="dev-login-logo" onClick={() => navigate('/developers')}>
            <div className="dev-login-logo-icon">🤖</div>
            <span>
              Nokki <span style={{ color: '#8b8aa8', fontWeight: 500 }}>Dev</span>
            </span>
          </div>
        </div>

        <div className="dev-login-card">
          <h1 className="dev-login-title">Willkommen zurück</h1>
          <p className="dev-login-subtitle">Melde dich an um deine Bots zu verwalten</p>

          {error && <div className="dev-error">{error}</div>}
          {notice && <div style={{background:'rgba(34,197,94,.1)',border:'1px solid rgba(34,197,94,.3)',borderRadius:8,padding:12,marginBottom:20,fontSize:13,color:'#86efac'}}>{notice}</div>}

          <form onSubmit={handleLogin}>
            <div className="dev-form-group">
              <label className="dev-label" htmlFor="email">
                E-Mail
              </label>
              <input
                type="email"
                id="email"
                className="dev-input"
                placeholder="dev@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="dev-form-group">
              <label className="dev-label" htmlFor="password">
                Passwort
              </label>
              <input
                type="password"
                id="password"
                className="dev-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="dev-checkbox-group">
              <input
                type="checkbox"
                id="remember"
                className="dev-checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <label htmlFor="remember" className="dev-checkbox-label">
                Angemeldet bleiben
              </label>
            </div>

            <button type="submit" className="dev-btn dev-btn-primary" disabled={loading}>
              {loading ? 'Anmeldung läuft...' : 'Anmelden'}
            </button>
          </form>

          <div className="dev-divider">oder</div>

          <div className="dev-oauth-buttons">
            <button className="dev-oauth-btn" onClick={loginWithGitHub}>
              <span style={{ fontSize: '20px' }}>🐙</span>
              <span>Mit GitHub anmelden</span>
            </button>
            <button className="dev-oauth-btn" onClick={loginWithGoogle}>
              <span style={{ fontSize: '20px' }}>🔵</span>
              <span>Mit Google anmelden</span>
            </button>
          </div>

          <div className="dev-footer-link">
            <span className="dev-link" onClick={() => navigate('/dev-forgot-password')}>
              Passwort vergessen?
            </span>
          </div>
        </div>

        <div className="dev-footer-link" style={{ marginTop: '24px' }}>
          Noch kein Account?{' '}
          <span className="dev-link" onClick={() => navigate('/dev-register')}>
            Jetzt registrieren
          </span>
        </div>
      </div>
    </div>
  );
};

export default DevLogin;
