import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import DevSidebar from './DevSidebar'
import { devFetch } from '../services/devApi'

const DevAnalytics: React.FC = () => {
  const nav = useNavigate()
  const [timeRange,    setTimeRange]    = useState('7d')
  const [loading,      setLoading]      = useState(true)
  const [bots,         setBots]         = useState<any[]>([])
  const [selectedBot,  setSelectedBot]  = useState<string>('')
  const [analytics,    setAnalytics]    = useState<any>(null)
  const [commandStats, setCommandStats] = useState<any>(null)
  const [error,        setError]        = useState('')

  const token = localStorage.getItem('nokki_dev_token')
  const days  = timeRange === '24h' ? 1 : timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90

  useEffect(() => {
    if (!token) return
    devFetch('/api/dev/bots', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        const list = data.bots || []
        setBots(list)
        if (list.length > 0) setSelectedBot(list[0].botId)
      })
      .catch(() => setError('Fehler beim Laden der Bots'))
  }, [])

  useEffect(() => {
    if (!selectedBot || !token) { setLoading(false); return }
    setLoading(true)
    setError('')
    Promise.all([
      devFetch(`/api/bot-analytics/${selectedBot}?days=${days}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      devFetch(`/api/bot-analytics/${selectedBot}/commands?days=${days}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ]).then(([a, cmd]) => {
      if (a.success)   setAnalytics(a.analytics)
      if (cmd.success) setCommandStats(cmd.stats)
    }).catch(() => setError('Fehler beim Laden der Analytics'))
      .finally(() => setLoading(false))
  }, [selectedBot, timeRange])

  const t           = analytics?.totals || {}
  const successRate = commandStats && commandStats.total > 0 ? Math.round(commandStats.successful / commandStats.total * 100) : 0
  const errorRate   = commandStats && commandStats.total > 0 ? Math.round(commandStats.failed    / commandStats.total * 100) : 0
  const avgLatency  = commandStats ? Math.round(commandStats.avgExecutionTime || 0) : 0
  const timeline    = analytics?.timeline || []

  const card: React.CSSProperties = {
    background: '#0d0f18',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 24,
  }

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#08090f', color:'#f1f0f8', fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      <DevSidebar active="analytics" />

      <div style={{ flex:1, padding:32, overflowY:'auto', maxHeight:'100vh' }}>
        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24, flexWrap:'wrap', gap:12 }}>
          <div>
            <h1 style={{ fontSize:32, fontWeight:900, marginBottom:8 }}>Analytics 📈</h1>
            <p style={{ color:'#8b8aa8' }}>Performance-Metriken und Nutzungsstatistiken</p>
          </div>
          <div style={{ display:'flex', gap:10 }}>
            {bots.length > 1 && (
              <select value={selectedBot} onChange={e => setSelectedBot(e.target.value)}
                style={{ padding:'10px 16px', borderRadius:8, background:'#0d0f18', border:'1px solid rgba(255,255,255,0.08)', color:'#f1f0f8', fontSize:14, cursor:'pointer' }}>
                {bots.map(b => <option key={b.botId} value={b.botId}>{b.name}</option>)}
              </select>
            )}
            <select value={timeRange} onChange={e => setTimeRange(e.target.value)}
              style={{ padding:'10px 16px', borderRadius:8, background:'#0d0f18', border:'1px solid rgba(255,255,255,0.08)', color:'#f1f0f8', fontSize:14, fontWeight:600, cursor:'pointer' }}>
              <option value="24h">Letzte 24 Stunden</option>
              <option value="7d">Letzte 7 Tage</option>
              <option value="30d">Letzte 30 Tage</option>
              <option value="90d">Letzte 90 Tage</option>
            </select>
          </div>
        </div>

        {error && (
          <div style={{ background:'rgba(220,38,38,0.1)', border:'1px solid rgba(220,38,38,0.2)', borderRadius:10, padding:'12px 16px', color:'#fca5a5', marginBottom:20 }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:300, flexDirection:'column', gap:16 }}>
            <div style={{ width:40, height:40, border:'3px solid rgba(232,184,109,0.3)', borderTopColor:'#e8b86d', borderRadius:'50%', animation:'spin .8s linear infinite' }} />
            <p style={{ color:'#8b8aa8' }}>Lade Analytics...</p>
          </div>
        ) : !analytics ? (
          <div style={{ ...card, textAlign:'center', padding:60 }}>
            <div style={{ fontSize:48, marginBottom:16 }}>📊</div>
            <h2 style={{ fontSize:20, fontWeight:700, marginBottom:8 }}>Keine Daten verfügbar</h2>
            <p style={{ color:'#8b8aa8', marginBottom:24 }}>
              {bots.length === 0 ? 'Erstelle zuerst einen Bot um Analytics zu sehen.' : 'Noch keine Aktivität für diesen Bot aufgezeichnet.'}
            </p>
            {bots.length === 0 && (
              <button onClick={() => nav('/dev-bots')} style={{ padding:'12px 24px', borderRadius:10, background:'linear-gradient(135deg,#b46a0e,#e8b86d)', border:'none', color:'#fff', cursor:'pointer', fontWeight:700 }}>
                Ersten Bot erstellen
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Stat Cards */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:16, marginBottom:24 }}>
              {[
                { label:'Nachrichten',      value: t.messages    || 0, color:'#4f6ef7', icon:'💬' },
                { label:'API Calls',         value: t.apiCalls    || 0, color:'#e8b86d', icon:'📡' },
                { label:'Aktive Nutzer',     value: t.activeUsers || 0, color:'#22c55e', icon:'👤' },
                { label:'Fehlerrate',        value: `${errorRate}%`,   color:'#ef4444', icon:'⚠️'  },
              ].map((s, i) => (
                <div key={i} style={card}>
                  <div style={{ fontSize:11, color:'#8b8aa8', fontWeight:600, letterSpacing:'.07em', textTransform:'uppercase', marginBottom:8 }}>{s.icon} {s.label}</div>
                  <div style={{ fontSize:28, fontWeight:900, color:s.color }}>{typeof s.value === 'number' ? s.value.toLocaleString() : s.value}</div>
                </div>
              ))}
            </div>

            {/* Timeline Chart */}
            {timeline.length > 0 && (
              <div style={{ ...card, marginBottom:24 }}>
                <h2 style={{ fontSize:16, fontWeight:700, marginBottom:20 }}>📈 Aktivitätsverlauf</h2>
                <div style={{ display:'flex', alignItems:'flex-end', gap:4, height:120 }}>
                  {timeline.map((day: any, i: number) => {
                    const max = Math.max(...timeline.map((d: any) => d.messages || d.count || 0), 1)
                    const val = day.messages || day.count || 0
                    const h   = Math.max(4, Math.round((val / max) * 100))
                    return (
                      <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                        <div style={{ fontSize:9, color:'#6b7280' }}>{val}</div>
                        <div style={{ width:'100%', height:`${h}%`, background:'linear-gradient(180deg,#4f6ef7,#3b5bd6)', borderRadius:'3px 3px 0 0', minHeight:4 }} />
                        <div style={{ fontSize:8, color:'#6b7280', whiteSpace:'nowrap' }}>
                          {new Date(day.date || day._id).toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit' })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Command Stats + Success Rate */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:24 }}>
              <div style={card}>
                <h2 style={{ fontSize:16, fontWeight:700, marginBottom:16 }}>⚡ Performance</h2>
                {[
                  { label:'Erfolgsrate',   value:`${successRate}%`, color:'#22c55e' },
                  { label:'Fehlerrate',    value:`${errorRate}%`,   color:'#ef4444' },
                  { label:'Ø Latenz',      value:`${avgLatency}ms`, color:'#e8b86d' },
                  { label:'Gesamt Calls',  value: commandStats?.total || 0, color:'#8b8aa8' },
                ].map((item, i) => (
                  <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                    <span style={{ color:'#8b8aa8', fontSize:13 }}>{item.label}</span>
                    <span style={{ color: item.color, fontWeight:700, fontSize:13 }}>{typeof item.value === 'number' ? item.value.toLocaleString() : item.value}</span>
                  </div>
                ))}
              </div>

              {/* Top Commands */}
              <div style={card}>
                <h2 style={{ fontSize:16, fontWeight:700, marginBottom:16 }}>🏆 Top Commands</h2>
                {analytics.commandsByType && Object.keys(analytics.commandsByType).length > 0 ? (
                  <table style={{ width:'100%', borderCollapse:'collapse' }}>
                    <thead>
                      <tr>
                        {['Command','Aufrufe','Anteil'].map(h => (
                          <th key={h} style={{ padding:'8px 10px', textAlign:'left', fontSize:11, fontWeight:700, color:'#8b8aa8', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(analytics.commandsByType).sort(([,a],[,b]) => (b as number)-(a as number)).slice(0,5).map(([cmd, count]) => {
                        const total = Object.values(analytics.commandsByType).reduce((s:any,v:any)=>s+v,0) as number
                        const pct   = Math.round((count as number)/total*100)
                        return (
                          <tr key={cmd}>
                            <td style={{ padding:'8px 10px', color:'#e8b86d', fontWeight:600 }}>/{cmd}</td>
                            <td style={{ padding:'8px 10px' }}>{count as number}</td>
                            <td style={{ padding:'8px 10px' }}>
                              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                <div style={{ flex:1, height:5, background:'rgba(255,255,255,0.08)', borderRadius:3 }}>
                                  <div style={{ width:`${pct}%`, height:'100%', background:'#b46a0e', borderRadius:3 }} />
                                </div>
                                <span style={{ fontSize:11, color:'#8b8aa8', minWidth:28 }}>{pct}%</span>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ textAlign:'center', padding:32, color:'#8b8aa8', fontSize:13 }}>Keine Command-Daten</div>
                )}
              </div>
            </div>

            {/* Letzte Ausführungen */}
            <div style={card}>
              <h2 style={{ fontSize:16, fontWeight:700, marginBottom:16 }}>🕐 Letzte Ausführungen</h2>
              {(commandStats?.recentUsages || []).length === 0 ? (
                <div style={{ textAlign:'center', padding:32, color:'#8b8aa8' }}>Keine Ausführungen aufgezeichnet</div>
              ) : (
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr>
                      {['Command','Status','Latenz','Zeit'].map(h => (
                        <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:11, fontWeight:700, color:'#8b8aa8', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {commandStats.recentUsages.map((u: any, i: number) => (
                      <tr key={i}>
                        <td style={{ padding:'10px 12px', color:'#e8b86d', fontWeight:600 }}>/{u.commandId}</td>
                        <td style={{ padding:'10px 12px' }}>
                          <span style={{ padding:'2px 8px', borderRadius:99, fontSize:11, fontWeight:600, background: u.success ? 'rgba(22,163,74,0.15)' : 'rgba(220,38,38,0.15)', color: u.success ? '#86efac' : '#fca5a5' }}>
                            {u.success ? 'OK' : 'Fehler'}
                          </span>
                        </td>
                        <td style={{ padding:'10px 12px', color:'#8b8aa8' }}>{u.executionTime || 0}ms</td>
                        <td style={{ padding:'10px 12px', color:'#8b8aa8', fontSize:12 }}>
                          {new Date(u.executedAt || u.createdAt).toLocaleString('de-DE', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
      <style dangerouslySetInnerHTML={{__html:'.spin-anim{animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}'}} />
    </div>
  )
}

export default DevAnalytics
