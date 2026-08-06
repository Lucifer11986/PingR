import { useEffect } from 'react'
import { useAuthStore } from '../store/authStore'

// Die Landing Page ist als statische HTML-Datei unter /public/landing.html
// Diese Komponente leitet den Browser dorthin weiter.
// Warum nicht React? Die Landing Page hat eigenes CSS/JS und soll
// kein React-Bundle laden — das macht sie schneller für Besucher.

export default function Landing() {
  const token = useAuthStore(s => s.token)

  useEffect(() => {
    // Zur statischen Landing HTML weiterleiten
    // ?from=app verhindert Browser-Cache-Probleme
    window.location.replace('/landing.html')
  }, [])

  // Kurzes Lade-Overlay während des Redirects
  return (
    <div style={{
      minHeight: '100vh',
      background: '#08090f',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: 16,
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: 14,
        background: 'linear-gradient(135deg,#b46a0e,#e8b86d)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22,
        boxShadow: '0 0 0 12px rgba(232,184,109,0.06), 0 8px 32px rgba(180,106,14,0.3)',
        animation: 'pulse 1.5s ease-in-out infinite',
      }}>
        ??
      </div>
      <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Lädt…</p>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.6}}`}</style>
    </div>
  )
}