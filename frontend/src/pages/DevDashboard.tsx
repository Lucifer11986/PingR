import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import DevSidebar from './DevSidebar'
import { devFetch, logoutDevSession } from '../services/devApi'

interface Bot {
  id: string; name: string; description: string; botId: string
  status: 'active' | 'inactive'; createdAt: string
  stats: { totalMessages: number; apiCalls30d: number; lastActive: string; servers?: number }
}
interface Activity { type: string; title: string; description: string; createdAt: string }

const tk = () => localStorage.getItem('nokki_dev_token') || ''
const hdr = () => ({ Authorization: `Bearer ${tk()}`, 'Content-Type': 'application/json' })

/* ── Sparkline ── */
function Spark({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1)
  const pts = data.map((v, i) => `${4 + (i / (data.length - 1)) * 72},${28 - (v / max) * 24}`).join(' ')
  return <svg width="80" height="32"><polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" opacity="0.8" /></svg>
}

/* ── Perf Chart ── */
function PerfChart({ data }: { data: { date: string; calls: number; messages: number; errors: number }[] }) {
  if (!data.length) return <div style={{ color: 'rgba(255,255,255,.2)', fontSize: 12, textAlign: 'center', padding: '48px 0' }}>Keine Daten</div>
  const max = Math.max(...data.flatMap(d => [d.calls, d.messages, d.errors]), 1)
  const W = 600, H = 100, pl = 8, pr = 8, pt = 8, pb = 20
  const iw = W - pl - pr, ih = H - pt - pb
  const path = (key: 'calls' | 'messages' | 'errors') =>
    data.map((d, i) => `${i === 0 ? 'M' : 'L'}${pl + (i / (data.length - 1)) * iw},${pt + (1 - d[key] / max) * ih}`).join(' ')
  const fmt = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H }}>
      {[.25,.5,.75,1].map(f => <line key={f} x1={pl} y1={pt+(1-f)*ih} x2={W-pr} y2={pt+(1-f)*ih} stroke="rgba(255,255,255,.04)" strokeWidth="1" />)}
      <path d={path('calls')}    fill="none" stroke="#e8b86d" strokeWidth="1.5" strokeLinejoin="round" />
      <path d={path('messages')} fill="none" stroke="#8b5cf6" strokeWidth="1.5" strokeLinejoin="round" />
      <path d={path('errors')}   fill="none" stroke="#ef4444" strokeWidth="1.5" strokeLinejoin="round" strokeDasharray="3,2" />
      {data.filter((_, i) => i % Math.ceil(data.length / 7) === 0).map(d => {
        const i = data.indexOf(d)
        return <text key={i} x={pl + (i / (data.length - 1)) * iw} y={H - 2} fill="rgba(255,255,255,.2)" fontSize="9" textAnchor="middle">{fmt(d.date)}</text>
      })}
    </svg>
  )
}

const DevDashboard: React.FC = () => {
  const nav = useNavigate()
  const [bots,       setBots]       = useState<Bot[]>([])
  const [apiKey,     setApiKey]     = useState('')
  const [showKey,    setShowKey]    = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [loading,    setLoading]    = useState(true)
  const [newName,    setNewName]    = useState('')
  const [newDesc,    setNewDesc]    = useState('')
  const [creating,   setCreating]   = useState(false)
  const [copied,     setCopied]     = useState(false)
  const [activities, setActivities] = useState<Activity[]>([])
  const [chart,      setChart]      = useState<any[]>([])
  const [totals,     setTotals]     = useState({ calls: 0, messages: 0, errorRate: 0 })
  const poll = useRef<ReturnType<typeof setInterval>>()

  useEffect(() => { load(true); poll.current = setInterval(() => load(false), 30000); return () => clearInterval(poll.current) }, [])

  const load = async (showLoader = false) => {
    if (showLoader) setLoading(true)
    try {
      const [b, k, a, c] = await Promise.allSettled([
        devFetch('/api/dev/bots',              { headers: hdr() }).then(r => r.json()),
        devFetch('/api/dev/keys',              { headers: hdr() }).then(r => r.json()),
        devFetch('/api/dev/activity',          { headers: hdr() }).then(r => r.json()).catch(() => ({ activities: [] })),
        devFetch('/api/dev/analytics/chart',   { headers: hdr() }).then(r => r.json()).catch(() => ({ data: [], totals: {} })),
      ])
      if (b.status === 'fulfilled') setBots(b.value.bots || [])
      if (k.status === 'fulfilled' && k.value.apiKeyPrefix) setApiKey(k.value.apiKeyPrefix)
      if (a.status === 'fulfilled') setActivities(a.value.activities || [])
      if (c.status === 'fulfilled') { setChart(c.value.data || []); setTotals(c.value.totals || {}) }
    } finally { setLoading(false) }
  }

  const createBot = async () => {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const r = await devFetch('/api/dev/bots', { method: 'POST', headers: hdr(), body: JSON.stringify({ name: newName, description: newDesc, permissions: ['READ_MESSAGES','SEND_MESSAGES'] }) })
      if (r.ok) {
        setShowCreate(false); setNewName(''); setNewDesc('')
        setActivities(p => [{ type:'bot_created', title:`Bot "${newName}" wurde erstellt`, description:'Neuer Bot erfolgreich erstellt und aktiviert', createdAt: new Date().toISOString() }, ...p])
        load()
      }
    } finally { setCreating(false) }
  }

  const copy = async () => { if (!apiKey) return; await navigator.clipboard.writeText(apiKey); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  const logout = async () => { await logoutDevSession(); nav('/dev-login') }
  const ago = (d: string) => { const s = Math.floor((Date.now()-new Date(d).getTime())/1000); if(s<60) return 'gerade'; if(s<3600) return `vor ${Math.floor(s/60)} Min`; if(s<86400) return `vor ${Math.floor(s/3600)} Std`; return `vor ${Math.floor(s/86400)} Tagen` }
  const mkSpark = (base: number) => Array.from({ length: 14 }, () => Math.max(0, base))

  const activeBots    = bots.filter(b => b.status === 'active').length
  const totalCalls    = bots.reduce((s, b) => s + (b.stats?.apiCalls30d || 0), 0)
  const totalMessages = bots.reduce((s, b) => s + (b.stats?.totalMessages || 0), 0)

  const actIcons: Record<string, string> = { bot_created:'🤖', api_key:'🔑', welcome:'🎉', bot_error:'⚠️', message_sent:'💬', login:'🔐' }
  const actColors: Record<string, string> = { bot_created:'rgba(22,163,74,.15)', api_key:'rgba(79,110,247,.15)', welcome:'rgba(139,92,246,.15)', bot_error:'rgba(220,38,38,.15)', message_sent:'rgba(59,130,246,.15)', login:'rgba(34,197,94,.15)' }

  const inp: React.CSSProperties = { width:'100%', padding:'10px 14px', borderRadius:8, background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.1)', color:'#f1f0f8', fontSize:13, outline:'none', boxSizing:'border-box' as const }
  const card: React.CSSProperties = { background:'#0d0f18', border:'1px solid rgba(255,255,255,.07)', borderRadius:14, padding:20 }

  const emptyChart = Array.from({ length: 7 }, (_, i) => ({
    date: new Date(Date.now() - (6-i)*86400000).toISOString().slice(0,10),
    calls: 0, messages: 0, errors: 0
  }))

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#08090f', color:'#f1f0f8', fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      <DevSidebar active="dashboard" />

      <div style={{ flex:1, overflowY:'auto', maxHeight:'100vh' }}>

        {/* ── Header ── */}
        <div style={{ padding:'24px 28px 0', display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:12 }}>
          <div>
            <h1 style={{ fontSize:28, fontWeight:900, letterSpacing:'-.03em', marginBottom:4 }}>Willkommen zurück! 👋</h1>
            <p style={{ color:'#8b8aa8', fontSize:13 }}>Verwalte deine Bots und überwache die API-Performance</p>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => setShowCreate(true)} style={{ padding:'9px 18px', borderRadius:9, background:'linear-gradient(135deg,#b46a0e,#e8b86d)', border:'none', color:'#fff', cursor:'pointer', fontWeight:700, fontSize:13 }}>+ Neuer Bot</button>
            <button onClick={logout} style={{ padding:'9px 14px', borderRadius:9, background:'rgba(239,68,68,.08)', border:'1px solid rgba(239,68,68,.2)', color:'#f87171', cursor:'pointer', fontSize:13 }}>🚪 Abmelden</button>
          </div>
        </div>

        <div style={{ padding:'20px 28px', display:'flex', flexDirection:'column', gap:18 }}>

          {/* ── Stat Cards ── */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:12 }}>
            {[
              { label:'AKTIVE BOTS',      value:activeBots,    color:'#22c55e', sub:`${bots.length ? Math.round(activeBots/bots.length*100) : 0}% seit gestern` },
              { label:'GESAMT BOTS',      value:bots.length,   color:'#3b82f6', sub:'0% seit gestern' },
              { label:'API CALLS (30T)',   value:totalCalls,    color:'#f59e0b', sub:'0% seit gestern' },
              { label:'NACHRICHTEN (30T)', value:totalMessages, color:'#8b5cf6', sub:'0% seit gestern' },
            ].map((s, i) => (
              <div key={i} style={card}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                  <div style={{ fontSize:9, fontWeight:700, color:'#6b7280', letterSpacing:'.08em' }}>{s.label}</div>
                  <Spark data={mkSpark(s.value)} color={s.color} />
                </div>
                <div style={{ fontSize:28, fontWeight:900, color:s.color, letterSpacing:'-1px', marginBottom:4 }}>
                  {loading ? '—' : s.value.toLocaleString()}
                </div>
                <div style={{ fontSize:10, color:'#6b7280' }}>{s.sub}</div>
              </div>
            ))}
          </div>

          {/* ── API Key + Schnellzugriff ── */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:16 }}>
            <div style={card}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                <h2 style={{ fontSize:14, fontWeight:700, display:'flex', alignItems:'center', gap:7 }}>🔑 API Key</h2>
                <button onClick={() => nav('/dev-api-keys')} style={{ fontSize:11, color:'#e8b86d', background:'none', border:'none', cursor:'pointer', padding:0 }}>Schlüssel verwalten →</button>
              </div>
              <div style={{ display:'flex', gap:8, marginBottom:12 }}>
                <code style={{ flex:1, padding:'10px 14px', borderRadius:8, background:'rgba(0,0,0,.4)', color:'#e8b86d', fontSize:12, fontFamily:'monospace', border:'1px solid rgba(232,184,109,.15)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {apiKey || 'Kein Key vorhanden'}
                </code>
                <button onClick={() => nav('/dev-api-keys')} style={{ padding:'8px 16px', borderRadius:7, background:'linear-gradient(135deg,#b46a0e,#e8b86d)', border:'none', color:'#fff', cursor:'pointer', fontWeight:600, fontSize:12, flexShrink:0 }}>Verwalten</button>
              </div>
              <div style={{ display:'flex', gap:8, padding:'10px 12px', background:'rgba(59,130,246,.06)', border:'1px solid rgba(59,130,246,.15)', borderRadius:8 }}>
                <span style={{ fontSize:16, flexShrink:0 }}>🛡️</span>
                <div>
                  <div style={{ fontSize:11, fontWeight:600, color:'#93c5fd', marginBottom:2 }}>Sicherheitshinweis</div>
                  <div style={{ fontSize:11, color:'rgba(255,255,255,.35)', lineHeight:1.5 }}>Der vollständige Schlüssel wird nur direkt nach dem Erzeugen angezeigt.</div>
                </div>
              </div>
            </div>

            {/* Schnellzugriff */}
            <div style={card}>
              <h2 style={{ fontSize:14, fontWeight:700, marginBottom:14 }}>⚡ Schnellzugriff</h2>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
                {[
                  { icon:'+',  label:'Neuer Bot',           sub:'Erstelle einen neuen Bot',  color:'#22c55e', fn: () => setShowCreate(true) },
                  { icon:'📄', label:'Dokumentation',  sub:'Bot-Anleitungen öffnen',      color:'#3b82f6', fn: () => nav('/dev-wiki') },
                  { icon:'🔗', label:'Webhook',             sub:'Neue Webhook URL',           color:'#f59e0b', fn: () => nav('/dev-webhooks') },
                  { icon:'📊', label:'Analytics',           sub:'Detaillierte Statistiken',   color:'#8b5cf6', fn: () => nav('/dev-analytics') },
                  { icon:'🤖', label:'Bot Marktplatz',      sub:'Bots entdecken & installieren', color:'#e8b86d', fn: () => nav('/bot-store?from=dev') },
                ].map((item, i) => (
                  <div key={i} onClick={item.fn} style={{ padding:'10px', borderRadius:9, border:'1px solid rgba(255,255,255,.06)', background:'rgba(255,255,255,.02)', cursor:'pointer', transition:'all .15s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,.05)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,.02)'}>
                    <div style={{ width:26, height:26, borderRadius:7, background:`${item.color}20`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, marginBottom:5 }}>{item.icon}</div>
                    <div style={{ fontSize:11, fontWeight:600, color:'rgba(255,255,255,.8)', marginBottom:1 }}>{item.label}</div>
                    <div style={{ fontSize:10, color:'rgba(255,255,255,.3)' }}>{item.sub}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Bots + Aktivitäten ── */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:16 }}>

            {/* Deine Bots */}
            <div style={card}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                <h2 style={{ fontSize:14, fontWeight:700 }}>🤖 Deine Bots ({bots.length})</h2>
                <button onClick={() => nav('/dev-bots')} style={{ fontSize:11, color:'#e8b86d', background:'none', border:'none', cursor:'pointer', padding:0 }}>Alle verwalten →</button>
              </div>
              {loading ? (
                <div style={{ textAlign:'center', padding:32, color:'#8b8aa8' }}>
                  <div style={{ width:28, height:28, border:'2px solid #b46a0e', borderTopColor:'transparent', borderRadius:'50%', animation:'spin .8s linear infinite', margin:'0 auto 10px' }} />
                  Lade...
                </div>
              ) : bots.length === 0 ? (
                <div style={{ textAlign:'center', padding:'28px 20px' }}>
                  <div style={{ width:52, height:52, borderRadius:14, border:'2px dashed rgba(255,255,255,.1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, margin:'0 auto 12px', cursor:'pointer' }} onClick={() => setShowCreate(true)}>+</div>
                  <div style={{ fontSize:14, fontWeight:600, color:'rgba(255,255,255,.5)', marginBottom:4 }}>Neuen Bot erstellen</div>
                  <div style={{ fontSize:12, color:'rgba(255,255,255,.25)', marginBottom:12 }}>Erstelle deinen ersten Bot in wenigen Schritten</div>
                  <button onClick={() => setShowCreate(true)} style={{ padding:'7px 16px', borderRadius:8, background:'linear-gradient(135deg,#b46a0e,#e8b86d)', border:'none', color:'#fff', cursor:'pointer', fontWeight:600, fontSize:12 }}>Bot erstellen</button>
                </div>
              ) : bots.map(bot => {
                const online = bot.status === 'active'
                const created = new Date(bot.createdAt)
                const uptime  = Math.floor((Date.now() - created.getTime()) / 60000)
                return (
                  <div key={bot.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px', background:'rgba(255,255,255,.02)', border:'1px solid rgba(255,255,255,.05)', borderRadius:10, marginBottom:8 }}>
                    <div style={{ width:40, height:40, borderRadius:11, background:'linear-gradient(135deg,#1a1a2e,#2d2d4e)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>🤖</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:3 }}>
                        <span style={{ fontWeight:700, fontSize:13 }}>{bot.name}</span>
                        <span style={{ padding:'1px 6px', borderRadius:99, fontSize:9, fontWeight:700, background: online?'rgba(34,197,94,.12)':'rgba(107,114,128,.1)', color: online?'#22c55e':'#6b7280', border:`1px solid ${online?'rgba(34,197,94,.2)':'rgba(107,114,128,.15)'}` }}>
                          {online ? '🟢 Aktiv' : '⏸ Inaktiv'}
                        </span>
                      </div>
                      <div style={{ fontSize:10, color:'#6b7280', fontFamily:'monospace' }}>{bot.botId}</div>
                      <div style={{ fontSize:10, color:'rgba(255,255,255,.2)', marginTop:2 }}>
                        Erstellt: {created.toLocaleDateString('de-DE')} {online ? `· Seit ${uptime}m` : ''}
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:12, fontSize:11, color:'#8b8aa8', flexShrink:0 }}>
                      <div style={{ textAlign:'center' }}>
                        <div style={{ fontSize:14, fontWeight:700, color:'#f1f0f8' }}>{bot.stats?.totalMessages || 0}</div>
                        <div>Nachrichten (30T)</div>
                      </div>
                      <div style={{ textAlign:'center' }}>
                        <div style={{ fontSize:14, fontWeight:700, color:'#f1f0f8' }}>{bot.stats?.apiCalls30d || 0}</div>
                        <div>API Calls (30T)</div>
                      </div>
                      <div style={{ textAlign:'center' }}>
                        <div style={{ fontSize:14, fontWeight:700, color: online?'#22c55e':'rgba(255,255,255,.4)' }}>
                          {online ? 'Online' : 'Offline'}
                        </div>
                        <div>Status</div>
                      </div>
                    </div>
                    <button onClick={() => nav('/dev-bots')} style={{ padding:'6px 12px', borderRadius:7, background:'rgba(59,130,246,.08)', border:'1px solid rgba(59,130,246,.2)', color:'#93c5fd', cursor:'pointer', fontSize:11, flexShrink:0 }}>Verwalten →</button>
                  </div>
                )
              })}
            </div>

            {/* Aktivitäten + System */}
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div style={card}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                  <h2 style={{ fontSize:14, fontWeight:700 }}>⚡ Aktuelle Aktivitäten</h2>
                  <button onClick={() => nav('/dev-activity')} style={{ fontSize:11, color:'#e8b86d', background:'none', border:'none', cursor:'pointer', padding:0 }}>Alle →</button>
                </div>
                {activities.length === 0 ? (
                  <div style={{ textAlign:'center', padding:'16px 0', color:'rgba(255,255,255,.2)', fontSize:12 }}>Keine Aktivitäten</div>
                ) : activities.slice(0,5).map((a, i) => (
                  <div key={i} style={{ display:'flex', gap:9, padding:'7px 0', borderBottom: i<4?'1px solid rgba(255,255,255,.04)':'none' }}>
                    <div style={{ width:28, height:28, borderRadius:8, background: actColors[a.type]||'rgba(255,255,255,.05)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, flexShrink:0 }}>
                      {actIcons[a.type] || '📋'}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:600, marginBottom:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.title}</div>
                      <div style={{ fontSize:10, color:'rgba(255,255,255,.3)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.description}</div>
                    </div>
                    <div style={{ fontSize:10, color:'rgba(255,255,255,.25)', flexShrink:0 }}>{ago(a.createdAt)}</div>
                  </div>
                ))}
                <button onClick={() => nav('/dev-activity')} style={{ width:'100%', marginTop:10, padding:'7px', borderRadius:7, background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.06)', color:'rgba(255,255,255,.4)', cursor:'pointer', fontSize:11 }}>
                  Alle Aktivitäten anzeigen
                </button>
              </div>

              {/* API Status + System */}
              <div style={{ ...card, padding:14 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', background:'rgba(22,163,74,.06)', border:'1px solid rgba(22,163,74,.15)', borderRadius:8, cursor:'pointer', marginBottom:10 }} onClick={() => nav('/dev-status')}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:'#22c55e', boxShadow:'0 0 6px rgba(34,197,94,.5)', animation:'pulse 2s infinite' }} />
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:11, fontWeight:600, color:'#86efac' }}>API Status</div>
                    <div style={{ fontSize:10, color:'rgba(255,255,255,.3)' }}>Online</div>
                  </div>
                  <span style={{ fontSize:11, color:'rgba(255,255,255,.25)' }}>›</span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', background:'rgba(79,110,247,.06)', border:'1px solid rgba(79,110,247,.15)', borderRadius:8, cursor:'pointer' }} onClick={() => nav('/dev-status')}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:'#4f6ef7' }} />
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:11, fontWeight:600, color:'#a5b4fc' }}>System Status</div>
                    <div style={{ fontSize:10, color:'rgba(255,255,255,.3)' }}>Alle Systeme normal</div>
                  </div>
                  <span style={{ fontSize:11, color:'rgba(255,255,255,.25)' }}>›</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── API Performance Chart ── */}
          <div style={card}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, flexWrap:'wrap', gap:10 }}>
              <h2 style={{ fontSize:14, fontWeight:700 }}>📈 API Performance <span style={{ fontSize:11, color:'#8b8aa8', fontWeight:400 }}>(Letzte 7 Tage)</span></h2>
              <div style={{ display:'flex', gap:14, fontSize:11 }}>
                {[['#e8b86d','API Calls'],['#8b5cf6','Nachrichten'],['#ef4444','Fehler']].map(([col,label]) => (
                  <span key={label} style={{ display:'flex', alignItems:'center', gap:4 }}>
                    <span style={{ width:14, height:2, background:col, display:'inline-block', borderRadius:1 }} />{label}
                  </span>
                ))}
              </div>
            </div>
            <PerfChart data={chart.length ? chart : emptyChart} />
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginTop:14 }}>
              {[
                { label:'Gesamte API Calls',  value: totals.calls    || totalCalls,    color:'#e8b86d', sub:'0% seit letzter Woche' },
                { label:'Nachrichten gesamt', value: totals.messages || totalMessages, color:'#8b5cf6', sub:'0% seit letzter Woche' },
                { label:'Fehlerquote',         value: `${totals.errorRate || 0}%`,     color:'#ef4444', sub:'0% seit letzter Woche' },
              ].map((s, i) => (
                <div key={i} style={{ padding:'12px', background:'rgba(255,255,255,.02)', borderRadius:10, border:'1px solid rgba(255,255,255,.05)' }}>
                  <div style={{ fontSize:9, color:'#6b7280', fontWeight:700, letterSpacing:'.07em', marginBottom:4, textTransform:'uppercase' }}>{s.label}</div>
                  <div style={{ fontSize:22, fontWeight:900, color:s.color, marginBottom:2 }}>{typeof s.value === 'number' ? s.value.toLocaleString() : s.value}</div>
                  <div style={{ fontSize:10, color:'#6b7280' }}>{s.sub}</div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* ── Create Bot Modal ── */}
      {showCreate && (
        <div onClick={() => setShowCreate(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:20, backdropFilter:'blur(8px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ background:'#13141f', borderRadius:16, padding:28, maxWidth:480, width:'100%', border:'1px solid rgba(255,255,255,.08)', boxShadow:'0 24px 64px rgba(0,0,0,.6)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h2 style={{ fontSize:18, fontWeight:800 }}>🤖 Neuen Bot erstellen</h2>
              <button onClick={() => setShowCreate(false)} style={{ background:'none', border:'none', color:'#8b8aa8', fontSize:22, cursor:'pointer' }}>×</button>
            </div>
            <div style={{ background:'rgba(59,130,246,.08)', border:'1px solid rgba(59,130,246,.2)', borderRadius:8, padding:12, marginBottom:20, fontSize:12, color:'#93c5fd', lineHeight:1.6 }}>
              ℹ️ Der Bot bekommt automatisch READ_MESSAGES und SEND_MESSAGES. Weitere Rechte kannst du danach vergeben.
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:12, fontWeight:600, marginBottom:6, color:'rgba(255,255,255,.5)', textTransform:'uppercase', letterSpacing:'.05em' }}>Bot Name *</label>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="z.B. Welcome Bot, Giveaway Bot..." style={inp} autoFocus onKeyDown={e => e.key==='Enter' && createBot()} />
            </div>
            <div style={{ marginBottom:24 }}>
              <label style={{ display:'block', fontSize:12, fontWeight:600, marginBottom:6, color:'rgba(255,255,255,.5)', textTransform:'uppercase', letterSpacing:'.05em' }}>Beschreibung</label>
              <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Was macht dein Bot?" rows={3} style={{ ...inp, resize:'none' as const, lineHeight:1.5 }} />
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setShowCreate(false)} style={{ flex:1, padding:11, borderRadius:9, background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.1)', color:'#f1f0f8', cursor:'pointer' }}>Abbrechen</button>
              <button onClick={createBot} disabled={creating || !newName.trim()} style={{ flex:2, padding:11, borderRadius:9, background: newName.trim()?'linear-gradient(135deg,#b46a0e,#e8b86d)':'rgba(255,255,255,.06)', border:'none', color: newName.trim()?'#fff':'rgba(255,255,255,.3)', cursor: newName.trim()?'pointer':'not-allowed', fontWeight:700, opacity: creating?0.7:1 }}>
                {creating ? '⏳ Erstellt...' : '🤖 Bot erstellen'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
      `}</style>
    </div>
  )
}

export default DevDashboard
