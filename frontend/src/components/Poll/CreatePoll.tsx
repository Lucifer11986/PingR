import { useState } from 'react'
import api from '../../services/api'

interface Props {
  conversationId: string
  onClose: () => void
  onCreated: (poll: any) => void
}

export default function CreatePoll({ conversationId, onClose, onCreated }: Props) {
  const [question, setQuestion] = useState('')
  const [options,  setOptions]  = useState(['', ''])
  const [multi,    setMulti]    = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  const addOption = () => { if (options.length < 10) setOptions([...options, '']) }
  const removeOption = (i: number) => { if (options.length > 2) setOptions(options.filter((_, idx) => idx !== i)) }
  const updateOption = (i: number, v: string) => setOptions(options.map((o, idx) => idx === i ? v : o))

  const submit = async () => {
    setError('')
    const validOptions = options.filter(o => o.trim())
    if (!question.trim()) { setError('Bitte Frage eingeben'); return }
    if (validOptions.length < 2) { setError('Mindestens 2 Optionen'); return }
    setLoading(true)
    try {
      const { data } = await api.post('/api/polls', {
        conversationId, question: question.trim(),
        options: validOptions, multipleChoice: multi,
      })
      onCreated(data)
      onClose()
    } catch (_err) {
      setError('Fehler beim Erstellen')
    } finally { setLoading(false) }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}
      onClick={onClose}>
      <div style={{ background:'#13131f', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'18px', padding:'24px', width:'100%', maxWidth:'420px' }}
        onClick={e => e.stopPropagation()}>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
          <h3 style={{ fontWeight:700, fontSize:'16px', margin:0 }}>📊 Umfrage erstellen</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer', fontSize:'20px' }}>✕</button>
        </div>

        <div style={{ marginBottom:'14px' }}>
          <label style={{ display:'block', fontSize:'12px', color:'rgba(255,255,255,0.6)', marginBottom:'6px' }}>Frage</label>
          <input value={question} onChange={e => setQuestion(e.target.value)} maxLength={300}
            placeholder="Was ist deine Frage?" autoFocus
            style={{ width:'100%', padding:'10px 12px', borderRadius:'10px', border:'1px solid rgba(255,255,255,0.15)', background:'rgba(255,255,255,0.07)', color:'white', fontSize:'13px', outline:'none', boxSizing:'border-box' }} />
        </div>

        <div style={{ marginBottom:'12px' }}>
          <label style={{ display:'block', fontSize:'12px', color:'rgba(255,255,255,0.6)', marginBottom:'6px' }}>
            Optionen ({options.length}/10)
          </label>
          <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
            {options.map((opt, i) => (
              <div key={i} style={{ display:'flex', gap:'6px', alignItems:'center' }}>
                <input value={opt} onChange={e => updateOption(i, e.target.value)} maxLength={100}
                  placeholder={`Option ${i + 1}`}
                  style={{ flex:1, padding:'8px 10px', borderRadius:'8px', border:'1px solid rgba(255,255,255,0.12)', background:'rgba(255,255,255,0.06)', color:'white', fontSize:'12px', outline:'none' }} />
                {options.length > 2 && (
                  <button onClick={() => removeOption(i)} style={{ background:'rgba(220,38,38,0.15)', border:'1px solid rgba(220,38,38,0.3)', borderRadius:'6px', color:'#f87171', cursor:'pointer', width:'28px', height:'28px', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>✕</button>
                )}
              </div>
            ))}
          </div>
          {options.length < 10 && (
            <button onClick={addOption} style={{ marginTop:'6px', background:'rgba(255,255,255,0.05)', border:'1px dashed rgba(255,255,255,0.2)', borderRadius:'8px', color:'rgba(255,255,255,0.5)', cursor:'pointer', padding:'6px', width:'100%', fontSize:'12px' }}>
              + Option hinzufügen
            </button>
          )}
        </div>

        <label style={{ display:'flex', alignItems:'center', gap:'8px', cursor:'pointer', marginBottom:'16px', fontSize:'13px', color:'rgba(255,255,255,0.7)' }}>
          <input type="checkbox" checked={multi} onChange={e => setMulti(e.target.checked)} style={{ accentColor:'#2563eb' }} />
          Mehrfachauswahl erlauben
        </label>

        {error && <p style={{ color:'#f87171', fontSize:'12px', marginBottom:'10px' }}>{error}</p>}

        <div style={{ display:'flex', gap:'8px' }}>
          <button onClick={submit} disabled={loading}
            style={{ flex:1, background:'#2563eb', border:'none', borderRadius:'10px', color:'white', padding:'10px', fontWeight:700, cursor:'pointer', fontSize:'13px', opacity:loading?0.6:1 }}>
            {loading ? 'Erstelle…' : '📊 Erstellen'}
          </button>
          <button onClick={onClose} style={{ padding:'10px 16px', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'10px', color:'rgba(255,255,255,0.7)', cursor:'pointer', fontSize:'13px' }}>
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  )
}