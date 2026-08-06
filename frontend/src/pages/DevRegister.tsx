import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const DevRegister: React.FC = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);

  const calculatePasswordStrength = (pwd: string) => {
    let strength = 0;
    if (pwd.length >= 8) strength++;
    if (pwd.match(/[a-z]/) && pwd.match(/[A-Z]/)) strength++;
    if (pwd.match(/[0-9]/)) strength++;
    if (pwd.match(/[^a-zA-Z0-9]/)) strength++;
    setPasswordStrength(strength);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pwd = e.target.value;
    setPassword(pwd);
    calculatePasswordStrength(pwd);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password !== passwordConfirm) {
      setError('Passwörter stimmen nicht überein');
      return;
    }

    if (!terms) {
      setError('Bitte akzeptiere die Nutzungsbedingungen');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/dev/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('✅ Account erstellt! Du wirst zum Dashboard weitergeleitet.');
        if (data.apiKey) sessionStorage.setItem('nokki_new_api_key', data.apiKey);
        localStorage.setItem('nokki_dev_token', data.token);
        setTimeout(() => {
          navigate('/dev-dashboard');
        }, 2000);
      } else {
        setError(data.error || 'Registrierung fehlgeschlagen');
      }
    } catch (err) {
      setError('Verbindungsfehler. Bitte versuche es später erneut.');
    } finally {
      setLoading(false);
    }
  };

  const signupWithGitHub = () => {
    window.location.href = '/api/dev/auth/github';
  };

  const signupWithGoogle = () => {
    window.location.href = '/api/dev/auth/google';
  };

  const getStrengthClass = () => {
    if (passwordStrength <= 1) return 'strength-weak';
    if (passwordStrength <= 3) return 'strength-medium';
    return 'strength-strong';
  };

  return (
    <div className="dev-register-page">
      <style>{`
        .dev-register-page {
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

        .dev-register-container {
          max-width: 440px;
          width: 100%;
        }

        .dev-register-logo-container {
          text-align: center;
          margin-bottom: 40px;
        }

        .dev-register-logo {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          font-size: 24px;
          font-weight: 800;
          cursor: pointer;
        }

        .dev-register-logo-icon {
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

        .dev-register-card {
          background: #0d0f18;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          padding: 40px;
        }

        .dev-register-title {
          font-size: 28px;
          font-weight: 800;
          text-align: center;
          margin-bottom: 10px;
          letter-spacing: -0.8px;
        }

        .dev-register-subtitle {
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

        .dev-success {
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.3);
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 20px;
          font-size: 13px;
          color: #86efac;
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

        .password-strength {
          margin-top: 8px;
          height: 4px;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 2px;
          overflow: hidden;
        }

        .password-strength-bar {
          height: 100%;
          transition: all 0.3s;
          border-radius: 2px;
        }

        .strength-weak {
          width: 33%;
          background: #ef4444;
        }

        .strength-medium {
          width: 66%;
          background: #eab308;
        }

        .strength-strong {
          width: 100%;
          background: #22c55e;
        }

        .dev-checkbox-group {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          margin-top: 12px;
        }

        .dev-checkbox {
          width: auto;
          margin: 4px 0 0 0;
          flex-shrink: 0;
        }

        .dev-checkbox-label {
          margin: 0;
          font-weight: 400;
          font-size: 13px;
          color: #8b8aa8;
          line-height: 1.5;
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

      <div className="dev-register-container">
        <div className="dev-register-logo-container">
          <div className="dev-register-logo" onClick={() => navigate('/developers')}>
            <div className="dev-register-logo-icon">🤖</div>
            <span>
              Nokki <span style={{ color: '#8b8aa8', fontWeight: 500 }}>Dev</span>
            </span>
          </div>
        </div>

        <div className="dev-register-card">
          <h1 className="dev-register-title">Erstelle deinen Account</h1>
          <p className="dev-register-subtitle">Kostenlos starten – keine Kreditkarte erforderlich</p>

          {error && <div className="dev-error">{error}</div>}
          {success && <div className="dev-success">{success}</div>}

          <form onSubmit={handleRegister}>
            <div className="dev-form-group">
              <label className="dev-label" htmlFor="username">
                Benutzername
              </label>
              <input
                type="text"
                id="username"
                className="dev-input"
                placeholder="developerxyz"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                pattern="[a-zA-Z0-9_-]{3,20}"
                title="3-20 Zeichen, nur Buchstaben, Zahlen, - und _"
                required
              />
            </div>

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
                placeholder="Mindestens 10 Zeichen"
                value={password}
                onChange={handlePasswordChange}
                minLength={10}
                required
              />
              <div className="password-strength">
                <div className={`password-strength-bar ${getStrengthClass()}`}></div>
              </div>
            </div>

            <div className="dev-form-group">
              <label className="dev-label" htmlFor="password-confirm">
                Passwort bestätigen
              </label>
              <input
                type="password"
                id="password-confirm"
                className="dev-input"
                placeholder="Passwort wiederholen"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                required
              />
            </div>

            <div className="dev-checkbox-group">
              <input
                type="checkbox"
                id="terms"
                className="dev-checkbox"
                checked={terms}
                onChange={(e) => setTerms(e.target.checked)}
                required
              />
              <label htmlFor="terms" className="dev-checkbox-label">
                Ich akzeptiere die{' '}
                <span className="dev-link" onClick={() => navigate('/terms')}>
                  Nutzungsbedingungen
                </span>{' '}
                und{' '}
                <span className="dev-link" onClick={() => navigate('/privacy')}>
                  Datenschutzerklärung
                </span>
              </label>
            </div>

            <button type="submit" className="dev-btn dev-btn-primary" disabled={loading}>
              {loading ? 'Account wird erstellt...' : 'Account erstellen'}
            </button>
          </form>

          <div className="dev-divider">oder</div>

          <div className="dev-oauth-buttons">
            <button className="dev-oauth-btn" onClick={signupWithGitHub}>
              <span style={{ fontSize: '20px' }}>🐙</span>
              <span>Mit GitHub registrieren</span>
            </button>
            <button className="dev-oauth-btn" onClick={signupWithGoogle}>
              <span style={{ fontSize: '20px' }}>🔵</span>
              <span>Mit Google registrieren</span>
            </button>
          </div>
        </div>

        <div className="dev-footer-link" style={{ marginTop: '24px' }}>
          Bereits registriert?{' '}
          <span className="dev-link" onClick={() => navigate('/dev-login')}>
            Jetzt anmelden
          </span>
        </div>
      </div>
    </div>
  );
};

export default DevRegister;
