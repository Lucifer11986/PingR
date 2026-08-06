import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import DevSidebar from './DevSidebar'
import { devFetch } from '../services/devApi'

interface Activity {
  type: string
  title: string
  description: string
  createdAt: string
  meta?: Record<string, string>
}

const tk = () => localStorage.getItem('nokki_dev_token') || ''

const actIcons: Record<string, string> = {
  bot_created:   '🤖',
  api_key:       '🔑',
  welcome:       '🎉',
  bot_error:     '⚠️',
  message_sent:  '💬',
  login:         '🔐',
  bot_deleted:   '🗑️',
  webhook:       '🔗',
  install:       '📦',
}

const actColors: Record<string, string> = {
  bot_created:   'rgba(22,163,74,.15)',
  api_key:       'rgba(79,110,247,.15)',
  welcome:       'rgba(139,92,246,.15)',
  bot_error:     'rgba(220,38,68,.15)',
  message_sent:  'rgba(59,130,246,.15)',
  login:         'rgba(34,197,94,.15)',
  bot_deleted:   'rgba(239,68,68,.12)',
  webhook:       'rgba(245,158,11,.15)',
  install:       'rgba(14,165,233,.15)',
}

const DevActivity: React.FC = () => {
  const nav = useNavigate()
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading,    setLoading]    = useState(true)
  const [filter,     setFilter]     = useState<string>('all')

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try {
      const r = await devFetch('/api/dev/activity', {
        headers: { Authorization: `Bearer ${tk()}` }
      })
      const d = await r.json()
      setActivities(d.activities || [])
    } catch {} finally { setLoading(false) }
  }

  const ago = (d: string) => {
    const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
    if (s < 60)     return 'gerade'
    if (s < 3600)   return `vor ${Math.floor(s / 60)} Min`
    if (s < 86400)  return `vor ${Math.floor(s / 3600)} Std`
    if (s < 604800) return `vor ${Math.floor(s / 86400)} Tagen`
    return new Date(d).toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit', year:'2-digit' })
  }

  const fullDate = (d: string) =>
    new Date(d).toLocaleString('de-DE', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })

  const types = ['all', ...Array.from(new Set(activities.map(a => a.type)))]

  const filtered = filter === 'all'
    ? activities
    : activities.filter(a => a.type === filter)

  // Aktivitäten nach Datum gruppieren
  const grouped: Record<string, Activity[]> = {}
  filtered.forEach(a => {
    const d = new Date(a.createdAt)
    const now = new Date()
    let key: string
    if (d.toDateString() === now.toDateString()) key = 'Heute'
    else {
      const y = new Date(now); y.setDate(now.getDate() - 1)
      if (d.toDateString() === y.toDateString()) key = 'Gestern'
      else key = d.toLocaleDateString('de-DE', { day:'2-digit', month:'long', year:'numeric' })
    }
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(a)
  })

  const card: React.CSSProperties = {
    background: '#0d0f18',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 14,
    padding: 20,
  }

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#08090f', color:'#f1f0f8', fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      <DevSidebar active="dashboard" />

      <div style={{ flex:1, overflowY:'auto', maxHeight:'100vh', padding:'24px 28px' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24 }}>
          <button onClick={() => nav('/dev-dashboard')} style={{ padding:'7px 12px', borderRadius:8, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', color:'#8b8aa8', cursor:'pointer', fontSize:12 }}>
            ← Zurück
          </button>
          <div>
            <h1 style={{ fontSize:22, fontWeight:900, letterSpacing:'-.02em' }}>Alle Aktivitäten</h1>
            <p style={{ color:'#8b8aa8', fontSize:12, marginTop:2 }}>{activities.length} Einträge</p>
          </div>
          <button onClick={load} style={{ marginLeft:'auto', padding:'7px 14px', borderRadius:8, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', color:'#f1f0f8', cursor:'pointer', fontSize:12 }}>
            🔄 Aktualisieren
          </button>
        </div>

        {/* Filter Pills */}
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:20 }}>
          {types.map(t => (
            <button key={t} onClick={() => setFilter(t)} style={{
              padding:'5px 14px', borderRadius:99, border:'none', cursor:'pointer', fontSize:11, fontWeight:600, transition:'all .15s',
              background: filter===t ? 'rgba(232,184,109,0.15)' : 'rgba(255,255,255,0.05)',
              color:      filter===t ? '#e8b86d' : 'rgba(255,255,255,0.5)',
            }}>
              {t === 'all' ? 'Alle' : (actIcons[t] || '') + ' ' + t.replace('_', ' ')}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign:'center', padding:'60px 20px', color:'#8b8aa8' }}>
            <div style={{ width:28, height:28, border:'2px solid #b46a0e', borderTopColor:'transparent', borderRadius:'50%', animation:'spin .8s linear infinite', margin:'0 auto 12px' }} />
            Lade Aktivitäten...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ ...card, textAlign:'center', padding:'60px 20px', color:'#8b8aa8' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>📋</div>
            <div style={{ fontSize:14, fontWeight:600 }}>Keine Aktivitäten</div>
            <div style={{ fontSize:12, marginTop:4 }}>Noch keine Ereignisse vorhanden</div>
          </div>
        ) : (
          Object.entries(grouped).map(([date, items]) => (
            <div key={date} style={{ marginBottom:24 }}>
              {/* Datum-Trenner */}
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                <div style={{ height:1, flex:1, background:'rgba(255,255,255,0.06)' }} />
                <span style={{ fontSize:11, fontWeight:600, color:'rgba(255,255,255,0.3)', padding:'2px 10px', background:'rgba(255,255,255,0.04)', borderRadius:99, border:'1px solid rgba(255,255,255,0.06)' }}>{date}</span>
                <div style={{ height:1, flex:1, background:'rgba(255,255,255,0.06)' }} />
              </div>

              {/* Aktivitäten dieses Tages */}
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {items.map((a, i) => (
                  <div key={i} style={{ display:'flex', gap:14, padding:'14px 16px', background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.05)', borderRadius:12, transition:'background .15s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.04)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.02)'}>
                    {/* Icon */}
                    <div style={{ width:40, height:40, borderRadius:11, background: actColors[a.type] || 'rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>
                      {actIcons[a.type] || '📋'}
                    </div>
                    {/* Content */}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:3, flexWrap:'wrap' }}>
                        <span style={{ fontSize:13, fontWeight:700, color:'#f1f0f8' }}>{a.title}</span>
                        <span style={{ fontSize:10, padding:'1px 7px', borderRadius:99, background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.4)', flexShrink:0 }}>
                          {a.type.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div style={{ fontSize:12, color:'rgba(255,255,255,0.45)', lineHeight:1.5 }}>{a.description}</div>
                      {a.meta && Object.keys(a.meta).length > 0 && (
                        <div style={{ display:'flex', gap:8, marginTop:6, flexWrap:'wrap' }}>
                          {Object.entries(a.meta).map(([k, v]) => (
                            <span key={k} style={{ fontSize:10, padding:'2px 8px', borderRadius:6, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.4)' }}>
                              {k}: {v}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* Zeit */}
                    <div style={{ flexShrink:0, textAlign:'right' }}>
                      <div style={{ fontSize:11, color:'rgba(255,255,255,0.35)', fontWeight:600 }}>{ago(a.createdAt)}</div>
                      <div style={{ fontSize:10, color:'rgba(255,255,255,0.2)', marginTop:2 }}>{fullDate(a.createdAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

export default DevActivity
