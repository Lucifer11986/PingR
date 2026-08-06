import { lazy, Suspense, useEffect, useRef, useCallback, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const Chat = lazy(() => import('./pages/Chat'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const Landing = lazy(() => import('./pages/Landing'))
import api from './services/api'

// ========== DEVELOPER PORTAL ==========
const DevPortal = lazy(() => import('./pages/DevPortal'))
const DevLogin = lazy(() => import('./pages/DevLogin'))
const DevRegister = lazy(() => import('./pages/DevRegister'))
const DevOAuthCallback = lazy(() => import('./pages/DevOAuthCallback'))
const DevForgotPassword = lazy(() => import('./pages/DevForgotPassword'))
const DevResetPassword = lazy(() => import('./pages/DevResetPassword'))
const DevDashboard = lazy(() => import('./pages/DevDashboard'))
const DevBots = lazy(() => import('./pages/DevBots'))
const DevSettings = lazy(() => import('./pages/DevSettings'))
const DevAnalytics = lazy(() => import('./pages/DevAnalytics'))
const DevWebhooks = lazy(() => import('./pages/DevWebhooks'))
const DevApiKeys = lazy(() => import('./pages/DevApiKeys'))
const DevWiki = lazy(() => import('./pages/DevWiki'))

// ========== NEUE FEATURES ==========
const InstallBotPage = lazy(() => import('./pages/InstallBotPage'))
const DevBotInstallations = lazy(() => import('./pages/DevBotInstallations'))
const DevActivity = lazy(() => import('./pages/DevActivity'))
const BotStore = lazy(() => import('./pages/BotStore'))

// ========== GUARDS ==========
import DevPrivateRoute from './components/DevPrivateRoute'
import DevPublicOnlyRoute from './components/DevPublicOnlyRoute'

import './index.css'

// ── Auto-Logout Konfiguration ────────────────────────────────────────────────
const INACTIVITY_MS = 30 * 60 * 1000  // 30 Minuten
// const INACTIVITY_MS = 60 * 60 * 1000 // 1 Stunde
// const INACTIVITY_MS = 2 * 60 * 1000  // 2 Minuten (zum Testen)

const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'click', 'scroll']

// ── Auto-Logout Hook ─────────────────────────────────────────────────────────
function useAutoLogout() {
  const { token, logout } = useAuthStore()
  const navigate          = useNavigate()
  const timerRef          = useRef<ReturnType<typeof setTimeout>>()

  const resetTimer = useCallback(() => {
    clearTimeout(timerRef.current)
    if (!token) return
    timerRef.current = setTimeout(() => {
      logout()
      // Dev Portal hat eigene Auth - nicht zu /login weiterleiten
      const isDevPortal = window.location.pathname.startsWith('/dev')
      if (!isDevPortal) {
        navigate('/login', { replace: true })
        sessionStorage.setItem('pingr_session_expired', '1')
      }
    }, INACTIVITY_MS)
  }, [token, logout, navigate])

  useEffect(() => {
    if (!token) { clearTimeout(timerRef.current); return }
    resetTimer()
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, resetTimer, { passive: true }))
    return () => {
      clearTimeout(timerRef.current)
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, resetTimer))
    }
  }, [token, resetTimer])
}

// ── Trusted Device Banner ─────────────────────────────────────────────────────
function TrustDeviceBanner() {
  const token = useAuthStore(s => s.token)
  const [show,    setShow]    = useState(false)
  const [days,    setDays]    = useState(30)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Banner zeigen wenn Flag nach Login gesetzt wurde
    if (token && sessionStorage.getItem('pingr_show_trust_banner') === '1') {
      setShow(true)
      sessionStorage.removeItem('pingr_show_trust_banner')
    }
  }, [token])

  const trust = async () => {
    setLoading(true)
    try {
      const { data } = await api.post('/api/auth/trust-device', { days })
      localStorage.setItem('pingr_trusted_device', data.token)
      localStorage.setItem('pingr_trusted_expires', data.expires)
    } catch (_e) {}
    setShow(false)
    setLoading(false)
  }

  if (!show) return null

  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      zIndex: 9999, background: '#0d0f18',
      border: '1px solid rgba(232,184,109,0.35)', borderRadius: 16,
      padding: '16px 20px', boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
      maxWidth: 500, width: 'calc(100% - 32px)',
    }}>
      <div style={{ flex: 1, minWidth: 180 }}>
        <p style={{ fontWeight: 700, fontSize: 13, color: 'rgba(255,255,255,0.92)', marginBottom: 3 }}>
          🔐 Neues Gerät erkannt
        </p>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.55, margin: 0 }}>
          Diesem Gerät vertrauen — keine Sicherheits-E-Mails mehr für dieses Gerät.
        </p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <select
          value={days}
          onChange={e => setDays(Number(e.target.value))}
          style={{
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8, padding: '6px 10px', color: 'white', fontSize: 12,
            outline: 'none', colorScheme: 'dark' as const, cursor: 'pointer',
          }}
        >
          <option value={7}>7 Tage</option>
          <option value={30}>30 Tage</option>
          <option value={90}>90 Tage</option>
          <option value={365}>1 Jahr</option>
        </select>
        <button
          onClick={trust}
          disabled={loading}
          style={{
            background: 'linear-gradient(135deg,#b46a0e,#e8b86d)', border: 'none',
            borderRadius: 9, padding: '7px 16px', color: 'white', fontSize: 12,
            fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1, whiteSpace: 'nowrap' as const,
          }}
        >
          {loading ? '…' : 'Vertrauen'}
        </button>
        <button
          onClick={() => setShow(false)}
          style={{
            background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)',
            cursor: 'pointer', fontSize: 18, padding: '2px 6px', lineHeight: 1,
          }}
        >
          ✕
        </button>
      </div>
    </div>
  )
}

// ── Private Route (Chat) ──────────────────────────────────────────────────────
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore(s => s.token)
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

// ── Public-Only Route (Chat Login/Register) ───────────────────────────────────
function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore(s => s.token)
  return token ? <Navigate to="/chat" replace /> : <>{children}</>
}

// ── Routing ───────────────────────────────────────────────────────────────────
function AppRoutes() {
  const { token, fetchMe } = useAuthStore()
  useAutoLogout()

  useEffect(() => {
    if (token) fetchMe()
  }, [token, fetchMe])

  return (
    <Suspense fallback={<div style={{ minHeight:'100vh', display:'grid', placeItems:'center', background:'#08090f', color:'#e8b86d' }}>Nokki wird geladen…</div>}>
    <Routes>
      {/* ========== CHAT APP ========== */}
      {/* Landing Page — immer erreichbar */}
      <Route path="/"        element={<Landing />} />
      <Route path="/landing" element={<Landing />} />

      {/* Auth — nur wenn NICHT eingeloggt */}
      <Route path="/login"           element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
      <Route path="/register"        element={<PublicOnlyRoute><Register /></PublicOnlyRoute>} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      {/* Chat — nur wenn eingeloggt */}
      <Route path="/chat"   element={<PrivateRoute><Chat /></PrivateRoute>} />
      <Route path="/chat/*" element={<PrivateRoute><Chat /></PrivateRoute>} />

      {/* ========== DEVELOPER PORTAL ========== */}
      {/* Developer Landing — immer erreichbar */}
      <Route path="/developers" element={<DevPortal />} />

      {/* Developer Auth — nur wenn NICHT eingeloggt (Dev) */}
      <Route path="/dev-login" element={
        <DevPublicOnlyRoute><DevLogin /></DevPublicOnlyRoute>
      } />
      <Route path="/dev-register" element={
        <DevPublicOnlyRoute><DevRegister /></DevPublicOnlyRoute>
      } />
      <Route path="/dev-oauth-callback" element={<DevOAuthCallback />} />
      <Route path="/dev-forgot-password" element={<DevForgotPassword />} />
      <Route path="/dev-reset-password" element={<DevResetPassword />} />

      {/* Developer Dashboard — nur wenn eingeloggt (Dev) */}
      <Route path="/dev-dashboard" element={
        <DevPrivateRoute><DevDashboard /></DevPrivateRoute>
      } />
      <Route path="/dev-bots" element={
        <DevPrivateRoute><DevBots /></DevPrivateRoute>
      } />
      <Route path="/dev-api-keys" element={
        <DevPrivateRoute><DevApiKeys /></DevPrivateRoute>
      } />
      <Route path="/dev-analytics" element={
        <DevPrivateRoute><DevAnalytics /></DevPrivateRoute>
      } />
      <Route path="/dev-activity" element={
        <DevPrivateRoute><DevActivity /></DevPrivateRoute>
      } />
      <Route path="/dev-webhooks" element={
        <DevPrivateRoute><DevWebhooks /></DevPrivateRoute>
      } />
      <Route path="/dev-settings" element={
        <DevPrivateRoute><DevSettings /></DevPrivateRoute>
      } />
      <Route path="/dev-wiki" element={
        <DevPrivateRoute><DevWiki /></DevPrivateRoute>
      } />

      {/* ========== NEUE FEATURES ========== */}
      
      {/* Bot Installation - Öffentlich zugänglich (kein Login nötig) */}
      <Route path="/install-bot" element={<InstallBotPage />} />
      
      {/* Bot Installations Manager - Nur für eingeloggte Devs */}
      <Route path="/dev-bots/:botId/installations" element={
        <DevPrivateRoute><DevBotInstallations /></DevPrivateRoute>
      } />

      {/* Bot Store/Marketplace - Öffentlich zugänglich */}
      <Route path="/bot-store" element={<BotStore />} />

      {/* Fallback */}
      <Route path="/*" element={
        token ? <Navigate to="/chat" replace /> : <Navigate to="/login" replace />
      } />
    </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
      <TrustDeviceBanner />
    </BrowserRouter>
  )
}
