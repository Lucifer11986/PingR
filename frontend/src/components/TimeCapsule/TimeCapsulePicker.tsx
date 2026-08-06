import { useState } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  value: string
  onChange: (val: string) => void
  onClose: () => void
}

export default function TimeCapsulePicker({ value, onChange, onClose }: Props) {
  const [selected, setSelected] = useState(value)

  const presets = [
    { label:'In 1 Stunde',   hours:1    },
    { label:'In 6 Stunden',  hours:6    },
    { label:'Morgen',        hours:24   },
    { label:'In 3 Tagen',    hours:72   },
    { label:'In 1 Woche',    hours:168  },
    { label:'In 1 Monat',    hours:720  },
    { label:'In 6 Monaten',  hours:4380 },
    { label:'In 1 Jahr',     hours:8760 },
  ]

  const applyPreset = (hours: number) => {
    const d = new Date(Date.now() + hours * 3600 * 1000)
    setSelected(d.toISOString().slice(0, 16))
  }

  const minDate = new Date(Date.now() + 60000).toISOString().slice(0, 16)

  const modal = (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', backdropFilter:'blur(8px)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
      onClick={onClose}>
      <div style={{ background:'#0d0f18', border:'1px solid rgba(255,255,255,0.08)', borderRadius:20, width:'100%', maxWidth:380, boxShadow:'0 24px 60px rgba(0,0,0,0.7)' }}
        onClick={e => e.stopPropagation()}>

        <div style={{ padding:'16px 18px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:34, height:34, borderRadius:10, background:'linear-gradient(135deg,#b46a0e,#e8b86d)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>⏳</div>
          <div>
            <p style={{ fontWeight:700, fontSize:14, color:'rgba(255,255,255,0.92)' }}>Zeitkapsel-Nachricht</p>
            <p style={{ fontSize:11, color:'rgba(255,255,255,0.35)', marginTop:2 }}>Wann soll die Nachricht ankommen?</p>
          </div>
          <button onClick={onClose} style={{ marginLeft:'auto', background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer', fontSize:18 }}>✕</button>
        </div>

        <div style={{ padding:18, display:'flex', flexDirection:'column', gap:14 }}>
          <div>
            <p style={{ fontSize:10, color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:'0.08em', fontWeight:700, marginBottom:8 }}>Schnellauswahl</p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
              {presets.map(p => (
                <button key={p.label} onClick={() => applyPreset(p.hours)}
                  style={{ padding:'8px 12px', borderRadius:10, fontSize:12, border:'1px solid rgba(255,255,255,0.08)', cursor:'pointer', textAlign:'left', background:'rgba(255,255,255,0.04)', color:'rgba(255,255,255,0.7)' }}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p style={{ fontSize:10, color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:'0.08em', fontWeight:700, marginBottom:8 }}>Genauen Zeitpunkt wählen</p>
            <input type="datetime-local" value={selected} min={minDate}
              onChange={e => setSelected(e.target.value)}
              style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:10, padding:'10px 13px', fontSize:13, color:'white', outline:'none', colorScheme:'dark', boxSizing:'border-box' }} />
          </div>

          {selected && (
            <div style={{ background:'rgba(232,184,109,0.08)', border:'1px solid rgba(232,184,109,0.18)', borderRadius:10, padding:'10px 14px', display:'flex', alignItems:'center', gap:8 }}>
              <span>⏳</span>
              <p style={{ fontSize:12, color:'#e8b86d', lineHeight:1.4 }}>
                Zustellung: <strong>{new Date(selected).toLocaleString('de-DE', { weekday:'short', day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' })}</strong>
              </p>
            </div>
          )}

          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => { onChange(''); onClose() }}
              style={{ flex:1, padding:'10px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, color:'rgba(255,255,255,0.6)', fontSize:13, cursor:'pointer' }}>
              Abbrechen
            </button>
            <button onClick={() => { if (selected) { onChange(selected); onClose() } }} disabled={!selected}
              style={{ flex:1, padding:'10px', background: selected ? 'linear-gradient(135deg,#b46a0e,#e8b86d)' : 'rgba(255,255,255,0.06)', border:'none', borderRadius:10, color: selected ? '#fff' : 'rgba(255,255,255,0.3)', fontSize:13, fontWeight:700, cursor: selected ? 'pointer' : 'not-allowed' }}>
              ⏳ Zeitkapsel erstellen
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}