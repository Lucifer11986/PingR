import { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'

type Step = 'email' | 'code' | 'done'

export default function ForgotPassword() {
  const [step, setStep]           = useState<Step>('email')
  const [email, setEmail]         = useState('')
  const [resetCode, setResetCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [devCode, setDevCode]     = useState('')  // Nur für Dev-Modus
  const [error, setError]         = useState('')
  const [loading, setLoading]     = useState(false)

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/api/auth/forgot-password', { email })
      // Dev-Modus: Code direkt anzeigen
      if (data.resetCode) setDevCode(data.resetCode)
      setStep('code')
    } catch (_err) {
      setError('Fehler beim Anfordern des Codes.')
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (newPassword !== confirmPw) { setError('Passwörter stimmen nicht überein.'); return }
    if (newPassword.length < 10)   { setError('Passwort muss mindestens 10 Zeichen haben.'); return }
    setLoading(true)
    try {
      await api.post('/api/auth/reset-password', { email, resetCode, newPassword })
      setStep('done')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      setError('Code ungültig oder abgelaufen. Bitte neu anfordern.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-pingr-dark flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🔐</div>
          <h1 className="text-3xl font-bold text-white">Passwort vergessen</h1>
          <p className="text-white/40 mt-2 text-sm">
            {step === 'email' && 'Gib deine E-Mail ein um einen Reset-Code zu erhalten'}
            {step === 'code'  && 'Gib den Code und dein neues Passwort ein'}
            {step === 'done'  && 'Passwort erfolgreich zurückgesetzt!'}
          </p>
        </div>

        {/* Schritt-Indikator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {(['email', 'code', 'done'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                step === s ? 'bg-blue-600 text-white' :
                ['email', 'code', 'done'].indexOf(step) > i ? 'bg-green-600 text-white' :
                'bg-white/10 text-white/30'
              }`}>
                {['email', 'code', 'done'].indexOf(step) > i ? '✓' : i + 1}
              </div>
              {i < 2 && <div className={`w-8 h-0.5 ${['email', 'code', 'done'].indexOf(step) > i ? 'bg-green-600' : 'bg-white/10'}`} />}
            </div>
          ))}
        </div>

        {/* Schritt 1: E-Mail */}
        {step === 'email' && (
          <form onSubmit={handleRequestCode} className="bg-white/5 rounded-2xl p-6 border border-white/10 space-y-4">
            <div>
              <label className="block text-white/70 text-sm mb-1">E-Mail-Adresse</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="input-field" placeholder="deine@email.de" required autoFocus />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50">
              {loading ? 'Sende Code…' : 'Reset-Code anfordern'}
            </button>
          </form>
        )}

        {/* Schritt 2: Code + neues Passwort */}
        {step === 'code' && (
          <form onSubmit={handleResetPassword} className="bg-white/5 rounded-2xl p-6 border border-white/10 space-y-4">
            {/* Dev-Modus: Code anzeigen */}
            {devCode && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                <p className="text-yellow-300 text-xs font-bold mb-1">🔧 Entwicklungsmodus</p>
                <p className="text-yellow-200 text-xs mb-2">Dein Reset-Code (wird in Produktion per E-Mail gesendet):</p>
                <div className="text-3xl font-bold text-white tracking-widest text-center font-mono">
                  {devCode}
                </div>
                <button type="button" onClick={() => setResetCode(devCode)}
                  className="mt-2 w-full text-xs text-yellow-300 hover:text-yellow-200 transition-colors">
                  → Code automatisch einfügen
                </button>
              </div>
            )}
            <div>
              <label className="block text-white/70 text-sm mb-1">6-stelliger Reset-Code</label>
              <input type="text" value={resetCode} onChange={e => setResetCode(e.target.value)}
                className="input-field font-mono text-center text-xl tracking-widest"
                placeholder="000000" maxLength={6} required />
              <p className="text-white/30 text-xs mt-1">Code ist 15 Minuten gültig</p>
            </div>
            <div>
              <label className="block text-white/70 text-sm mb-1">Neues Passwort</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                className="input-field" placeholder="mindestens 10 Zeichen" minLength={10} required />
            </div>
            <div>
              <label className="block text-white/70 text-sm mb-1">Passwort bestätigen</label>
              <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
                className="input-field" placeholder="••••••••" required />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50">
              {loading ? 'Speichere…' : 'Passwort zurücksetzen'}
            </button>
            <button type="button" onClick={() => { setStep('email'); setDevCode(''); setError('') }}
              className="w-full text-sm text-white/40 hover:text-white/60 transition-colors">
              ← Neue E-Mail eingeben
            </button>
          </form>
        )}

        {/* Schritt 3: Fertig */}
        {step === 'done' && (
          <div className="bg-white/5 rounded-2xl p-8 border border-white/10 text-center space-y-4">
            <div className="text-5xl">🎉</div>
            <h2 className="text-xl font-bold text-white">Passwort geändert!</h2>
            <p className="text-white/50 text-sm">Du kannst dich jetzt mit deinem neuen Passwort anmelden.</p>
            <Link to="/login" className="btn-primary w-full inline-flex justify-center">
              Zum Login →
            </Link>
          </div>
        )}

        <p className="text-center text-white/40 text-sm mt-4">
          <Link to="/login" className="text-blue-400 hover:text-blue-300">← Zurück zum Login</Link>
        </p>
      </div>
    </div>
  )
}
