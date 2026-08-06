import { useState, useEffect } from 'react'
import api from '../../services/api'

const DAYS = [
  { num:1, short:'Mo', long:'Montag'     },
  { num:2, short:'Di', long:'Dienstag'   },
  { num:3, short:'Mi', long:'Mittwoch'   },
  { num:4, short:'Do', long:'Donnerstag' },
  { num:5, short:'Fr', long:'Freitag'    },
  { num:6, short:'Sa', long:'Samstag'    },
  { num:0, short:'So', long:'Sonntag'    },
]

const TIMEZONES = [
  { value:'Europe/Berlin',     label:'🇩🇪 Berlin (MEZ/MESZ)'         },
  { value:'Europe/London',     label:'🇬🇧 London (GMT/BST)'          },
  { value:'Europe/Paris',      label:'🇫🇷 Paris (MEZ/MESZ)'          },
  { value:'Europe/Vienna',     label:'🇦🇹 Wien (MEZ/MESZ)'           },
  { value:'Europe/Zurich',     label:'🇨🇭 Zürich (MEZ/MESZ)'         },
  { value:'Europe/Moscow',     label:'🇷🇺 Moskau (MSK)'              },
  { value:'America/New_York',  label:'🇺🇸 New York (ET)'             },
  { value:'America/Chicago',   label:'🇺🇸 Chicago (CT)'              },
  { value:'America/Los_Angeles',label:'🇺🇸 Los Angeles (PT)'         },
  { value:'America/Sao_Paulo', label:'🇧🇷 São Paulo (BRT)'           },
  { value:'Asia/Tokyo',        label:'🇯🇵 Tokio (JST)'               },
  { value:'Asia/Shanghai',     label:'🇨🇳 Shanghai (CST)'            },
  { value:'Asia/Dubai',        label:'🇦🇪 Dubai (GST)'               },
  { value:'Asia/Kolkata',      label:'🇮🇳 Kolkata (IST)'             },
  { value:'Australia/Sydney',  label:'🇦🇺 Sydney (AEST)'             },
  { value:'Pacific/Auckland',  label:'🇳🇿 Auckland (NZST)'           },
  { value:'Africa/Cairo',      label:'🇪🇬 Kairo (EET)'               },
  { value:'UTC',               label:'🌍 UTC'                         },
]

export default function AvailabilitySettings() {
  const [enabled,   setEnabled]   = useState(false)
  const [days,      setDays]      = useState<number[]>([1,2,3,4,5])
  const [startTime, setStartTime] = useState('09:00')
  const [endTime,   setEndTime]   = useState('22:00')
  const [message,   setMessage]   = useState('')
  const [timezone,  setTimezone]  = useState('Europe/Berlin')
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)
  const [loading,   setLoading]   = useState(true)

  // Lokale Zeit in gewählter Zeitzone berechnen
  const localTime = (() => {
    try {
      return new Intl.DateTimeFormat('de-DE', {
        timeZone: timezone, hour:'2-digit', minute:'2-digit', weekday:'long'
      }).format(new Date())
    } catch { return '–' }
  })()

  useEffect(() => {
    api.get('/api/users/availability').then(r => {
      const a = r.data.availability
      setTimezone(r.data.timezone || 'Europe/Berlin')
      if (a) {
        setEnabled(a.enabled ?? false)
        setDays(a.days ?? [1,2,3,4,5])
        setStartTime(a.startTime ?? '09:00')
        setEndTime(a.endTime ?? '22:00')
        setMessage(a.message ?? '')
      }
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const toggleDay = (d: number) => {
    setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort())
  }

  const save = async () => {
    setSaving(true)
    try {
      await api.patch('/api/users/availability', {
        timezone,
        availability: { enabled, days, startTime, endTime, message },
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (_e) { alert('Fehler beim Speichern') }
    finally { setSaving(false) }
  }

  const S = {
    card:  { background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:12, padding:'14px 16px', marginBottom:12 } as React.CSSProperties,
    label: { fontSize:11, color:'rgba(255,255,255,0.4)', textTransform:'uppercase' as const, letterSpacing:'0.07em', fontWeight:700, marginBottom:8, display:'block' },
    input: { width:'100%', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:10, padding:'9px 13px', fontSize:13, color:'white', outline:'none', boxSizing:'border-box' as const },
    select:{ width:'100%', background:'#08090f', border:'1px solid rgba(255,255,255,0.08)', borderRadius:10, padding:'9px 13px', fontSize:13, color:'white', outline:'none', colorScheme:'dark' as const },
  }

  if (loading) return <div style={{ color:'rgba(255,255,255,0.3)', fontSize:13 }}>Lade…</div>

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {/* Zeitzone */}
      <div>
        <label style={S.label}>🌍 Deine Zeitzone</label>
        <select value={timezone} onChange={e => setTimezone(e.target.value)} style={S.select}>
          {TIMEZONES.map(tz => (
            <option key={tz.value} value={tz.value}>{tz.label}</option>
          ))}
        </select>
        <p style={{ fontSize:11, color:'rgba(255,255,255,0.3)', marginTop:6 }}>
          Deine aktuelle lokale Zeit: <strong style={{ color:'#e8b86d' }}>{localTime}</strong>
        </p>
        <p style={{ fontSize:11, color:'rgba(255,255,255,0.25)', marginTop:2 }}>
          Diese Zeitzone wird anderen Nutzern angezeigt damit sie wissen wann du erreichbar bist.
        </p>
      </div>

      {/* Verfügbarkeit an/aus */}
      <div style={S.card}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <p style={{ fontSize:13, fontWeight:600, color:'rgba(255,255,255,0.85)' }}>Verfügbarkeitsfenster</p>
            <p style={{ fontSize:11, color:'rgba(255,255,255,0.35)', marginTop:2 }}>
              Andere sehen wann du erreichbar bist
            </p>
          </div>
          <button onClick={() => setEnabled(!enabled)} style={{
            width:44, height:24, borderRadius:12, border:'none', cursor:'pointer',
            background: enabled ? 'linear-gradient(135deg,#b46a0e,#e8b86d)' : 'rgba(255,255,255,0.12)',
            position:'relative', transition:'all .2s', flexShrink:0,
          }}>
            <div style={{ position:'absolute', top:3, left: enabled ? 22 : 2, width:18, height:18, borderRadius:'50%', background:'white', transition:'left .2s' }} />
          </button>
        </div>
      </div>

      {/* Wenn aktiviert: Einstellungen */}
      {enabled && (
        <>
          {/* Wochentage */}
          <div>
            <label style={S.label}>📅 Verfügbare Tage</label>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {DAYS.map(d => (
                <button key={d.num} onClick={() => toggleDay(d.num)} style={{
                  width:42, height:42, borderRadius:11, fontSize:12, fontWeight:600, cursor:'pointer',
                  border: days.includes(d.num) ? '1px solid rgba(232,184,109,0.5)' : '1px solid rgba(255,255,255,0.08)',
                  background: days.includes(d.num) ? 'rgba(232,184,109,0.15)' : 'rgba(255,255,255,0.04)',
                  color: days.includes(d.num) ? '#e8b86d' : 'rgba(255,255,255,0.5)',
                }}>
                  {d.short}
                </button>
              ))}
            </div>
          </div>

          {/* Zeitfenster */}
          <div>
            <label style={S.label}>🕐 Erreichbare Zeiten</label>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ flex:1 }}>
                <p style={{ fontSize:11, color:'rgba(255,255,255,0.35)', marginBottom:4 }}>Von</p>
                <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                  style={{ ...S.input, colorScheme:'dark' }} />
              </div>
              <div style={{ fontSize:16, color:'rgba(255,255,255,0.3)', marginTop:16 }}>→</div>
              <div style={{ flex:1 }}>
                <p style={{ fontSize:11, color:'rgba(255,255,255,0.35)', marginBottom:4 }}>Bis</p>
                <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                  style={{ ...S.input, colorScheme:'dark' }} />
              </div>
            </div>
          </div>

          {/* Abwesenheitsnachricht */}
          <div>
            <label style={S.label}>💬 Abwesenheitsnachricht <span style={{ fontWeight:400, textTransform:'none' }}>(optional)</span></label>
            <input type="text" value={message} onChange={e => setMessage(e.target.value.slice(0, 80))}
              style={S.input} placeholder="z.B. Bin gerade nicht erreichbar, antworte später…" maxLength={80} />
            <p style={{ fontSize:10, color:'rgba(255,255,255,0.2)', marginTop:4 }}>{message.length}/80</p>
          </div>

          {/* Vorschau */}
          <div style={{ background:'rgba(232,184,109,0.06)', border:'1px solid rgba(232,184,109,0.15)', borderRadius:12, padding:'12px 14px' }}>
            <p style={{ fontSize:11, color:'rgba(255,255,255,0.3)', marginBottom:6 }}>👁 Vorschau für andere Nutzer:</p>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:13 }}>🕐</span>
              <p style={{ fontSize:12, color:'rgba(255,255,255,0.7)' }}>
                Erreichbar: <strong style={{ color:'#e8b86d' }}>
                  {DAYS.filter(d => days.includes(d.num)).map(d => d.short).join(', ')}
                </strong>{' '}von{' '}
                <strong style={{ color:'#e8b86d' }}>{startTime}</strong> bis{' '}
                <strong style={{ color:'#e8b86d' }}>{endTime}</strong>{' '}
                <span style={{ color:'rgba(255,255,255,0.4)' }}>({timezone.split('/')[1]?.replace('_',' ')})</span>
              </p>
            </div>
          </div>
        </>
      )}

      <button onClick={save} disabled={saving} style={{
        width:'100%', padding:11, border:'none', borderRadius:11, cursor:'pointer',
        background: saved ? 'rgba(34,197,94,0.15)' : 'linear-gradient(135deg,#b46a0e,#e8b86d)',
        color: saved ? '#4ade80' : 'white', fontWeight:700, fontSize:13,
        opacity: saving ? 0.6 : 1,
      }}>
        {saving ? 'Speichere…' : saved ? '✓ Gespeichert' : 'Einstellungen speichern'}
      </button>
    </div>
  )
}