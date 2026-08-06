import { useState, useEffect, useRef } from 'react'
import api from '../../services/api'

interface Claim {
  _id: string; requestedUin: string; proofType: string
  status: string; createdAt: string; adminNote?: string
}

export default function LegacyClaimForm() {
  const [uin,        setUin]        = useState('')
  const [proofType,  setProofType]  = useState<'email'|'screenshot'|'firstcome'>('email')
  const [proofEmail, setProofEmail] = useState('')
  const [file,       setFile]       = useState<File|null>(null)
  const [loading,    setLoading]    = useState(false)
  const [result,     setResult]     = useState<{ok:boolean;message:string}|null>(null)
  const [myClaims,   setMyClaims]   = useState<Claim[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api.get('/api/claims/mine').then(r => setMyClaims(r.data || [])).catch(() => {})
  }, [result])

  const submit = async () => {
    if (!uin.trim()) return
    setLoading(true); setResult(null)
    try {
      if (proofType === 'screenshot') {
        if (!file) { setResult({ ok:false, message:'Bitte Screenshot hochladen' }); setLoading(false); return }
        const form = new FormData()
        form.append('uin', uin.trim())
        form.append('screenshot', file)
        const { data } = await api.post('/api/claims/screenshot', form, { headers: { 'Content-Type':'multipart/form-data' } })
        setResult({ ok:true, message: data.message })
      } else {
        const { data } = await api.post('/api/claims', { uin: uin.trim(), proofType, proofEmail: proofType==='email' ? proofEmail : undefined })
        setResult({ ok:true, message: data.message })
      }
      setUin(''); setProofEmail(''); setFile(null)
    } catch (err: any) {
      setResult({ ok:false, message: err?.response?.data?.error || 'Fehler' })
    }
    setLoading(false)
  }

  const deleteClaim = async (id: string) => {
    if (!confirm('Claim wirklich zurückziehen?')) return
    try { await api.delete(`/api/claims/${id}`); setMyClaims(c => c.filter(x => x._id !== id)) }
    catch (_e) { alert('Fehler') }
  }

  const statusColor: Record<string,string> = {
    pending:'#fbbf24', email_sent:'#60a5fa', approved:'#4ade80', rejected:'#f87171', expired:'rgba(255,255,255,0.3)'
  }
  const statusLabel: Record<string,string> = {
    pending:'⏳ Warte auf Admin', email_sent:'📧 E-Mail gesendet', approved:'✓ Verifiziert', rejected:'❌ Abgelehnt', expired:'⌛ Abgelaufen'
  }

  const S = {
    card:   { background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:12, padding:'14px 16px', marginBottom:10 } as React.CSSProperties,
    input:  { width:'100%', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:10, padding:'10px 13px', fontSize:13, color:'white', outline:'none', boxSizing:'border-box' as const },
    label:  { fontSize:11, color:'rgba(255,255,255,0.4)', textTransform:'uppercase' as const, letterSpacing:'0.07em', fontWeight:700, marginBottom:6, display:'block' },
    tabBtn: (active: boolean): React.CSSProperties => ({
      flex:1, padding:'9px', fontSize:12, fontWeight: active?600:400, cursor:'pointer',
      background: active ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.03)',
      border: active ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(255,255,255,0.07)',
      borderRadius:9, color: active ? '#f59e0b' : 'rgba(255,255,255,0.5)',
    }),
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {/* Erklärung */}
      <div style={{ background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.15)', borderRadius:12, padding:'14px 16px' }}>
        <p style={{ fontSize:13, fontWeight:600, color:'#f59e0b', marginBottom:6 }}>📡 ICQ Legacy UIN beanspruchen</p>
        <p style={{ fontSize:12, color:'rgba(255,255,255,0.45)', lineHeight:1.65, margin:0 }}>
          Warst du früher bei ICQ? Beanspruche deine alte UIN-Nummer für dein Nokki-Profil.
          Sie wird dann als verifizierte Legacy-Nummer angezeigt.<br/>
          <strong style={{ color:'rgba(255,255,255,0.6)' }}>Wichtig:</strong> Gib niemals dein altes ICQ-Passwort ein!
        </p>
      </div>

      {/* UIN Eingabe */}
      <div>
        <label style={S.label}>Deine alte ICQ-Nummer (UIN)</label>
        <input value={uin} onChange={e => setUin(e.target.value.replace(/\D/g,'').slice(0,10))}
          style={{ ...S.input, fontFamily:'monospace', fontSize:18, letterSpacing:2 }}
          placeholder="z.B. 12345678" maxLength={10} />
        <p style={{ fontSize:11, color:'rgba(255,255,255,0.25)', marginTop:4 }}>5–10 Ziffern</p>
      </div>

      {/* Methode wählen */}
      <div>
        <label style={S.label}>Nachweismethode</label>
        <div style={{ display:'flex', gap:6 }}>
          <button style={S.tabBtn(proofType==='email')} onClick={() => setProofType('email')}>📧 E-Mail</button>
          <button style={S.tabBtn(proofType==='screenshot')} onClick={() => setProofType('screenshot')}>📸 Screenshot</button>
          <button style={S.tabBtn(proofType==='firstcome')} onClick={() => setProofType('firstcome')}>🥇 First-Come</button>
        </div>
      </div>

      {/* Methoden-spezifische Felder */}
      {proofType === 'email' && (
        <div style={S.card}>
          <p style={{ fontSize:12, color:'rgba(255,255,255,0.5)', marginBottom:10, lineHeight:1.6 }}>
            Gib die E-Mail-Adresse ein, die damals mit deinem ICQ-Konto verknüpft war.
            Wir schicken dir einen Bestätigungslink.
          </p>
          <label style={S.label}>Alte ICQ-E-Mail-Adresse</label>
          <input type="email" value={proofEmail} onChange={e => setProofEmail(e.target.value)}
            style={S.input} placeholder="deine-alte@email.de" />
        </div>
      )}

      {proofType === 'screenshot' && (
        <div style={S.card}>
          <p style={{ fontSize:12, color:'rgba(255,255,255,0.5)', marginBottom:10, lineHeight:1.6 }}>
            Lade einen Screenshot deines alten ICQ-Clients hoch auf dem deine UIN sichtbar ist.
            Ein Admin prüft deinen Claim innerhalb von 48 Stunden.
          </p>
          <button onClick={() => fileRef.current?.click()}
            style={{ padding:'10px 16px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, color:'rgba(255,255,255,0.7)', cursor:'pointer', fontSize:13 }}>
            {file ? `📄 ${file.name}` : '📸 Screenshot auswählen'}
          </button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }} onChange={e => setFile(e.target.files?.[0] || null)} />
          {file && <p style={{ fontSize:11, color:'rgba(255,255,255,0.3)', marginTop:6 }}>Max. 10 MB</p>}
        </div>
      )}

      {proofType === 'firstcome' && (
        <div style={S.card}>
          <p style={{ fontSize:12, color:'rgba(255,255,255,0.5)', lineHeight:1.6 }}>
            Du beanspruchst diese UIN ohne Nachweis (First-Come-First-Served).
            Sie wird dir vorläufig zugewiesen – kann aber von jemandem mit echtem Nachweis übernommen werden.
          </p>
        </div>
      )}

      {result && (
        <div style={{ background: result.ok ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)', border: `1px solid ${result.ok ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}`, borderRadius:10, padding:'10px 14px', fontSize:13, color: result.ok ? '#4ade80' : '#f87171' }}>
          {result.message}
        </div>
      )}

      <button onClick={submit} disabled={loading || !uin.trim()}
        style={{ padding:'11px', background: loading ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg,#b45309,#f59e0b)', border:'none', borderRadius:11, color:'white', fontWeight:700, fontSize:13, cursor: loading || !uin.trim() ? 'not-allowed' : 'pointer', opacity: loading || !uin.trim() ? 0.5 : 1 }}>
        {loading ? 'Wird eingereicht…' : '📤 Claim einreichen'}
      </button>

      {/* Meine Claims */}
      {myClaims.length > 0 && (
        <div>
          <p style={{ fontSize:11, color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:'0.08em', fontWeight:700, marginBottom:10 }}>Meine Claims</p>
          {myClaims.map(c => (
            <div key={c._id} style={{ ...S.card, display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ flex:1 }}>
                <p style={{ fontSize:14, fontWeight:700, fontFamily:'monospace', color:'#f59e0b' }}>#{c.requestedUin}</p>
                <p style={{ fontSize:11, color: statusColor[c.status] || 'rgba(255,255,255,0.4)', marginTop:2 }}>
                  {statusLabel[c.status] || c.status}
                </p>
                {c.adminNote && <p style={{ fontSize:11, color:'rgba(255,255,255,0.35)', marginTop:2, fontStyle:'italic' }}>{c.adminNote}</p>}
              </div>
              <span style={{ fontSize:10, color:'rgba(255,255,255,0.2)' }}>{c.proofType}</span>
              {c.status !== 'approved' && (
                <button onClick={() => deleteClaim(c._id)}
                  style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:8, color:'#f87171', cursor:'pointer', padding:'4px 8px', fontSize:11 }}>
                  Zurückziehen
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
