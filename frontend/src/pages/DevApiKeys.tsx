import React, { useState, useEffect } from 'react'
import DevSidebar from './DevSidebar'
import { devFetch } from '../services/devApi'

const token = () => localStorage.getItem('nokki_dev_token') || ''

const DevApiKeys: React.FC = () => {
  const [apiKey, setApiKey]     = useState('')
  const [apiKeyPrefix, setApiKeyPrefix] = useState('sk_live_…')
  const [showKey, setShowKey]   = useState(false)
  const [loading, setLoading]   = useState(true)
  const [copied, setCopied]     = useState(false)
  const [regen, setRegen]       = useState(false)
  const [showGuide, setShowGuide] = useState(false)

  useEffect(() => {
    const initial = sessionStorage.getItem('nokki_new_api_key') || ''
    if (initial) { setApiKey(initial); setShowKey(true); sessionStorage.removeItem('nokki_new_api_key') }
    fetchKey()
  }, [])

  const fetchKey = async () => {
    setLoading(true)
    try {
      const r = await devFetch('/api/dev/keys', { headers: { Authorization: `Bearer ${token()}` } })
      const d = await r.json()
      if (d.apiKeyPrefix) setApiKeyPrefix(d.apiKeyPrefix)
    } catch {}
    finally { setLoading(false) }
  }

  const copy = async () => {
    if (!apiKey) return
    await navigator.clipboard.writeText(apiKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const regenerate = async () => {
    if (!confirm('⚠️ API Key neu generieren?\n\nDer alte Key wird sofort ungültig!')) return
    setRegen(true)
    try {
      const r = await devFetch('/api/dev/keys/regenerate', { method: 'POST', headers: { Authorization: `Bearer ${token()}` } })
      const d = await r.json()
      if (r.ok) { setApiKey(d.apiKey); setShowKey(true); alert('✅ Neuer API Key generiert!') }
      else alert('❌ Fehler: ' + (d.error || 'Unbekannt'))
    } catch { alert('❌ Verbindungsfehler') }
    finally { setRegen(false) }
  }

  const displayKey = showKey && apiKey ? apiKey : apiKeyPrefix

  const pre: React.CSSProperties = {
    background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '10px', padding: '14px', fontSize: '12.5px',
    fontFamily: 'monospace', color: '#86efac', overflowX: 'auto', lineHeight: 1.7,
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#08090f', color: '#f1f0f8' }}>
      <DevSidebar active="api-keys" />

      <div style={{ flex: 1, padding: '32px', overflowY: 'auto', maxHeight: '100vh' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '30px', fontWeight: 900, marginBottom: '6px' }}>API Keys 🔑</h1>
            <p style={{ color: '#8b8aa8', fontSize: '14px' }}>Dein API Key gibt deinen Bots Zugriff auf die Nokki API</p>
          </div>
          <button onClick={() => setShowGuide(!showGuide)} style={{ padding: '9px 16px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f1f0f8', cursor: 'pointer', fontSize: '13px' }}>
            {showGuide ? '✕ Guide schließen' : '📖 Wie verwende ich den Key?'}
          </button>
        </div>

        {/* Guide */}
        {showGuide && (
          <div style={{ background: '#0a0d1a', border: '1px solid rgba(232,184,109,0.2)', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#e8b86d', marginBottom: '16px' }}>📖 So verwendest du den API Key</h2>

            <div style={{ display: 'grid', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#e8b86d', marginBottom: '8px' }}>1. Key sicher speichern (.env Datei)</div>
                <pre style={pre}>{`# .env Datei (NIE in Git committen!)
NOKKI_API_KEY=sk_live_dein_key_hier`}</pre>
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#e8b86d', marginBottom: '8px' }}>2. In jedem API Request als Header senden</div>
                <pre style={pre}>{`Authorization: Bearer sk_live_dein_key_hier`}</pre>
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#e8b86d', marginBottom: '8px' }}>3. Beispiel: Nachricht senden (curl)</div>
                <pre style={pre}>{`curl -X POST https://api.nokki.dev/v1/messages \\
  -H "Authorization: Bearer sk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"channel_id": "CHANNEL_ID", "text": "Hallo!"}'`}</pre>
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#e8b86d', marginBottom: '8px' }}>4. Beispiel: JavaScript</div>
                <pre style={pre}>{`const res = await devFetch('https://api.nokki.dev/v1/messages', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + process.env.NOKKI_API_KEY,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ channel_id: 'CHANNEL_ID', text: 'Hallo!' }),
});`}</pre>
              </div>
            </div>

            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '12px', marginTop: '16px', fontSize: '13px', color: '#fca5a5' }}>
              🚨 <strong>Sicherheitsregeln:</strong> Key nie im Code · Nie in Git · Nur in .env Dateien · Bei Verdacht sofort neu generieren
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#8b8aa8' }}>Lade API Key...</div>
        ) : (
          <>
            {/* Key Card */}
            <div style={{ background: '#0d0f18', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '24px', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>Dein API Key</h2>

              <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(232,184,109,0.15)', borderRadius: '10px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <code style={{ flex: 1, fontSize: '13px', fontFamily: 'monospace', color: '#e8b86d', wordBreak: 'break-all', minWidth: '200px' }}>
                  {displayKey}
                </code>
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  {apiKey && <button onClick={() => setShowKey(!showKey)}
                    style={{ padding: '7px 14px', borderRadius: '7px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#f1f0f8', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
                    {showKey ? '🙈 Verstecken' : '👁️ Anzeigen'}
                  </button>}
                  <button onClick={copy} disabled={!apiKey}
                    style={{ padding: '7px 14px', borderRadius: '7px', background: copied ? 'rgba(34,197,94,0.15)' : 'linear-gradient(135deg,#b46a0e,#e8b86d)', border: copied ? '1px solid rgba(34,197,94,0.3)' : 'none', color: copied ? '#86efac' : '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
                    {copied ? '✅ Kopiert!' : apiKey ? '📋 Kopieren' : 'Nur nach Erzeugung kopierbar'}
                  </button>
                </div>
              </div>

              <div style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '16px', flexShrink: 0 }}>⚠️</span>
                <div style={{ fontSize: '13px', color: '#fde047', lineHeight: 1.6 }}>
                  <strong>Der vollständige Key wird nur einmal angezeigt.</strong> Speichere ihn sicher. Bei Verlust musst du einen neuen erzeugen.
                </div>
              </div>

              <button onClick={regenerate} disabled={regen} style={{ padding: '9px 20px', borderRadius: '7px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', cursor: regen ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '13px' }}>
                {regen ? '⏳ Generiere...' : '🔄 Neuen Key generieren'}
              </button>
            </div>

            {/* Rate Limits */}
            <div style={{ background: '#0d0f18', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '24px', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>⚡ Rate Limits</h2>
              <div style={{ display: 'grid', gap: '10px' }}>
                {[
                  { label: 'Requests pro Minute', value: '60', color: '#3b82f6' },
                  { label: 'Requests pro Stunde', value: '3.600', color: '#f59e0b' },
                  { label: 'Requests pro Tag', value: '100.000', color: '#22c55e' },
                ].map((l, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                    <span style={{ color: '#8b8aa8', fontSize: '13px' }}>{l.label}</span>
                    <span style={{ fontSize: '17px', fontWeight: 800, color: l.color }}>{l.value}</span>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '12px' }}>
                💡 Bei Überschreitung: HTTP 429 — 60 Sekunden warten und erneut versuchen.
              </p>
            </div>

            {/* Fehler-Codes */}
            <div style={{ background: '#0d0f18', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '24px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>📋 Häufige Fehler-Codes</h2>
              <div style={{ display: 'grid', gap: '8px' }}>
                {[
                  { code: '401', label: 'Unauthorized', desc: 'API Key fehlt oder ist ungültig', color: '#ef4444' },
                  { code: '403', label: 'Forbidden', desc: 'Keine Berechtigung für diese Aktion (Permissions prüfen)', color: '#f59e0b' },
                  { code: '429', label: 'Too Many Requests', desc: 'Rate Limit erreicht — 60 Sekunden warten', color: '#f59e0b' },
                  { code: '500', label: 'Server Error', desc: 'Interner Fehler — später nochmal versuchen', color: '#6b7280' },
                ].map(e => (
                  <div key={e.code} style={{ display: 'flex', alignItems: 'center', gap: '14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', padding: '10px 14px' }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 800, color: e.color, minWidth: '36px', fontSize: '14px' }}>{e.code}</span>
                    <span style={{ fontWeight: 700, fontSize: '13px', minWidth: '130px' }}>{e.label}</span>
                    <span style={{ color: '#8b8aa8', fontSize: '13px' }}>{e.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default DevApiKeys
