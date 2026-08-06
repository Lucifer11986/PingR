import { useEffect, useState, useCallback, useRef } from 'react'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'
import { useContactStore } from '../store/contactStore'
import { useSound } from '../hooks/useSound'
import { useWebSocket } from '../hooks/useWebSocket'
import ContactList from '../components/ContactList/ContactList'
import ChatWindow from '../components/ChatWindow/ChatWindow'
import Settings from './Settings'
import SearchPanel from '../components/SearchPanel/SearchPanel'
import BookmarksPanel from '../components/Bookmarks/BookmarksPanel'
import api from '../services/api'
import VideoCall from '../components/VideoCall/VideoCall'
import ChannelView from '../components/ChannelView/ChannelView'
import UserProfile from '../components/UserProfile/UserProfile'
import GroupModal from '../components/GroupModal/GroupModal'
import CreateChannelModal from '../components/CreateChannel/CreateChannelModal'
import { getSocket } from '../services/socket'
import { useThemeStore, applyTheme } from '../store/themeStore'
import { useI18n } from '../hooks/useI18n'

/* ─── Types ──────────────────────────────────────────────────── */
type NavTab = 'home' | 'chats' | 'channels' | 'calls' | 'contacts' | 'notes' | 'settings'
type RightPanel = 'none' | 'discover' | 'create-channel' | 'edit-channel' | 'create-group'

/* ─── Mobile Hook ────────────────────────────────────────────── */
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return isMobile
}

/* ─── Toast ──────────────────────────────────────────────────── */
interface Toast { id: number; message: string; type: 'info' | 'ping' | 'broadcast' }

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss?: (id: number) => void }) {
  if (!toasts.length) return null
  return (
    <div style={{ position:'fixed', bottom:24, right:24, zIndex:9999, display:'flex', flexDirection:'column-reverse', gap:8, pointerEvents:'none' }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          minWidth:280, maxWidth:380, padding:'13px 16px', borderRadius:14,
          fontWeight:500, fontSize:13, display:'flex', alignItems:'center', gap:10,
          backdropFilter:'blur(24px)', pointerEvents:'all',
          boxShadow:'0 8px 32px rgba(0,0,0,0.4)', animation:'slideUpToast 0.25s ease-out',
          ...(t.type==='broadcast' ? { background:'rgba(29,78,216,0.92)', border:'1px solid rgba(96,165,250,0.35)', color:'white' }
            : t.type==='ping' ? { background:'rgba(180,106,14,0.92)', border:'1px solid rgba(232,184,109,0.35)', color:'white' }
            : { background:'rgba(13,15,24,0.95)', border:'1px solid rgba(255,255,255,0.1)', color:'white' }),
        }}>
          <span style={{ fontSize:18, flexShrink:0 }}>{t.type==='broadcast'?'📢':t.type==='ping'?'📣':'ℹ️'}</span>
          <span style={{ flex:1, lineHeight:1.4 }}>{t.message}</span>
          {onDismiss && <button onClick={() => onDismiss(t.id)} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer', fontSize:16 }}>×</button>}
        </div>
      ))}
    </div>
  )
}

/* ─── NavBtn (Icon Sidebar) ──────────────────────────────────── */
function NavBtn({ icon, active, onClick, badge, title, label }: {
  icon: React.ReactNode; active?: boolean; onClick?: () => void
  badge?: boolean; title?: string; label: string
}) {
  const [hover,       setHover]       = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)
  const tooltipTimer = useRef<ReturnType<typeof setTimeout>>()

  const onEnter = () => {
    setHover(true)
    tooltipTimer.current = setTimeout(() => setShowTooltip(true), 400)
  }
  const onLeave = () => {
    setHover(false)
    setShowTooltip(false)
    clearTimeout(tooltipTimer.current)
  }

  return (
    <div style={{ position:'relative' }} onMouseEnter={onEnter} onMouseLeave={onLeave}>
      {/* Aktiver Indikator — goldene Linie links */}
      {active && (
        <div style={{ position:'absolute', left:-8, top:'50%', transform:'translateY(-50%)', width:3, height:20, borderRadius:'0 3px 3px 0', background:'linear-gradient(180deg,#b46a0e,#e8b86d)' }} />
      )}
      <button title={title} onClick={onClick}
        style={{
          width:46, height:46, borderRadius:14, display:'flex', flexDirection:'column',
          alignItems:'center', justifyContent:'center', gap:2,
          transition:'all .15s', position:'relative',
          background: active ? 'rgba(232,184,109,0.12)' : hover ? 'rgba(255,255,255,0.06)' : 'none',
          border: active ? '1px solid rgba(232,184,109,0.2)' : '1px solid transparent',
          color: active ? '#e8b86d' : hover ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.3)',
        }}>
        {icon}
        <span style={{ fontSize:9, fontWeight:500, letterSpacing:.3 }}>{label}</span>
        {badge && <span style={{ position:'absolute', top:8, right:8, width:7, height:7, background:'#e8b86d', borderRadius:'50%', border:'2px solid #08090f' }} />}
      </button>
      {/* Tooltip nach 400ms */}
      {showTooltip && title && (
        <div style={{ position:'absolute', left:'110%', top:'50%', transform:'translateY(-50%)', background:'rgba(13,15,24,0.95)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'5px 10px', fontSize:11, fontWeight:600, color:'rgba(255,255,255,0.9)', whiteSpace:'nowrap', zIndex:9999, pointerEvents:'none', boxShadow:'0 4px 16px rgba(0,0,0,0.4)' }}>
          {title}
        </div>
      )}
    </div>
  )
}


/* ─── Rechte Sidebar (dauerhaft sichtbar) ──────────────────────── */
function RightSidebar({ onCreateChannel, onCreateGroup, onDiscover, onNotes }: {
  onCreateChannel: () => void; onCreateGroup: () => void
  onDiscover: () => void; onNotes: () => void
}) {
  const conversations = useChatStore(s => s.conversations)
  const contacts      = useContactStore(s => s.contacts)
  const setActive     = useChatStore(s => s.setActiveConversation)
  const apiBase       = import.meta.env.VITE_API_URL || ''

  const onlineCount      = contacts.filter(c => c.user?.status === 'online').length
  const onlineFriends    = contacts.filter(c => c.user?.status === 'online').slice(0, 5)
  const trendingChannels = conversations.filter(c => (c as any).isChannel).slice(0, 3)

  return (
    <div style={{ width:220, flexShrink:0, borderLeft:'1px solid rgba(255,255,255,0.05)', padding:'18px 14px', overflowY:'auto', display:'flex', flexDirection:'column', gap:18, background:'rgba(8,9,15,0.5)' }}>

      {/* Online Freunde */}
      <div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
          <span style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.3)', letterSpacing:'.09em', textTransform:'uppercase' }}>Online Freunde</span>
          <span style={{ fontSize:10, color:'#4ade80', fontWeight:600 }}>{onlineCount} online</span>
        </div>
        {onlineFriends.length === 0
          ? <div style={{ fontSize:11, color:'rgba(255,255,255,0.2)', textAlign:'center', padding:'6px 0' }}>Niemand online</div>
          : onlineFriends.map(ct => (
            <div key={ct._id} onClick={async () => {
                try {
                  const { data } = await api.post('/api/conversations', { participantId: ct.user._id })
                  setActive(data._id)
                } catch {}
              }} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 4px', borderRadius:6, cursor:'pointer', transition:'background .12s' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.04)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='transparent'}>
              <div style={{ position:'relative', flexShrink:0 }}>
                <div style={{ width:26, height:26, borderRadius:'50%', background:'linear-gradient(135deg,#1a4a6b,#0d9488)', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'#fff' }}>
                  {ct.user?.avatar ? <img src={`${apiBase}${ct.user.avatar}`} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" /> : (ct.user?.username?.[0]||'?').toUpperCase()}
                </div>
                <span style={{ position:'absolute', bottom:0, right:0, width:6, height:6, borderRadius:'50%', background:'#4ade80', border:'1.5px solid #08090f' }} />
              </div>
              <span style={{ fontSize:12, color:'rgba(255,255,255,0.6)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ct.user?.username}</span>
            </div>
          ))}
      </div>

      <div style={{ height:1, background:'rgba(255,255,255,0.05)' }} />

      {/* Trending Channels */}
      <div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
          <span style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.3)', letterSpacing:'.09em', textTransform:'uppercase' }}>Trending Channels</span>
          <button onClick={onDiscover} style={{ fontSize:10, color:'rgba(255,255,255,0.3)', background:'none', border:'none', cursor:'pointer', padding:0 }}>Alle &rsaquo;</button>
        </div>
        {trendingChannels.length === 0 ? (
          <button onClick={onDiscover} style={{ width:'100%', padding:'7px', borderRadius:8, border:'1px dashed rgba(255,255,255,0.1)', background:'transparent', color:'rgba(255,255,255,0.25)', cursor:'pointer', fontSize:11 }}>
            Channels entdecken →
          </button>
        ) : trendingChannels.map(ch => (
          <div key={ch._id} onClick={() => setActive(ch._id)} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 4px', borderRadius:6, cursor:'pointer', transition:'background .12s' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.04)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='transparent'}>
            <div style={{ width:26, height:26, borderRadius:7, background:'linear-gradient(135deg,#1e40af,#7c3aed)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <svg width="12" height="12" fill="none" stroke="white" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.47 2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.57a16 16 0 0 0 6 6l.72-.94a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.27 16z"/></svg>
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12, fontWeight:600, color:'rgba(255,255,255,0.7)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ch.groupName}</div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.3)' }}>{(ch as any).subscriberCount||0} Abos</div>
            </div>
            <span>🔥</span>
          </div>
        ))}
      </div>

      <div style={{ height:1, background:'rgba(255,255,255,0.05)' }} />

      {/* Schnell-Zugriff */}
      <div>
        <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.3)', letterSpacing:'.09em', textTransform:'uppercase', marginBottom:8 }}>Schnell-Zugriff</div>
        {[
          { icon:'🔖', label:'Notizen',          sub:'Gespeicherte Nachrichten', fn: onNotes },
          { icon:'📢', label:'Channel erstellen', sub:'Neuen Channel anlegen',    fn: onCreateChannel },
          { icon:'👥', label:'Gruppe erstellen',  sub:'Neue Gruppe anlegen',      fn: onCreateGroup },
        ].map(item => (
          <div key={item.label} onClick={item.fn} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 4px', borderRadius:7, cursor:'pointer', marginBottom:2, transition:'background .12s' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.05)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='transparent'}>
            <div style={{ width:26, height:26, borderRadius:7, background:'rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, flexShrink:0 }}>{item.icon}</div>
            <div style={{ minWidth:0 }}>
              <div style={{ fontSize:11, fontWeight:600, color:'rgba(255,255,255,0.6)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.label}</div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.25)' }}>{item.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}


/* ─── AnimatedNumber ─────────────────────────────────────────── */
function AnimatedNumber({ value }: { value: number }) {
  const [displayed, setDisplayed] = useState(0)
  const prevVal = useRef(0)
  useEffect(() => {
    const start = prevVal.current
    const end   = value
    if (start === end) return
    prevVal.current = end
    const duration = 600
    const startTime = Date.now()
    const tick = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayed(Math.round(start + (end - start) * eased))
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [value])
  return <div style={{ fontSize:22, fontWeight:800, color:'#fff', marginBottom:2 }}>{displayed}</div>
}

/* ─── Dashboard (Startseite) ─────────────────────────────────── */
function Dashboard({ onNewChat, onCreateGroup, onCreateChannel, onDiscover }: {
  onNewChat: () => void; onCreateGroup: () => void
  onCreateChannel: () => void; onDiscover: () => void
}) {
  const user          = useAuthStore(s => s.user)
  const conversations = useChatStore(s => s.conversations)
  const contacts      = useContactStore(s => s.contacts)
  const setActive     = useChatStore(s => s.setActiveConversation)
  const apiBase       = import.meta.env.VITE_API_URL || ''

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Guten Morgen' : hour < 18 ? 'Guten Tag' : 'Guten Abend'

  const totalUnread  = conversations.reduce((s,c) => s + (c.unreadCount||0), 0)
  const onlineCount  = contacts.filter(c => c.user?.status === 'online').length
  const channelConvs = conversations.filter(c => (c as any).isChannel)
  const recentConvs  = [...conversations].sort((a,b) => new Date(b.updatedAt??0).getTime() - new Date(a.updatedAt??0).getTime()).slice(0,5)
  const onlineFriends = contacts.filter(c => c.user?.status === 'online').slice(0,6)
  const trendingChannels = channelConvs.slice(0,3)

  const formatTime = (d?: string) => {
    if (!d) return ''
    const diff = Date.now() - new Date(d).getTime()
    if (diff < 3600000) return `${Math.floor(diff/60000)}m`
    if (diff < 86400000) return `${Math.floor(diff/3600000)}h`
    return new Date(d).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'})
  }

  const quickActions = [
    { icon:'💬', label:'Neue Nachricht',   sub:'Starte ein Gespräch',    onClick: onNewChat },
    { icon:'📢', label:'Channel erstellen', sub:'Erstelle deinen Channel', onClick: onCreateChannel },
    { icon:'👥', label:'Gruppe erstellen',  sub:'Erstelle eine Gruppe',    onClick: onCreateGroup },
    { icon:'🔭', label:'Entdecken',         sub:'Finde neue Channels',     onClick: onDiscover },
  ]

  return (
    <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
      {/* ── Haupt-Dashboard ── */}
      <div style={{ flex:1, overflowY:'auto', padding:'28px 28px 20px',
          background: (() => {
            const h = new Date().getHours()
            if (h>=5&&h<12)  return 'radial-gradient(ellipse at 30% 0%, rgba(100,149,237,0.06) 0%, transparent 60%)'
            if (h>=12&&h<18) return 'radial-gradient(ellipse at 50% 0%, rgba(232,184,109,0.06) 0%, transparent 60%)'
            if (h>=18&&h<22) return 'radial-gradient(ellipse at 60% 0%, rgba(180,80,20,0.08) 0%, transparent 60%)'
            return 'radial-gradient(ellipse at 40% 0%, rgba(30,40,100,0.1) 0%, transparent 60%)'
          })() }}>
        {/* Begrüßung */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:28 }}>
          <div>
            <h1 style={{ fontSize:24, fontWeight:800, color:'#fff', letterSpacing:'-0.03em', marginBottom:4 }}>
              {greeting}, {user?.username}! 👋
            </h1>
            <p style={{ fontSize:13, color:'rgba(255,255,255,0.4)' }}>Weiter machen, wo du aufgehört hast.</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:24 }}>
          {quickActions.map(a => (
            <button key={a.label} onClick={a.onClick} style={{
              padding:'16px 14px', borderRadius:14, cursor:'pointer', textAlign:'center',
              background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)',
              transition:'all .15s', display:'flex', flexDirection:'column', alignItems:'center', gap:8,
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background='rgba(232,184,109,0.06)'; (e.currentTarget as HTMLElement).style.borderColor='rgba(232,184,109,0.2)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.03)'; (e.currentTarget as HTMLElement).style.borderColor='rgba(255,255,255,0.07)' }}
            >
              <span style={{ fontSize:24 }}>{a.icon}</span>
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,0.85)', marginBottom:2 }}>{a.label}</div>
                <div style={{ fontSize:10, color:'rgba(255,255,255,0.35)' }}>{a.sub}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Aktivitätsübersicht */}
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.3)', letterSpacing:'.1em', textTransform:'uppercase', marginBottom:10 }}>Aktivitätsübersicht</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
            {[
              { label:'Neue Nachrichten', value:totalUnread, icon:'💬', color:'rgba(79,110,247,0.15)', border:'rgba(79,110,247,0.25)' },
              { label:'Online Freunde',   value:onlineCount, icon:'🟢', color:'rgba(74,222,128,0.1)',  border:'rgba(74,222,128,0.2)' },
              { label:'Channels',         value:channelConvs.length, icon:'📢', color:'rgba(30,64,175,0.1)', border:'rgba(30,64,175,0.2)' },
              { label:'Kontakte',         value:contacts.length, icon:'👤', color:'rgba(232,184,109,0.08)', border:'rgba(232,184,109,0.2)' },
            ].map(s => (
              <div key={s.label} style={{ padding:'14px', borderRadius:12, background:s.color, border:`1px solid ${s.border}` }}>
                <AnimatedNumber value={s.value} />
                <div style={{ fontSize:10, color:'rgba(255,255,255,0.5)', display:'flex', alignItems:'center', gap:4 }}>
                  <span>{s.icon}</span>{s.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Letzte Aktivitäten */}
        <div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.3)', letterSpacing:'.1em', textTransform:'uppercase' }}>Letzte Aktivitäten</div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            {recentConvs.length === 0 ? (
              <div style={{ textAlign:'center', padding:'40px 20px', color:'rgba(255,255,255,0.2)', fontSize:13 }}>Noch keine Gespräche</div>
            ) : recentConvs.map(conv => {
              const isChannel = (conv as any).isChannel
              const peer = !conv.isGroup && !isChannel ? conv.participants?.find((p:any) => p._id !== user?._id) : null
              const name = isChannel ? conv.groupName : conv.isGroup ? conv.groupName : peer?.username ?? '?'
              const avatar = isChannel ? null : conv.isGroup ? (conv as any).groupAvatar : peer?.avatar
              const preview = conv.lastMessage?.content || (isChannel ? `${(conv as any).subscriberCount||0} Abonnenten` : 'Noch keine Nachricht')
              return (
                <div key={conv._id} onClick={() => setActive(conv._id)}
                  style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 12px', borderRadius:12, cursor:'pointer', background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.05)', transition:'all .15s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.05)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.02)' }}
                >
                  <div style={{ width:38, height:38, borderRadius: conv.isGroup||isChannel ? 10 : '50%', background: isChannel ? 'linear-gradient(135deg,#1e40af,#7c3aed)' : conv.isGroup ? 'linear-gradient(135deg,#4a1a6b,#b46a0e)' : 'linear-gradient(135deg,#1a4a6b,#0d9488)', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', fontSize:isChannel?16:14, fontWeight:700, color:'#fff', flexShrink:0 }}>
                    {avatar ? <img src={`${apiBase}${avatar}`} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" /> : isChannel ? '📢' : (name?.[0]||'?').toUpperCase()}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:'rgba(255,255,255,0.85)', marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{name}</div>
                    <div style={{ fontSize:11, color:'rgba(255,255,255,0.35)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{preview}</div>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
                    <span style={{ fontSize:10, color:'rgba(255,255,255,0.25)' }}>{formatTime(conv.updatedAt)}</span>
                    {conv.unreadCount > 0 && (
                      <span style={{ background:'linear-gradient(135deg,#b46a0e,#e8b86d)', color:'#fff', fontSize:10, fontWeight:800, borderRadius:99, minWidth:18, height:18, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 5px' }}>{conv.unreadCount}</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>


    </div>
  )
}

/* ─── Channel Discovery Panel ────────────────────────────────── */
function ChannelDiscoverPanel({ onClose, onCreateChannel }: { onClose: () => void; onCreateChannel: () => void }) {
  const conversations  = useChatStore(s => s.conversations)
  const fetchConvs     = useChatStore(s => s.fetchConversations)
  const setActive      = useChatStore(s => s.setActiveConversation)
  const [tab, setTab]  = useState<'eigene'|'beliebt'|'neu'>('beliebt')
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const channelConvs = conversations.filter(c => (c as any).isChannel)
  const myChannels   = channelConvs.filter((c:any) => c.owner || (c.admins||[]).length > 0)

  useEffect(() => {
    setLoading(true)
    api.get(`/api/channels/search?q=${encodeURIComponent(search)}`).then(r => {
      setResults(r.data || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [search])

  const subscribe = async (id: string) => {
    await api.post(`/api/channels/${id}/subscribe`)
    fetchConvs()
  }

  const isSubscribed = (id: string) => channelConvs.some((c:any) => c._id === id)

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', background:'#08090f' }}>
      {/* Header */}
      <div style={{ padding:'16px 20px 12px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div>
          <h2 style={{ fontSize:16, fontWeight:800, color:'#fff', marginBottom:2 }}>Channels</h2>
          <p style={{ fontSize:11, color:'rgba(255,255,255,0.35)' }}>Entdecke und abonniere Channels</p>
        </div>
        <button onClick={onCreateChannel} style={{ padding:'7px 16px', borderRadius:10, border:'none', background:'linear-gradient(135deg,#1e40af,#7c3aed)', color:'#fff', fontWeight:700, fontSize:12, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
          <span>+</span> Channel erstellen
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, padding:'10px 20px 0', borderBottom:'1px solid rgba(255,255,255,0.06)', flexShrink:0 }}>
        {(['eigene','beliebt','neu'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding:'7px 16px', borderRadius:'8px 8px 0 0', border:'none', cursor:'pointer', fontSize:12, fontWeight:600, textTransform:'capitalize',
            background: tab===t ? 'rgba(255,255,255,0.06)' : 'transparent',
            color: tab===t ? '#e8b86d' : 'rgba(255,255,255,0.4)',
            borderBottom: tab===t ? '2px solid #e8b86d' : '2px solid transparent',
          }}>{t.charAt(0).toUpperCase()+t.slice(1)}</button>
        ))}
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'16px 20px' }}>
        {/* Suche */}
        <div style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:10, padding:'8px 12px', marginBottom:16 }}>
          <svg width="13" height="13" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Channel suchen..." style={{ flex:1, background:'none', border:'none', outline:'none', fontSize:13, color:'#fff' }} />
        </div>

        {tab === 'eigene' && (
          <div>
            <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.25)', letterSpacing:'.1em', textTransform:'uppercase', marginBottom:10 }}>Meine Channels</div>
            {myChannels.length === 0 ? (
              <div style={{ textAlign:'center', padding:'40px 20px', color:'rgba(255,255,255,0.2)', fontSize:13 }}>
                <div style={{ fontSize:40, marginBottom:10 }}>📢</div>
                Du hast noch keinen Channel erstellt.
                <br/><button onClick={onCreateChannel} style={{ marginTop:12, padding:'8px 18px', borderRadius:8, border:'none', background:'linear-gradient(135deg,#1e40af,#7c3aed)', color:'#fff', cursor:'pointer', fontSize:12, fontWeight:600 }}>Jetzt erstellen</button>
              </div>
            ) : myChannels.map((ch:any) => (
              <ChannelCard key={ch._id} ch={ch} subscribed={isSubscribed(ch._id)} onSubscribe={() => subscribe(ch._id)} onOpen={() => { setActive(ch._id); onClose() }} />
            ))}
          </div>
        )}

        {(tab === 'beliebt' || tab === 'neu') && (
          <div>
            <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.25)', letterSpacing:'.1em', textTransform:'uppercase', marginBottom:10 }}>
              {tab==='beliebt' ? 'Beliebte Channels' : 'Neue Channels'}
            </div>
            {loading ? (
              <div style={{ textAlign:'center', padding:40, color:'rgba(255,255,255,0.3)', fontSize:13 }}>Lädt...</div>
            ) : results.length === 0 ? (
              <div style={{ textAlign:'center', padding:40, color:'rgba(255,255,255,0.2)', fontSize:13 }}>Keine Channels gefunden</div>
            ) : results.map((ch:any) => (
              <ChannelCard key={ch._id} ch={ch} subscribed={isSubscribed(ch._id)} onSubscribe={() => subscribe(ch._id)} onOpen={() => { fetchConvs(); onClose() }} isNew={tab==='neu'} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ChannelCard({ ch, subscribed, onSubscribe, onOpen, isNew }: { ch:any; subscribed:boolean; onSubscribe:()=>void; onOpen:()=>void; isNew?:boolean }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:12, border:'1px solid rgba(255,255,255,0.06)', background:'rgba(255,255,255,0.02)', marginBottom:8, cursor:'pointer', transition:'all .15s' }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.05)'}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.02)'}
      onClick={onOpen}
    >
      <div style={{ width:44, height:44, borderRadius:12, background:'linear-gradient(135deg,#1e40af,#7c3aed)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>📢</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
          <span style={{ fontSize:13, fontWeight:600, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ch.name||ch.groupName}</span>
          {ch.verified && <span style={{ fontSize:10, color:'#60a5fa', fontWeight:700 }}>✓</span>}
          {(ch.isAdult||(ch as any).isAdult) && <span style={{ fontSize:9, background:'rgba(239,68,68,0.2)', color:'#f87171', padding:'0 4px', borderRadius:3, fontWeight:700, border:'0.5px solid rgba(239,68,68,0.3)' }}>18+</span>}
          {isNew && <span style={{ fontSize:9, background:'rgba(74,222,128,0.15)', color:'#4ade80', padding:'0 5px', borderRadius:3, fontWeight:700, border:'0.5px solid rgba(74,222,128,0.25)' }}>NEU</span>}
        </div>
        <div style={{ fontSize:10, color:'rgba(255,255,255,0.35)' }}>
          @{ch.handle||ch.channelHandle} · {ch.subscriberCount||ch.subscribers?.length||0} Abonnenten
          {ch.description && ` · ${ch.description.slice(0,40)}...`}
        </div>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
        <span style={{ fontSize:14 }}>🔥</span>
        <button onClick={e => { e.stopPropagation(); onSubscribe() }} style={{
          padding:'5px 14px', borderRadius:8, border:'none', cursor:'pointer', fontSize:11, fontWeight:600,
          background: subscribed ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg,#1e40af,#7c3aed)',
          color: subscribed ? 'rgba(255,255,255,0.5)' : '#fff',
        }}>{subscribed ? 'Abonniert ✓' : 'Abonnieren'}</button>
      </div>
    </div>
  )
}

/* ─── Create Channel Panel ───────────────────────────────────── */
function CreateChannelPanel({ onClose }: { onClose: () => void }) {
  const fetchConvs = useChatStore(s => s.fetchConversations)
  const [name, setName]       = useState('')
  const [handle, setHandle]   = useState('')
  const [desc, setDesc]       = useState('')
  const [isPublic, setPublic] = useState(true)
  const [isAdult, setAdult]   = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const onNameChange = (v: string) => {
    setName(v)
    setHandle(v.toLowerCase().replace(/[^a-z0-9_]/g,'_').replace(/_+/g,'_').slice(0,32))
  }

  const submit = async () => {
    setError('')
    if (!name.trim()) return setError('Name erforderlich')
    if (handle.length < 3) return setError('Handle mind. 3 Zeichen')
    setLoading(true)
    try {
      await api.post('/api/channels', { name: name.trim(), handle, description: desc, isPublic, isAdult })
      fetchConvs(); onClose()
    } catch (err:any) { setError(err?.response?.data?.error || 'Fehler') }
    setLoading(false)
  }

  const inp: React.CSSProperties = { width:'100%', padding:'10px 13px', borderRadius:10, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'#fff', fontSize:13, outline:'none', boxSizing:'border-box' }

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', background:'#08090f' }}>
      <div style={{ padding:'16px 20px 12px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <h2 style={{ fontSize:16, fontWeight:800, color:'#fff' }}>📢 Channel erstellen</h2>
        <button onClick={onClose} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer', fontSize:20 }}>×</button>
      </div>
      <div style={{ flex:1, overflowY:'auto', padding:'20px' }}>
        {error && <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.25)', borderRadius:10, padding:'10px 14px', color:'#fca5a5', fontSize:13, marginBottom:14 }}>{error}</div>}
        <div style={{ marginBottom:14 }}>
          <label style={{ display:'block', fontSize:11, fontWeight:600, color:'rgba(255,255,255,0.4)', marginBottom:5, textTransform:'uppercase', letterSpacing:'.05em' }}>Name</label>
          <input value={name} onChange={e => onNameChange(e.target.value)} placeholder="z.B. Nokki News" maxLength={64} style={inp} autoFocus />
        </div>
        <div style={{ marginBottom:14 }}>
          <label style={{ display:'block', fontSize:11, fontWeight:600, color:'rgba(255,255,255,0.4)', marginBottom:5, textTransform:'uppercase', letterSpacing:'.05em' }}>Handle</label>
          <div style={{ position:'relative' }}>
            <span style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', color:'rgba(255,255,255,0.3)', fontSize:13 }}>@</span>
            <input value={handle} onChange={e => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,'').slice(0,32))} placeholder="channel_handle" maxLength={32} style={{ ...inp, paddingLeft:28 }} />
          </div>
        </div>
        <div style={{ marginBottom:14 }}>
          <label style={{ display:'block', fontSize:11, fontWeight:600, color:'rgba(255,255,255,0.4)', marginBottom:5, textTransform:'uppercase', letterSpacing:'.05em' }}>Beschreibung</label>
          <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Worum geht es?" maxLength={300} rows={3} style={{ ...inp, resize:'none', lineHeight:1.5 }} />
        </div>
        <div style={{ display:'flex', gap:8, marginBottom:14 }}>
          {[{v:true,l:'🌐 Öffentlich'},{v:false,l:'🔒 Privat'}].map(opt => (
            <button key={String(opt.v)} onClick={() => setPublic(opt.v)} style={{ flex:1, padding:'10px', borderRadius:10, cursor:'pointer', background: isPublic===opt.v ? 'rgba(30,64,175,0.15)' : 'rgba(255,255,255,0.04)', border:`1px solid ${isPublic===opt.v ? 'rgba(30,64,175,0.4)' : 'rgba(255,255,255,0.08)'}`, color: isPublic===opt.v ? '#93c5fd' : 'rgba(255,255,255,0.5)', fontSize:12, fontWeight:600, transition:'all .15s' }}>{opt.l}</button>
          ))}
        </div>
        <label style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:10, cursor:'pointer', background: isAdult ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)', border:`1px solid ${isAdult ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.07)'}`, marginBottom:20, transition:'all .15s' }}>
          <input type="checkbox" checked={isAdult} onChange={e => setAdult(e.target.checked)} style={{ width:16, height:16, accentColor:'#ef4444', cursor:'pointer' }} />
          <div>
            <div style={{ fontSize:13, fontWeight:700, color: isAdult ? '#f87171' : 'rgba(255,255,255,0.8)' }}>🔞 FSK18 / Nur für Erwachsene</div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.35)', marginTop:2 }}>Channel wird mit 18+ Badge markiert</div>
          </div>
        </label>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onClose} style={{ flex:1, padding:'11px', borderRadius:10, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.6)', cursor:'pointer' }}>Abbrechen</button>
          <button onClick={submit} disabled={loading||!name.trim()||handle.length<3} style={{ flex:2, padding:'11px', borderRadius:10, border:'none', background: !loading&&name.trim()&&handle.length>=3 ? 'linear-gradient(135deg,#1e40af,#7c3aed)' : 'rgba(255,255,255,0.06)', color: !loading&&name.trim()&&handle.length>=3 ? '#fff' : 'rgba(255,255,255,0.3)', cursor: loading||!name.trim()||handle.length<3 ? 'not-allowed' : 'pointer', fontWeight:700, fontSize:14, opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Erstellt…' : '📢 Channel erstellen'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Quiet Hours Helper ─────────────────────────────────────── */
function isInQuietHours(): boolean {
  try {
    const qh = JSON.parse(localStorage.getItem('pingr_quiet_hours') || '{}')
    if (!qh.enabled) return false
    const now  = new Date()
    const [sh, sm] = (qh.start||'22:00').split(':').map(Number)
    const [eh, em] = (qh.end||'08:00').split(':').map(Number)
    const cur  = now.getHours()*60+now.getMinutes()
    const s    = sh*60+sm
    const e    = eh*60+em
    return s > e ? (cur >= s || cur < e) : (cur >= s && cur < e)
  } catch { return false }
}

/* ─── Verification Banner ────────────────────────────────────── */
function VerificationBanner() {
  const user = useAuthStore(s => s.user)
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  if (!user || (user as any).emailVerified !== false) return null
  const resend = async () => {
    setLoading(true)
    try { await api.post('/api/auth/resend-verification'); setSent(true) }
    catch { setSent(true) }
    finally { setLoading(false) }
  }
  return (
    <div style={{ background:'rgba(232,184,109,0.08)', borderBottom:'1px solid rgba(232,184,109,0.2)', padding:'8px 16px', display:'flex', alignItems:'center', gap:10, fontSize:12, color:'#e8b86d', flexShrink:0, zIndex:20 }}>
      <span>⚠️</span>
      <span style={{ flex:1 }}><strong>E-Mail nicht bestätigt.</strong> Bitte prüfe dein Postfach.</span>
      {!sent ? <button onClick={resend} disabled={loading} style={{ background:'rgba(232,184,109,0.15)', border:'1px solid rgba(232,184,109,0.3)', borderRadius:6, color:'#e8b86d', padding:'3px 10px', cursor:'pointer', fontSize:11, opacity: loading ? 0.6 : 1 }}>{loading ? '…' : '📧 Neu senden'}</button>
      : <span style={{ color:'#4ade80', fontSize:11 }}>✓ Gesendet!</span>}
    </div>
  )
}

/* ─── Haupt-Komponente ───────────────────────────────────────── */
export default function Chat() {
  const user              = useAuthStore(s => s.user)
  const fetchMe           = useAuthStore(s => s.fetchMe)
  const token             = useAuthStore(s => s.token)
  const { colorTheme, chatBg, chatBgCustom, bubbleStyle } = useThemeStore()
  const { play }          = useSound()
  const { tr }            = useI18n()

  const conversations         = useChatStore(s => s.conversations)
  const fetchConversations     = useChatStore(s => s.fetchConversations)
  const activeConversationId   = useChatStore(s => s.activeConversationId)
  const setActiveConversation  = useChatStore(s => s.setActiveConversation)

  const [navTab,       setNavTab]       = useState<NavTab>('home')
  const [rightPanel,   setRightPanel]   = useState<RightPanel>('none')
  const [showSettings, setShowSettings] = useState(false)
  const [showSearch,   setShowSearch]   = useState(false)
  const [showBookmarks,setShowBookmarks]= useState(false)
  const [showGroupModal,setShowGroupModal] = useState(false)
  const [toasts,       setToasts]       = useState<Toast[]>([])
  const [profileUserId,    setProfileUserId]   = useState<string|null>(null)
  const [showStatusPicker, setShowStatusPicker] = useState(false)
  const [rightCollapsed,   setRightCollapsed]   = useState(false)
  const [showMobileMenu,   setShowMobileMenu]   = useState(false)
  const updateStatus = useAuthStore(s => s.updateStatus)
  const logout       = useAuthStore(s => s.logout)
  const [globalCall,   setGlobalCall]   = useState<any>(null)
  const [activeIdentity, setActiveIdentity] = useState<any>(null)

  const apiBase   = import.meta.env.VITE_API_URL || ''
  const userAvatar = user?.avatar ? `${apiBase}${user.avatar}` : null
  const userInitial = (user?.username?.[0] || '?').toUpperCase()

  // Contacts laden
  const { fetchContacts } = useContactStore()
  useEffect(() => { fetchContacts() }, [])

  useEffect(() => { if (token) fetchMe() }, [token])

  useEffect(() => {
    const setup = async () => {
      try {
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey: await api.get('/api/push/vapid-public-key').then(r => r.data.key) })
        await api.post('/api/push/subscribe', sub)
      } catch {}
    }
    if ('Notification' in window && Notification.permission === 'default') setTimeout(() => setup(), 3000)
    else if (Notification.permission === 'granted') setTimeout(() => setup(), 1000)
    setTimeout(() => play('login'), 500)
  }, [])

  useWebSocket(user?._id)
  useEffect(() => { applyTheme(colorTheme) }, [colorTheme])

  useEffect(() => {
    const socket = getSocket()
    const onContact = () => play('contact')
    socket.on('contact_added', onContact)
    window.addEventListener('pingr_contact_added', onContact)
    const onError = () => play('error')
    window.addEventListener('pingr_upload_error', onError)
    const onLogout = () => play('logout')
    window.addEventListener('pingr_logout', onLogout)
    return () => {
      socket.off('contact_added', onContact)
      window.removeEventListener('pingr_contact_added', onContact)
      window.removeEventListener('pingr_upload_error', onError)
      window.removeEventListener('pingr_logout', onLogout)
    }
  }, [play])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey||e.metaKey) && e.key==='k') { e.preventDefault(); setShowSearch(s => !s) }
      if (e.key==='Escape') { setShowSearch(false); setShowSettings(false); setShowBookmarks(false); setRightPanel('none'); setShowStatusPicker(false); setShowMobileMenu(false) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const socket = getSocket()
    const onCall = ({ from, callerName, offer, conversationId: cId }: any) => setGlobalCall({ targetId:from, targetName:callerName||'Unbekannt', isIncoming:true, conversationId:cId, offer })
    socket.on('incoming_call', onCall)
    const onStart = (e: Event) => { const d = (e as CustomEvent).detail; setGlobalCall({ targetId:d.targetId, targetName:d.targetName, isIncoming:false, conversationId:d.conversationId }) }
    window.addEventListener('start_call', onStart)
    return () => { socket.off('incoming_call', onCall); window.removeEventListener('start_call', onStart) }
  }, [])

  useEffect(() => {
    fetchConversations()
    const poll = setInterval(() => fetchConversations(), 30000)
    return () => clearInterval(poll)
  }, [fetchConversations])

  // Wenn ein Channel aktiv wird → sicherstellen dass kein falscher Tab aktiv ist
  // Wenn ein normaler Chat aktiv wird → Chats-Tab aktiv setzen
  useEffect(() => {
    if (!activeConversationId) return
    const conv = conversations.find(c => c._id === activeConversationId) as any
    if (conv?.isChannel) {
      setNavTab('chats')
      setRightPanel('none')
    } else if (activeConversationId && activeConversationId !== '__saved__') {
      setNavTab('chats')
      setRightPanel('none')
    }
  }, [activeConversationId])

  const addToast = useCallback((msg: string, type: Toast['type']) => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message:msg, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), type==='broadcast' ? 8000 : 4000)
  }, [])

  useEffect(() => {
    const onSwitch = (e: Event) => { const id = (e as CustomEvent).detail?.identity; if (id) setActiveIdentity(id) }
    window.addEventListener('nokki_identity_switch', onSwitch)
    return () => window.removeEventListener('nokki_identity_switch', onSwitch)
  }, [])

  useEffect(() => {
    const onPing  = (e: Event) => addToast(`${(e as CustomEvent).detail.senderName} hat dich gepingt!`, 'ping')
    const onBcast = (e: Event) => addToast(`Admin: ${(e as CustomEvent).detail.content}`, 'broadcast')
    const onMsg   = (e: Event) => {
      const qh = isInQuietHours()
      if (!qh) play('ding')
      fetchConversations()
      const { senderName, content, conversationId } = (e as CustomEvent).detail || {}
      if (!qh && document.hidden && 'Notification' in window && Notification.permission==='granted') {
        const n = new Notification(`💬 ${senderName||'Nokki'}`, { body: content?.length>80?content.slice(0,80)+'…':content||'Neue Nachricht', icon:'/favicon.svg', tag:`msg-${conversationId}` })
        n.onclick = () => { window.focus(); n.close() }
      }
    }
    window.addEventListener('pingr_incoming_ping', onPing)
    window.addEventListener('pingr_broadcast', onBcast)
    window.addEventListener('pingr_new_message', onMsg)
    return () => {
      window.removeEventListener('pingr_incoming_ping', onPing)
      window.removeEventListener('pingr_broadcast', onBcast)
      window.removeEventListener('pingr_new_message', onMsg)
    }
  }, [addToast, play, fetchConversations])

  const activeConv = conversations.find(c => c._id === activeConversationId)
  const isMobile   = useIsMobile()
  const mobileView = activeConversationId ? 'chat'
                   : (navTab === 'chats' || navTab === 'contacts') ? 'list'
                   : 'home'

  const navItems: { id: NavTab; icon: JSX.Element; label: string }[] = [
    { id:'home',     label:'Start',      icon: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg> },
    { id:'chats',    label:'Chats',      icon: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
    { id:'channels', label:'Channels',   icon: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.47 2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.57a16 16 0 0 0 6 6l.72-.94a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.27 16z"/></svg> },
    { id:'contacts', label:'Kontakte',   icon: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
    { id:'notes',    label:'Notizen',    icon: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg> },
    { id:'settings', label:'Settings',   icon: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> },
  ]

  const handleNavClick = (id: NavTab) => {
    if (id === 'settings') { setShowSettings(true); return }
    if (id === 'notes') { setActiveConversation('__saved__'); setNavTab('chats'); return }
    // Jeden Tab-Wechsel: Chat schließen — außer Chats-Tab darf Chat behalten
    if (id !== 'chats' && activeConversationId) {
      setActiveConversation(null)
    }
    if (id === 'channels') { setRightPanel('discover'); setNavTab('channels'); return }
    setNavTab(id)
    setRightPanel('none')
  }

  // Zeige Chat-Panel wenn ein Chat aktiv ist (außer bei home/channels Panel)
  const showChatPanel = navTab === 'chats' || navTab === 'contacts' || (activeConversationId && !(activeConv as any)?.isChannel && navTab !== 'home')

  return (
    <>
      <style>{`
        @keyframes slideUpToast { from { transform:translateY(20px); opacity:0; } to { transform:translateY(0); opacity:1; } }
        input, textarea { color-scheme: dark; }
        input:focus, textarea:focus { border-color: rgba(232,184,109,0.4) !important; }
        button { font-family: inherit; }
      `}</style>

      <ToastContainer toasts={toasts} onDismiss={id => setToasts(prev => prev.filter(t => t.id !== id))} />

      {/* Aurora */}
      <div className="aurora-bg"><div className="aurora-bg-3" /></div>

      {/* Identity Bar */}
      {activeIdentity && (
        <div style={{ position:'fixed', top:0, left:0, right:0, height:2, zIndex:9999, background: activeIdentity.type==='private' ? 'linear-gradient(90deg,#1a4a6b,#0d9488)' : activeIdentity.type==='work' ? 'linear-gradient(90deg,#1e40af,#7c3aed)' : 'linear-gradient(90deg,#2d1b4e,#4a1a6b)', opacity:0.8 }} />
      )}

      {/* ══ MOBILE LAYOUT ══ */}
      {isMobile && (
        <div style={{ display:'flex', flexDirection:'column', height:'100dvh', overflow:'hidden', position:'relative', zIndex:1 }}>

          {/* Mobile Header */}
          <div style={{ height:54, flexShrink:0, background:'rgba(8,9,15,0.98)', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', padding:'0 14px', gap:10 }}>
            {/* Zurück Button — immer wenn Conversation aktiv */}
            {!!activeConversationId && (
              <button onClick={() => {
                setActiveConversation(null)
                setNavTab((activeConv as any)?.isChannel ? 'channels' : 'chats')
              }}
                style={{ width:36, height:36, borderRadius:10, border:'none', background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.7)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="15,18 9,12 15,6"/></svg>
              </button>
            )}
            {/* Logo + Titel */}
            <div style={{ width:32, height:32, borderRadius:10, background:'linear-gradient(135deg,#b46a0e,#e8b86d)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <svg width="15" height="15" fill="none" stroke="white" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <span style={{ fontSize:16, fontWeight:700, color:'#fff', flex:1 }}>
              {activeConversationId
                ? (() => {
                    const ch = activeConv as any
                    if (ch?.isChannel) return ch?.groupName || 'Channel'
                    if (ch?.isGroup)   return ch?.groupName || 'Gruppe'
                    const peer = ch?.participants?.find((p:any) => p._id !== user?._id)
                    return peer?.username || ch?.groupName || 'Chat'
                  })()
                : navTab === 'channels' ? 'Channels'
                : navTab === 'contacts' ? 'Kontakte'
                : 'Nokki'}
            </span>
            {/* Rechte Aktionen */}
            <button onClick={() => setShowSearch(true)} style={{ width:36, height:36, borderRadius:10, border:'none', background:'none', color:'rgba(255,255,255,0.5)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            </button>
            {/* User Avatar / Logout */}
            {!activeConversationId && (
              <div style={{ position:'relative' }}>
                <div onClick={() => setShowMobileMenu(s => !s)}
                  style={{ width:34, height:34, borderRadius:'50%', background:'linear-gradient(135deg,#b46a0e,#e8b86d)', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:'#fff', cursor:'pointer', border:'2px solid rgba(232,184,109,0.25)' }}>
                  {userAvatar ? <img src={userAvatar} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" /> : userInitial}
                </div>
                {showMobileMenu && (
                  <div style={{ position:'absolute', top:'110%', right:0, background:'#0d0f18', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:6, minWidth:160, zIndex:9999, boxShadow:'0 8px 24px rgba(0,0,0,0.5)' }}>
                    <div onClick={() => { setShowSettings(true); setShowMobileMenu(false) }}
                      style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', borderRadius:8, cursor:'pointer', color:'rgba(255,255,255,0.7)', fontSize:13 }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.06)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='transparent'}>
                      ⚙️ Einstellungen
                    </div>
                    <div style={{ height:1, background:'rgba(255,255,255,0.07)', margin:'4px 0' }} />
                    <div onClick={() => { logout(); window.location.href='/login' }}
                      style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', borderRadius:8, cursor:'pointer', color:'#f87171', fontSize:13 }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='rgba(248,113,113,0.08)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='transparent'}>
                      🚪 Abmelden
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mobile Inhalt */}
          <div style={{ flex:1, display:'flex', flexDirection:'column', minHeight:0, overflow:'hidden' }}>
            {/* Chat-Liste */}
            {!activeConversationId && (navTab === 'chats' || navTab === 'contacts') && (
              <div style={{ flex:1, background:'rgba(255,255,255,0.01)', overflowY:'auto', minHeight:0 }}>
                <ContactList
                  onOpenSettings={() => setShowSettings(true)}
                  onOpenSearch={() => setShowSearch(true)}
                  onOpenBookmarks={() => setShowBookmarks(true)}
                  retroMode={false}
                  onToggleRetro={() => {}}
                  activeTab={navTab === 'contacts' ? 'contacts' : 'chats'}
                  onTabChange={t => setNavTab(t as any)}
                />
              </div>
            )}
            {/* Aktiver Chat */}
            {!!activeConversationId && (
              <div style={{ display:'flex', flexDirection:'column', flex:1, minHeight:0, height:'100%' }}>
                {(activeConv as any)?.isChannel
                  ? <ChannelView channelId={activeConversationId} channel={activeConv} />
                  : <ChatWindow conversationId={activeConversationId} />
                }
              </div>
            )}
            {/* Dashboard mobile */}
            {navTab === 'home' && !activeConversationId && rightPanel === 'none' && (
              <div style={{ flex:1, overflowY:'auto', padding:'20px 16px', minHeight:0 }}>
                <h2 style={{ fontSize:20, fontWeight:800, color:'#fff', marginBottom:4 }}>
                  {(() => { const h = new Date().getHours(); return h < 12 ? 'Guten Morgen' : h < 18 ? 'Guten Tag' : 'Guten Abend' })()}, {user?.username}! 👋
                </h2>
                <p style={{ fontSize:13, color:'rgba(255,255,255,0.4)', marginBottom:20 }}>Mach weiter wo du aufgehört hast.</p>
                {/* Schnellaktionen */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:20 }}>
                  {[
                    { icon:'💬', label:'Neue Nachricht', onClick: () => setNavTab('chats') },
                    { icon:'📢', label:'Channel', onClick: () => { setNavTab('channels'); setRightPanel('discover') } },
                    { icon:'👥', label:'Gruppe', onClick: () => setShowGroupModal(true) },
                    { icon:'🔭', label:'Entdecken', onClick: () => { setNavTab('channels'); setRightPanel('discover') } },
                  ].map(a => (
                    <button key={a.label} onClick={a.onClick} style={{ padding:'14px', borderRadius:14, cursor:'pointer', textAlign:'center', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
                      <span style={{ fontSize:22 }}>{a.icon}</span>
                      <span style={{ fontSize:12, fontWeight:600, color:'rgba(255,255,255,0.8)' }}>{a.label}</span>
                    </button>
                  ))}
                </div>
                {/* Letzte Aktivitäten */}
                <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.3)', letterSpacing:'.1em', textTransform:'uppercase', marginBottom:10 }}>Letzte Aktivitäten</div>
                {[...conversations].sort((a,b) => new Date(b.updatedAt??0).getTime()-new Date(a.updatedAt??0).getTime()).slice(0,8).map(conv => {
                  const isChannel = (conv as any).isChannel
                  const peer = !conv.isGroup && !isChannel ? conv.participants?.find((p:any) => p._id !== user?._id) : null
                  const name = isChannel ? conv.groupName : conv.isGroup ? conv.groupName : peer?.username ?? '?'
                  return (
                    <div key={conv._id} onClick={() => setActiveConversation(conv._id)}
                      style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:'1px solid rgba(255,255,255,0.05)', cursor:'pointer' }}>
                      <div style={{ width:40, height:40, borderRadius: conv.isGroup||isChannel ? 11 : '50%', background: isChannel ? 'linear-gradient(135deg,#1e40af,#7c3aed)' : conv.isGroup ? 'linear-gradient(135deg,#4a1a6b,#b46a0e)' : 'linear-gradient(135deg,#1a4a6b,#0d9488)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, color:'#fff', flexShrink:0 }}>
                        {isChannel ? <svg width="16" height="16" fill="none" stroke="white" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.47 2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.57a16 16 0 0 0 6 6l.72-.94a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.27 16z"/></svg> : (name?.[0]||'?').toUpperCase()}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:14, fontWeight:600, color:'rgba(255,255,255,0.85)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{name}</div>
                        <div style={{ fontSize:12, color:'rgba(255,255,255,0.35)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{conv.lastMessage?.content || 'Keine Nachricht'}</div>
                      </div>
                      {conv.unreadCount > 0 && <span style={{ background:'#e8b86d', color:'#08090f', fontSize:11, fontWeight:800, borderRadius:99, padding:'2px 7px' }}>{conv.unreadCount}</span>}
                    </div>
                  )
                })}
              </div>
            )}
            {/* Channel Discover */}
            {navTab === 'channels' && (
              <div style={{ flex:1, display:'flex', flexDirection:'column', minHeight:0 }}>
                <ChannelDiscoverPanel
                  onClose={() => setNavTab('home')}
                  onCreateChannel={() => setRightPanel('create-channel')}
                />
              </div>
            )}
            {/* Create Channel */}
            {rightPanel === 'create-channel' && (
              <div style={{ flex:1, display:'flex', flexDirection:'column', minHeight:0 }}>
                <CreateChannelPanel onClose={() => { setRightPanel('none'); setNavTab('home') }} />
              </div>
            )}
          </div>

          {/* ── Mobile Bottom Navigation ── */}
          {!activeConversationId && (
            <nav className='mobile-bottom-nav' style={{ flexShrink:0, background:'rgba(8,9,15,0.98)', borderTop:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'space-around', padding:'0 4px', paddingBottom:'env(safe-area-inset-bottom, 0px)', minHeight:56 }}>
              {[
                { id:'home',     label:'Start',    icon:<svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg> },
                { id:'chats',    label:'Chats',    icon:<svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
                { id:'channels', label:'Channels', icon:<svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.47 2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.57a16 16 0 0 0 6 6l.72-.94a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.27 16z"/></svg> },
                { id:'contacts', label:'Kontakte', icon:<svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
                { id:'settings', label:'Einst.',   icon:<svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> },
              ].map(item => {
                const isActive = navTab === item.id
                const hasBadge = item.id === 'chats' && conversations.some(c => c.unreadCount > 0)
                return (
                  <button key={item.id}
                    onClick={() => {
                      if (item.id === 'settings') { setShowSettings(true); return }
                      handleNavClick(item.id as NavTab)
                    }}
                    style={{ flex:1, height:52, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3, border:'none', background:'none', cursor:'pointer', color: isActive ? '#e8b86d' : 'rgba(255,255,255,0.4)', position:'relative', transition:'color .15s' }}>
                    {item.icon}
                    <span style={{ fontSize:9, fontWeight: isActive ? 700 : 500 }}>{item.label}</span>
                    {hasBadge && <span style={{ position:'absolute', top:8, right:'25%', width:7, height:7, borderRadius:'50%', background:'#e8b86d', border:'1.5px solid #08090f' }} />}
                    {isActive && <div style={{ position:'absolute', bottom:0, left:'50%', transform:'translateX(-50%)', width:20, height:2, borderRadius:1, background:'#e8b86d' }} />}
                  </button>
                )
              })}
            </nav>
          )}
        </div>
      )}

      {/* ══ DESKTOP LAYOUT ══ */}
      {!isMobile && (
      <div style={{ display:'flex', height:'100vh', overflow:'hidden', position:'relative', zIndex:1 }}>

        {/* ── ICON SIDEBAR (ganz links) ── */}
        <aside style={{ width:64, flexShrink:0, background:'rgba(8,9,15,0.95)', borderRight:'1px solid rgba(255,255,255,0.05)', display:'flex', flexDirection:'column', alignItems:'center', padding:'12px 0 16px', gap:4, zIndex:20 }}>
          {/* Logo */}
          <div style={{ width:38, height:38, borderRadius:12, background:'linear-gradient(135deg,#b46a0e,#e8b86d)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:12, flexShrink:0, boxShadow:'0 4px 16px rgba(180,106,14,0.3)' }}>
            <svg width="18" height="18" fill="none" stroke="white" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </div>

          {navItems.map(item => (
            <NavBtn key={item.id} icon={item.icon} label={item.label} active={navTab===item.id}
              onClick={() => handleNavClick(item.id)} title={item.label}
              badge={item.id==='chats' && conversations.some(c => c.unreadCount>0)}
            />
          ))}

          {/* Suche */}
          <NavBtn label="Suche" title="Suchen (Ctrl+K)" onClick={() => setShowSearch(true)}
            icon={<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>}
          />

          {/* Avatar unten — rechtsklick für Status, klick für Settings */}
          <div style={{ marginTop:'auto', position:'relative' }}>
            <div
              onClick={() => setShowSettings(true)}
              onContextMenu={e => { e.preventDefault(); setShowStatusPicker(s => !s) }}
              title="Einstellungen (Rechtsklick: Status)"
              style={{ width:38, height:38, borderRadius:'50%', background:'linear-gradient(135deg,#b46a0e,#e8b86d)', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, color:'#fff', cursor:'pointer', border:'2px solid rgba(232,184,109,0.25)', position:'relative' }}>
              {userAvatar ? <img src={userAvatar} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" /> : userInitial}
              {/* Status Dot */}
              <div style={{ position:'absolute', bottom:0, right:0, width:10, height:10, borderRadius:'50%', background: user?.status==='online' ? '#4ade80' : user?.status==='away' ? '#fbbf24' : 'rgba(255,255,255,0.3)', border:'2px solid #08090f' }} />
            </div>
            {/* Status Picker Popup */}
            {showStatusPicker && (
              <div style={{ position:'absolute', bottom:'110%', left:'110%', background:'#0d0f18', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:8, zIndex:9999, minWidth:160, boxShadow:'0 8px 32px rgba(0,0,0,0.5)' }}>
                <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.3)', letterSpacing:'.08em', textTransform:'uppercase', padding:'4px 8px 6px' }}>Status</div>
                {[
                  { status:'online', emoji:'🟢', label:'Online' },
                  { status:'away',   emoji:'🟡', label:'Abwesend' },
                  { status:'offline',emoji:'⚫', label:'Erscheinen als Offline' },
                ].map(s => (
                  <div key={s.status} onClick={() => { updateStatus(s.status as any); setShowStatusPicker(false) }}
                    style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 8px', borderRadius:8, cursor:'pointer', transition:'background .12s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.06)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='transparent'}>
                    <span style={{ fontSize:14 }}>{s.emoji}</span>
                    <span style={{ fontSize:12, color:'rgba(255,255,255,0.7)' }}>{s.label}</span>
                    {user?.status === s.status && <span style={{ marginLeft:'auto', color:'#e8b86d', fontSize:12 }}>✓</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* ── CHAT-LISTE (mittlere Sidebar) ── */}
        {/* ContactList — nicht zeigen wenn Channel aktiv */}
        {showChatPanel && !(activeConv as any)?.isChannel && (
          <div style={{ width:240, flexShrink:0, background:'rgba(255,255,255,0.02)', borderRight:'1px solid rgba(255,255,255,0.05)', display:'flex', flexDirection:'column', zIndex:10 }}>
            <VerificationBanner />
            <ContactList
              onOpenSettings={() => setShowSettings(true)}
              onOpenSearch={() => setShowSearch(true)}
              onOpenBookmarks={() => setShowBookmarks(true)}
              retroMode={false}
              onToggleRetro={() => {}}
              activeTab={navTab === 'contacts' ? 'contacts' : 'chats'}
              onTabChange={t => setNavTab(t)}
            />
          </div>
        )}

        {/* ── HAUPT-BEREICH + RECHTE SIDEBAR ── */}
        <main style={{ flex:1, display:'flex', overflow:'hidden', position:'relative' }}>

          {/* CHANNEL VIEW — nur wenn Channel aktiv UND kein anderer Panel offen */}
          {activeConversationId && (activeConv as any)?.isChannel && rightPanel === 'none' && navTab !== 'channels' && (
            <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
              <ChannelView
                channelId={activeConversationId}
                channel={activeConv}
              />
            </div>
          )}

          {/* CHAT VIEW — normaler Chat */}
          {activeConversationId && !(activeConv as any)?.isChannel && (
            <div className={`chat-main chat-bg-${chatBg} bubble-${bubbleStyle}`} style={{ flex:1, backgroundImage: chatBg==='custom'&&chatBgCustom ? `url(${chatBgCustom})` : undefined, backgroundSize:'cover' }}>
              <ChatWindow conversationId={activeConversationId} />
            </div>
          )}

          {/* HOME Dashboard — nur wenn kein Chat/Channel aktiv und kein Panel */}
          {!activeConversationId && navTab === 'home' && rightPanel === 'none' && (
            <Dashboard
              onNewChat={() => setNavTab('chats')}
              onCreateGroup={() => setShowGroupModal(true)}
              onCreateChannel={() => setRightPanel('create-channel')}
              onDiscover={() => { setNavTab('channels'); setRightPanel('discover') }}
            />
          )}

          {/* CHANNELS Discover */}
          {!activeConversationId && (navTab === 'channels' || rightPanel === 'discover') && rightPanel !== 'create-channel' && (
            <ChannelDiscoverPanel
              onClose={() => { setRightPanel('none'); setNavTab('home') }}
              onCreateChannel={() => setRightPanel('create-channel')}
            />
          )}

          {/* CREATE CHANNEL */}
          {rightPanel === 'create-channel' && (
            <CreateChannelPanel onClose={() => { setRightPanel('none'); setNavTab('home') }} />
          )}

          {/* LEER — kein Chat, kein Home, kein Channel-Panel */}
          {!activeConversationId && navTab !== 'home' && navTab !== 'channels' && rightPanel === 'none' && (
            <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'40px 32px', gap:0, overflowY:'auto' }}>
              {/* Leerer Chat State — nach Mockup */}
              <div style={{ marginBottom:32, textAlign:'center' }}>
                <div style={{ width:64, height:64, borderRadius:18, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
                  <svg width="28" height="28" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                </div>
                <p style={{ fontSize:16, fontWeight:600, color:'rgba(255,255,255,0.6)', marginBottom:6 }}>Wähle ein Gespräch aus</p>
                <p style={{ fontSize:12, color:'rgba(255,255,255,0.25)' }}>Ctrl+K zum Suchen</p>
              </div>
              {/* Tipps & Shortcuts */}
              <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:16, padding:'20px 24px', maxWidth:320, width:'100%' }}>
                <p style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.3)', letterSpacing:'.08em', textTransform:'uppercase', marginBottom:14 }}>Tipps & Shortcuts</p>
                {[
                  { key:'Strg + K', action:'Suche öffnen' },
                  { key:'Strg + N', action:'Neuer Chat' },
                  { key:'Strg + /',  action:'Shortcuts' },
                  { key:'Strg + B', action:'Fett' },
                ].map(({ key, action }) => (
                  <div key={key} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                    <span style={{ fontSize:12, color:'rgba(255,255,255,0.35)' }}>{action}</span>
                    <span style={{ fontSize:11, padding:'2px 8px', borderRadius:6, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.4)', fontFamily:'monospace' }}>{key}</span>
                  </div>
                ))}
                <button style={{ width:'100%', marginTop:14, padding:'9px', borderRadius:9, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.35)', cursor:'pointer', fontSize:12 }}>
                  Alle Shortcuts anzeigen
                </button>
              </div>
            </div>
          )}
          {/* Rechte Sidebar dauerhaft */}
          <RightSidebar
            onCreateChannel={() => setRightPanel('create-channel')}
            onCreateGroup={() => setShowGroupModal(true)}
            onDiscover={() => { setNavTab('channels'); setRightPanel('discover') }}
            onNotes={() => { setActiveConversation('__saved__'); setNavTab('chats') }}
          />
        </main>
      </div>

      )}

      {/* Overlays */}
      {profileUserId && <UserProfile userId={profileUserId} onClose={() => setProfileUserId(null)} />}
      {globalCall && <VideoCall conversationId={globalCall.conversationId} targetUserId={globalCall.targetId} targetUsername={globalCall.targetName} isIncoming={globalCall.isIncoming} incomingOffer={globalCall.offer} onClose={() => setGlobalCall(null)} />}
      {showSettings  && <Settings onClose={() => setShowSettings(false)} />}
      {showSearch    && <SearchPanel onClose={() => setShowSearch(false)} />}
      {showBookmarks && <BookmarksPanel onClose={() => setShowBookmarks(false)} />}
      {showGroupModal && <GroupModal contacts={[]} onClose={() => setShowGroupModal(false)} onCreated={() => { fetchConversations(); setShowGroupModal(false) }} />}
    </>
  )
}
