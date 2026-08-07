import React, { useState, useEffect } from 'react'
import DevSidebar from './DevSidebar'
import { devFetch } from '../services/devApi'

interface Webhook {
  _id: string
  url: string
  events: string[]
  active: boolean
  createdAt: string
  stats?: { lastSuccess?: string; failedCalls?: number }
}

interface BotOption { botId: string; name: string; isMarketplace?: boolean }

interface DeliveryAttempt {
  attempt: number; startedAt: string; completedAt: string; durationMs: number
  httpStatus?: number; error?: string
}

interface WebhookDelivery {
  _id: string; event: string; url: string; status: 'pending'|'success'|'failed'
  attemptCount: number; attempts: DeliveryAttempt[]; lastHttpStatus?: number
  lastError?: string; durationMs?: number; replayOf?: string; createdAt: string
}

const EVENTS = [
  { id: 'message.create', label: 'message.create', desc: 'Eine Nachricht wurde erstellt' },
  { id: 'message.delete', label: 'message.delete', desc: 'Eine Nachricht wurde gelöscht' },
  { id: 'message.edit', label: 'message.edit', desc: 'Eine Nachricht wurde bearbeitet' },
  { id: 'member.join', label: 'member.join', desc: 'Ein Mitglied ist beigetreten' },
  { id: 'member.leave', label: 'member.leave', desc: 'Ein Mitglied hat die Gruppe verlassen' },
  { id: 'command.execute', label: 'command.execute', desc: 'Ein Bot-Befehl wurde ausgeführt' },
  { id: 'giveaway.start', label: 'giveaway.start', desc: 'Ein Giveaway wurde gestartet' },
  { id: 'giveaway.end', label: 'giveaway.end', desc: 'Ein Giveaway wurde beendet' },
]

const token = () => localStorage.getItem('nokki_dev_token') || ''

const DevWebhooks: React.FC = () => {
  const [webhooks, setWebhooks]         = useState<Webhook[]>([])
  const [bots, setBots]                 = useState<BotOption[]>([])
  const [selectedBot, setSelectedBot]   = useState('')
  const [loading, setLoading]           = useState(true)
  const [showModal, setShowModal]       = useState(false)
  const [showGuide, setShowGuide]       = useState(false)
  const [newUrl, setNewUrl]             = useState('')
  const [selectedEvents, setSelected]  = useState<string[]>(['message.create'])
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState('')
  const [testingId, setTestingId]       = useState<string | null>(null)
  const [testResult, setTestResult]     = useState<Record<string, string>>({})
  const [expandedId, setExpandedId]     = useState<string | null>(null)
  const [deliveries, setDeliveries]     = useState<Record<string, WebhookDelivery[]>>({})
  const [historyLoading, setHistoryLoading] = useState<string | null>(null)
  const [replayingId, setReplayingId]   = useState<string | null>(null)

  useEffect(() => {
    devFetch('/api/dev/bots', { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json()).then(d => {
        const own = (d.bots || []).filter((bot: BotOption) => !bot.isMarketplace)
        setBots(own)
        if (own[0]) setSelectedBot(own[0].botId)
        else setLoading(false)
      }).catch(() => setLoading(false))
  }, [])

  useEffect(() => { if (selectedBot) load(selectedBot) }, [selectedBot])

  const load = async (botId = selectedBot) => {
    setLoading(true)
    try {
      const r = await devFetch(`/api/bot-webhooks?botId=${encodeURIComponent(botId)}`, { headers: { Authorization: `Bearer ${token()}` } })
      const d = await r.json()
      setWebhooks(d.webhooks || [])
    } catch { setWebhooks([]) }
    finally { setLoading(false) }
  }

  const create = async () => {
    if (!newUrl.trim()) { setError('URL ist erforderlich'); return }
    if (!newUrl.startsWith('https://')) { setError('URL muss mit https:// beginnen'); return }
    if (selectedEvents.length === 0) { setError('Wähle mindestens ein Event'); return }
    setSaving(true); setError('')
    try {
      const r = await devFetch('/api/bot-webhooks', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ botId: selectedBot, url: newUrl, events: selectedEvents })
      })
      const d = await r.json()
      if (!r.ok) { setError(d.error || 'Fehler beim Erstellen'); return }
      setWebhooks(prev => [...prev, d.webhook])
      if (d.secret) alert(`Webhook erstellt. Secret jetzt sicher speichern – es wird nicht erneut angezeigt:\n\n${d.secret}`)
      setShowModal(false); setNewUrl(''); setSelected(['message.create'])
    } catch { setError('Verbindungsfehler') }
    finally { setSaving(false) }
  }

  const toggle = async (id: string, active: boolean) => {
    await devFetch(`/api/bot-webhooks/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !active })
    })
    setWebhooks(prev => prev.map(w => w._id === id ? { ...w, active: !active } : w))
  }

  const remove = async (id: string) => {
    if (!confirm('Webhook wirklich löschen?')) return
    await devFetch(`/api/bot-webhooks/${id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token()}` }
    })
    setWebhooks(prev => prev.filter(w => w._id !== id))
  }

  const test = async (id: string) => {
    setTestingId(id)
    try {
      const r = await devFetch(`/api/bot-webhooks/${id}/test`, {
        method: 'POST', headers: { Authorization: `Bearer ${token()}` }
      })
      const d = await r.json()
      setTestResult(prev => ({ ...prev, [id]: d.success ? `✅ Erfolgreich! HTTP ${d.httpStatus || '2xx'} in ${d.durationMs || 0} ms.` : `❌ Fehlgeschlagen: ${d.error}` }))
      if (expandedId === id) await loadDeliveries(id, false)
    } catch {
      setTestResult(prev => ({ ...prev, [id]: '❌ Verbindungsfehler' }))
    }
    setTestingId(null)
  }

  const loadDeliveries = async (webhookId: string, togglePanel = true) => {
    if (togglePanel && expandedId === webhookId) { setExpandedId(null); return }
    setExpandedId(webhookId); setHistoryLoading(webhookId)
    try {
      const r = await devFetch(`/api/bot-webhooks/${webhookId}/deliveries?limit=25`)
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Verlauf konnte nicht geladen werden')
      setDeliveries(prev => ({ ...prev, [webhookId]: d.deliveries || [] }))
    } catch (err: any) {
      setTestResult(prev => ({ ...prev, [webhookId]: `❌ ${err.message || 'Verlauf konnte nicht geladen werden'}` }))
    } finally { setHistoryLoading(null) }
  }

  const replay = async (webhookId: string, deliveryId: string) => {
    if (!confirm('Diese Webhook-Zustellung wirklich erneut senden?')) return
    setReplayingId(deliveryId)
    try {
      const r = await devFetch(`/api/bot-webhooks/${webhookId}/deliveries/${deliveryId}/replay`, { method: 'POST' })
      const d = await r.json()
      setTestResult(prev => ({ ...prev, [webhookId]: d.success ? `✅ Erneut gesendet: HTTP ${d.httpStatus || '2xx'} in ${d.durationMs || 0} ms.` : `❌ Wiederholung fehlgeschlagen: ${d.error}` }))
      await Promise.all([loadDeliveries(webhookId, false), load(selectedBot)])
    } catch { setTestResult(prev => ({ ...prev, [webhookId]: '❌ Wiederholung konnte nicht gestartet werden' })) }
    finally { setReplayingId(null) }
  }

  const toggleEvent = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id])

  const s = {
    card: { background: '#0d0f18', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '24px', marginBottom: '16px' } as React.CSSProperties,
    pre: { background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '14px', fontSize: '12px', fontFamily: 'monospace', color: '#86efac', overflowX: 'auto' as const, lineHeight: 1.7 },
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#08090f', color: '#f1f0f8' }}>
      <DevSidebar active="webhooks" />

      <div style={{ flex: 1, padding: '32px', overflowY: 'auto', maxHeight: '100vh' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '30px', fontWeight: 900, marginBottom: '6px' }}>Webhooks 🔔</h1>
            <p style={{ color: '#8b8aa8', fontSize: '14px' }}>Erhalte Echtzeit-Benachrichtigungen wenn Events in deinen Bots auftreten</p>
            <select value={selectedBot} onChange={e => setSelectedBot(e.target.value)} style={{ marginTop: 12, padding: '9px 12px', borderRadius: 8, background: '#13141f', color: '#f1f0f8', border: '1px solid rgba(255,255,255,.12)' }}>
              {bots.map(bot => <option key={bot.botId} value={bot.botId}>{bot.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => setShowGuide(!showGuide)} style={{ padding: '10px 18px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f1f0f8', cursor: 'pointer', fontSize: '13px' }}>
              {showGuide ? '✕ Guide schließen' : '📖 Wie funktioniert das?'}
            </button>
            <button onClick={() => setShowModal(true)} style={{ padding: '10px 20px', borderRadius: '8px', background: 'linear-gradient(135deg,#b46a0e,#e8b86d)', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
              + Neuer Webhook
            </button>
          </div>
        </div>

        {/* Erklärungs-Guide */}
        {showGuide && (
          <div style={{ ...s.card, background: '#0a0d1a', border: '1px solid rgba(232,184,109,0.2)', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px', color: '#e8b86d' }}>📖 Was sind Webhooks und wie nutze ich sie?</h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: '16px', marginBottom: '20px' }}>
              {[
                { step: '1', title: 'Webhook erstellen', desc: 'Trage die URL deines Servers ein und wähle Events aus für die du benachrichtigt werden willst.' },
                { step: '2', title: 'Server empfängt Event', desc: 'Wenn ein Event passiert (z.B. neue Nachricht) schickt Nokki automatisch eine POST-Anfrage an deine URL.' },
                { step: '3', title: 'Bot reagiert', desc: 'Dein Server verarbeitet das Event und kann über die API antworten — z.B. eine Nachricht senden.' },
              ].map(s => (
                <div key={s.step} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '16px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg,#b46a0e,#e8b86d)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '13px', marginBottom: '10px' }}>{s.step}</div>
                  <div style={{ fontWeight: 700, marginBottom: '6px', fontSize: '14px' }}>{s.title}</div>
                  <div style={{ color: '#8b8aa8', fontSize: '13px', lineHeight: 1.6 }}>{s.desc}</div>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ color: '#e8b86d', fontWeight: 700, fontSize: '14px', marginBottom: '8px' }}>Minimaler Server (Node.js/Express):</div>
              <pre style={s.pre}>{`const express = require('express');
const app = express();
app.use(express.json());

app.post('/webhook', (req, res) => {
  const { event, data } = req.body;
  console.log('Event:', event, data);

  if (event === 'message.create' && data.text === '/ping') {
    // Hier könntest du über die API antworten
    console.log('Ping empfangen!');
  }

  res.sendStatus(200); // WICHTIG: Immer 200 antworten!
});

app.listen(3000, () => console.log('Server läuft!'));`}</pre>
            </div>

            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '12px', fontSize: '13px', color: '#fca5a5' }}>
              ⚠️ <strong>Wichtig:</strong> Dein Server muss HTTPS verwenden. Für lokales Testen nutze <strong>ngrok</strong>: <code style={{ background: 'rgba(255,255,255,0.1)', padding: '1px 5px', borderRadius: '4px' }}>ngrok http 3000</code>
            </div>
          </div>
        )}

        {/* Webhook Liste */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#8b8aa8' }}>
            <div style={{ width: '36px', height: '36px', border: '3px solid #b46a0e', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            Lade Webhooks...
          </div>
        ) : webhooks.length === 0 ? (
          <div style={{ ...s.card, textAlign: 'center', padding: '64px' }}>
            <div style={{ fontSize: '56px', marginBottom: '16px' }}>🔔</div>
            <h3 style={{ fontSize: '20px', marginBottom: '8px' }}>Noch keine Webhooks</h3>
            <p style={{ color: '#8b8aa8', maxWidth: '420px', margin: '0 auto 24px', fontSize: '14px', lineHeight: 1.6 }}>
              Webhooks benachrichtigen deinen Server in Echtzeit wenn Events in deinen Bots auftreten — z.B. wenn eine neue Nachricht empfangen wird.
            </p>
            <button onClick={() => { setShowGuide(true); setShowModal(true) }} style={{ padding: '12px 24px', borderRadius: '8px', background: 'linear-gradient(135deg,#b46a0e,#e8b86d)', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
              Ersten Webhook erstellen
            </button>
          </div>
        ) : (
          <div>
            {webhooks.map(wh => (
              <div key={wh._id} style={s.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
                      <code style={{ background: 'rgba(232,184,109,0.1)', color: '#e8b86d', padding: '4px 10px', borderRadius: '6px', fontSize: '13px', wordBreak: 'break-all' }}>{wh.url}</code>
                      <span style={{ padding: '3px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: 700, background: wh.active ? 'rgba(34,197,94,0.12)' : 'rgba(107,114,128,0.12)', color: wh.active ? '#22c55e' : '#6b7280' }}>
                        {wh.active ? '🟢 Aktiv' : '⏸️ Pausiert'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                      {wh.events.map(e => (
                        <span key={e} style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '5px', background: 'rgba(59,130,246,0.12)', color: '#93c5fd', fontFamily: 'monospace' }}>{e}</span>
                      ))}
                    </div>
                    {testResult[wh._id] && (
                      <div style={{ fontSize: '12px', marginTop: '6px', color: testResult[wh._id].startsWith('✅') ? '#86efac' : '#fca5a5' }}>
                        {testResult[wh._id]}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button onClick={() => test(wh._id)} disabled={testingId === wh._id} style={{ padding: '7px 14px', borderRadius: '6px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', color: '#93c5fd', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
                      {testingId === wh._id ? '⏳...' : '🧪 Testen'}
                    </button>
                    <button onClick={() => loadDeliveries(wh._id)} style={{ padding: '7px 14px', borderRadius: '6px', background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.25)', color: '#c4b5fd', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
                      {expandedId === wh._id ? 'Verlauf schließen' : '📋 Verlauf'}
                    </button>
                    <button onClick={() => toggle(wh._id, wh.active)} style={{ padding: '7px 14px', borderRadius: '6px', background: wh.active ? 'rgba(234,179,8,0.1)' : 'rgba(34,197,94,0.1)', border: `1px solid ${wh.active ? 'rgba(234,179,8,0.25)' : 'rgba(34,197,94,0.25)'}`, color: wh.active ? '#fde047' : '#22c55e', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
                      {wh.active ? '⏸️ Pausieren' : '▶️ Aktivieren'}
                    </button>
                    <button onClick={() => remove(wh._id)} style={{ padding: '7px 14px', borderRadius: '6px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
                      🗑️
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '8px' }}>
                  Erstellt: {new Date(wh.createdAt).toLocaleString('de-DE')}
                  {wh.stats?.lastSuccess && ` · Zuletzt ausgelöst: ${new Date(wh.stats.lastSuccess).toLocaleString('de-DE')}`}
                  {(wh.stats?.failedCalls || 0) > 0 && <span style={{ color: '#f87171' }}> · {wh.stats?.failedCalls} Fehler</span>}
                </div>
                {expandedId === wh._id && <div style={{marginTop:16,paddingTop:16,borderTop:'1px solid rgba(255,255,255,.07)'}}>
                  <div style={{display:'flex',justifyContent:'space-between',gap:12,marginBottom:10}}>
                    <strong style={{fontSize:13}}>Letzte Zustellungen</strong><span style={{fontSize:11,color:'#6b7280'}}>30 Tage gespeichert · Payload verschlüsselt</span>
                  </div>
                  {historyLoading === wh._id ? <div style={{fontSize:12,color:'#8b8aa8'}}>Verlauf wird geladen…</div> : (deliveries[wh._id] || []).length === 0 ? <div style={{fontSize:12,color:'#8b8aa8'}}>Noch keine Zustellungen vorhanden.</div> :
                    <div style={{display:'grid',gap:8}}>{(deliveries[wh._id] || []).map(delivery => <div key={delivery._id} style={{display:'grid',gridTemplateColumns:'minmax(120px,1fr) auto auto auto',alignItems:'center',gap:12,padding:'10px 12px',borderRadius:8,background:'rgba(255,255,255,.025)',fontSize:12}}>
                      <div><code style={{color:'#93c5fd'}}>{delivery.event}</code><div style={{color:'#6b7280',marginTop:3}}>{new Date(delivery.createdAt).toLocaleString('de-DE')}{delivery.replayOf?' · Wiederholung':''}</div></div>
                      <span style={{color:delivery.status==='success'?'#86efac':delivery.status==='failed'?'#fca5a5':'#fde68a'}}>{delivery.status==='success'?'✓ Erfolgreich':delivery.status==='failed'?'✕ Fehlgeschlagen':'⏳ Ausstehend'}</span>
                      <span style={{color:'#8b8aa8'}}>{delivery.lastHttpStatus?`HTTP ${delivery.lastHttpStatus}`:'–'} · {delivery.durationMs ?? 0} ms · {delivery.attemptCount} Versuch{delivery.attemptCount===1?'':'e'}</span>
                      <button onClick={() => replay(wh._id, delivery._id)} disabled={!wh.active || replayingId===delivery._id} title={!wh.active?'Webhook zuerst aktivieren':''} style={{padding:'6px 10px',borderRadius:6,border:'1px solid rgba(232,184,109,.25)',background:'rgba(232,184,109,.08)',color:'#e8b86d',cursor:wh.active?'pointer':'not-allowed'}}>{replayingId===delivery._id?'…':'↻ Erneut'}</button>
                      {delivery.lastError && <div style={{gridColumn:'1 / -1',color:'#fca5a5',fontFamily:'monospace',wordBreak:'break-word'}}>{delivery.lastError}</div>}
                    </div>)}</div>}
                </div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showModal && (
        <div onClick={() => setShowModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#13141f', borderRadius: '16px', padding: '28px', maxWidth: '560px', width: '100%', border: '1px solid rgba(255,255,255,0.08)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Neuer Webhook</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: '#8b8aa8', fontSize: '24px', cursor: 'pointer' }}>×</button>
            </div>

            {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '10px 14px', color: '#fca5a5', fontSize: '13px', marginBottom: '16px' }}>{error}</div>}

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Webhook URL <span style={{ color: '#ef4444' }}>*</span></label>
              <input type="url" value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="https://dein-server.com/webhook"
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#f1f0f8', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px' }}>Muss HTTPS sein. Lokal testen? Nutze ngrok: <code style={{ color: '#e8b86d' }}>ngrok http 3000</code></div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '10px' }}>Events <span style={{ color: '#ef4444' }}>*</span></label>
              <div style={{ display: 'grid', gap: '8px' }}>
                {EVENTS.map(ev => (
                  <label key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: '8px', cursor: 'pointer', background: selectedEvents.includes(ev.id) ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.03)', border: `1px solid ${selectedEvents.includes(ev.id) ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.07)'}` }}>
                    <input type="checkbox" checked={selectedEvents.includes(ev.id)} onChange={() => toggleEvent(ev.id)} style={{ cursor: 'pointer', accentColor: '#3b82f6' }} />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, fontFamily: 'monospace', color: selectedEvents.includes(ev.id) ? '#93c5fd' : '#f1f0f8' }}>{ev.label}</div>
                      <div style={{ fontSize: '12px', color: '#8b8aa8' }}>{ev.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <button onClick={create} disabled={saving} style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'linear-gradient(135deg,#b46a0e,#e8b86d)', border: 'none', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '14px', opacity: saving ? 0.7 : 1 }}>
              {saving ? '⏳ Wird erstellt...' : '🔔 Webhook erstellen'}
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

export default DevWebhooks
