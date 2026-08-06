import React, { useState } from 'react'
import { Link } from 'react-router-dom'

const shell: React.CSSProperties = { minHeight:'100dvh', display:'grid', placeItems:'center', padding:20, background:'#08090f', color:'#f1f0f8' }
const card: React.CSSProperties = { width:'100%', maxWidth:440, padding:32, borderRadius:20, background:'#0d0f18', border:'1px solid rgba(255,255,255,.08)' }
const input: React.CSSProperties = { width:'100%', boxSizing:'border-box', margin:'16px 0', padding:'13px 15px', borderRadius:10, color:'white', background:'#13141f', border:'1px solid rgba(255,255,255,.1)' }

export default function DevForgotPassword() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setLoading(true)
    try {
      const response = await fetch('/api/dev/auth/forgot-password', { method:'POST', credentials:'include', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email}) })
      const data = await response.json()
      setMessage(data.message || 'Falls die E-Mail registriert ist, wurde ein Reset-Link versendet.')
    } catch { setMessage('Verbindung fehlgeschlagen. Bitte versuche es später erneut.') }
    finally { setLoading(false) }
  }
  return <div style={shell}><form style={card} onSubmit={submit}>
    <div style={{fontSize:13,color:'#e8b86d',fontWeight:700}}>Nokki Developer</div>
    <h1 style={{fontSize:26,margin:'10px 0'}}>Passwort vergessen?</h1>
    <p style={{color:'#8b8aa8',fontSize:14,lineHeight:1.6}}>Wir senden dir einen einmalig nutzbaren Link, der 30 Minuten gültig ist.</p>
    {message ? <div style={{padding:12,borderRadius:10,background:'rgba(34,197,94,.1)',color:'#86efac'}}>{message}</div> : <>
      <input style={input} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="dev@example.com" required autoFocus />
      <button disabled={loading} style={{width:'100%',padding:13,border:0,borderRadius:10,background:'linear-gradient(135deg,#b46a0e,#e8b86d)',color:'white',fontWeight:700,cursor:'pointer'}}>{loading?'Wird gesendet…':'Reset-Link senden'}</button>
    </>}
    <p style={{textAlign:'center',marginTop:22}}><Link to="/dev-login" style={{color:'#e8b86d'}}>Zurück zum Login</Link></p>
  </form></div>
}
