import { useState, useEffect, useCallback } from 'react'
import { useChatStore } from '../../store/chatStore'

interface ToastData {
  id: string; senderName: string; body: string
  conversationId: string; avatar?: string
}

const apiBase = import.meta.env.VITE_API_URL || ''

export default function MessageToast() {
  const [toasts, setToasts]   = useState<ToastData[]>([])
  const setActiveConversation = useChatStore(s => s.setActiveConversation)

  const remove = useCallback((id: string) => {
    setToasts(t => t.filter(x => x.id !== id))
  }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      const d   = (e as CustomEvent).detail
      const id  = `${Date.now()}`
      setToasts(p => [...p.slice(-2), { id, ...d }])
      setTimeout(() => remove(id), 5000)
    }
    window.addEventListener('new_message_toast', handler)
    return () => window.removeEventListener('new_message_toast', handler)
  }, [remove])

  if (!toasts.length) return null

  return (
    <div style={{ position:'fixed', bottom:'20px', right:'20px', zIndex:9999, display:'flex', flexDirection:'column', gap:'8px', pointerEvents:'none' }}>
      {toasts.map(t => (
        <div key={t.id}
          onClick={() => { setActiveConversation(t.conversationId); remove(t.id) }}
          style={{
            background:'rgba(12,18,30,0.97)', border:'1px solid rgba(255,255,255,0.1)',
            borderLeft:'3px solid #3b82f6', borderRadius:'14px', padding:'12px 14px',
            display:'flex', alignItems:'center', gap:'11px', cursor:'pointer',
            pointerEvents:'all', width:'300px',
            boxShadow:'0 8px 32px rgba(0,0,0,0.6)',
            animation:'slideIn .25s ease',
          }}>
          <div style={{
            width:'38px', height:'38px', borderRadius:'50%', flexShrink:0,
            background:'linear-gradient(135deg,#1e40af,#0e7490)',
            overflow:'hidden', display:'flex', alignItems:'center',
            justifyContent:'center', fontSize:'15px', fontWeight:800, color:'white',
          }}>
            {t.avatar
              ? <img src={`${apiBase}${t.avatar}`} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" />
              : t.senderName[0]?.toUpperCase()
            }
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:'13px', fontWeight:700, color:'white', marginBottom:'2px' }}>{t.senderName}</div>
            <div style={{ fontSize:'12px', color:'rgba(255,255,255,0.5)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.body}</div>
          </div>
          <button onClick={e => { e.stopPropagation(); remove(t.id) }}
            style={{ background:'none', border:'none', color:'rgba(255,255,255,0.3)', cursor:'pointer', fontSize:'14px', padding:0 }}>
            ✕
          </button>
        </div>
      ))}
      <style>{`@keyframes slideIn{from{transform:translateX(110%);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
    </div>
  )
}