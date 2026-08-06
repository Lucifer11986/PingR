import React, { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

export default function DevResetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError('')
    if (password.length < 10) return setError('Das Passwort muss mindestens 10 Zeichen haben.')
    if (password !== confirm) return setError('Die Passwörter stimmen nicht überein.')
    try {
      const response = await fetch('/api/dev/auth/reset-password', { method:'POST', credentials:'include', headers:{'Content-Type':'application/json'}, body:JSON.stringify({token,password}) })
      const data = await response.json()
      if (!response.ok) return setError(data.error || 'Reset fehlgeschlagen')
      setMessage(data.message)
    } catch { setError('Verbindung fehlgeschlagen.') }
  }
  const input: React.CSSProperties = { width:'100%',boxSizing:'border-box',marginTop:12,padding:13,borderRadius:10,color:'white',background:'#13141f',border:'1px solid rgba(255,255,255,.1)' }
  return <div style={{minHeight:'100dvh',display:'grid',placeItems:'center',padding:20,background:'#08090f',color:'#f1f0f8'}}><form onSubmit={submit} style={{width:'100%',maxWidth:440,padding:32,borderRadius:20,background:'#0d0f18',border:'1px solid rgba(255,255,255,.08)'}}>
    <div style={{fontSize:13,color:'#e8b86d',fontWeight:700}}>Nokki Developer</div><h1 style={{fontSize:26}}>Neues Passwort</h1>
    {!token && <div style={{color:'#fca5a5'}}>Der Reset-Link ist unvollständig.</div>}
    {error && <div style={{color:'#fca5a5',marginBottom:12}}>{error}</div>}
    {message ? <><div style={{color:'#86efac'}}>{message}</div><p><Link to="/dev-login" style={{color:'#e8b86d'}}>Jetzt anmelden</Link></p></> : <>
      <input style={input} type="password" minLength={10} maxLength={200} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mindestens 10 Zeichen" required />
      <input style={input} type="password" minLength={10} maxLength={200} value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Passwort wiederholen" required />
      <button disabled={!token} style={{width:'100%',marginTop:16,padding:13,border:0,borderRadius:10,background:'linear-gradient(135deg,#b46a0e,#e8b86d)',color:'white',fontWeight:700}}>Passwort speichern</button>
    </>}
  </form></div>
}
