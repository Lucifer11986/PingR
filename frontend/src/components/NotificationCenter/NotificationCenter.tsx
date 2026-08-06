import { useState, useEffect, useRef } from 'react'
import { useChatStore } from '../../store/chatStore'
import api from '../../services/api'

interface Notification {
  _id:              string
  type:             'mention' | 'group_message' | 'direct_message'
  icon:             string
  title:            string
  preview:          string
  conversationId:   string
  conversationName: string
  avatar?:          string
  read:             boolean
  createdAt:        string
}

interface Props {
  onClose: () => void
}

export default function NotificationCenter({ onClose }: Props) {
  const setActive = useChatStore(s => s.setActiveConversation)
  const apiBase   = import.meta.env.VITE_API_URL || ''

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount,   setUnreadCount]   = useState(0)
  const [loading,       setLoading]       = useState(true)
  const [filter,        setFilter]        = useState<'all' | 'unread' | 'mentions'>('all')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadNotifications()
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const loadNotifications = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/api/notifications')
      setNotifications(data.notifications || [])
      setUnreadCount(data.unreadCount || 0)
    } catch (_e) {}
    setLoading(false)
  }

    const markAllRead = async () => {
    try {
      await api.post('/api/notifications/read-all')
      setNotifications([])
      setUnreadCount(0)
      await fetchConversations() // chatStore aktualisieren
    } catch {}
  }

  const fetchConversations = useChatStore(s => s.fetchConversations)

  const openConversation = async (n: Notification) => {
    setActive(n.conversationId)
    // Conversation als gelesen markieren
    try {
      await api.post(`/api/conversations/${n.conversationId}/read`)
    } catch {}
    setNotifications(prev => prev.filter(x => x.conversationId !== n.conversationId))
    setUnreadCount(prev => Math.max(0, prev - 1))
    onClose()
  }

  const formatTime = (d: string) => {
    const diff = Date.now() - new Date(d).getTime()
    if (diff < 60000)    return 'Gerade'
    if (diff < 3600000)  return `${Math.floor(diff/60000)}m`
    if (diff < 86400000) return `${Math.floor(diff/3600000)}h`
    return new Date(d).toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit' })
  }

  const TypeIcon = ({ type }: { type: string }) => {
    const icons: Record<string, JSX.Element> = {
      mention: (
        <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/></svg>
      ),
      group_message: (
        <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
      ),
      direct_message: (
        <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      ),
    }
    return icons[type] || icons.direct_message
  }

  const typeColor: Record<string, string> = {
    mention:        '#e8b86d',
    group_message:  '#60a5fa',
    direct_message: '#4ade80',
  }

  const filtered = notifications.filter(n => {
    if (filter === 'unread')   return !n.read
    if (filter === 'mentions') return n.type === 'mention'
    return true
  })

  return (
    <div ref={ref} style={{
      position: 'fixed', top: 60, left: 70, zIndex: 9998,
      width: 340, maxHeight: 520,
      background: '#0d0f18', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Benachrichtigungen</span>
            {unreadCount > 0 && (
              <span style={{ background: 'linear-gradient(135deg,#b46a0e,#e8b86d)', color: '#fff', fontSize: 10, fontWeight: 800, borderRadius: 99, padding: '1px 7px' }}>
                {unreadCount}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {unreadCount > 0 && (
              <button onClick={markAllRead} style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 6, transition: 'color .15s' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color='#e8b86d'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color='rgba(255,255,255,0.4)'}>
                Alle gelesen
              </button>
            )}
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
          </div>
        </div>
        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: 5 }}>
          {(['all', 'unread', 'mentions'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '4px 12px', borderRadius: 99, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, transition: 'all .15s',
              background: filter === f ? 'rgba(232,184,109,0.15)' : 'rgba(255,255,255,0.05)',
              color: filter === f ? '#e8b86d' : 'rgba(255,255,255,0.4)',
            }}>
              {f === 'all' ? 'Alle' : f === 'unread' ? 'Ungelesen' : 'Erwähnungen'}
            </button>
          ))}
        </div>
      </div>

      {/* Liste */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Lädt...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>
              <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" style={{ opacity: .4 }}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            </div>
            Keine Benachrichtigungen
          </div>
        ) : filtered.map(n => (
          <div key={n._id} onClick={() => openConversation(n)}
            style={{
              display: 'flex', gap: 12, padding: '12px 16px', cursor: 'pointer',
              background: n.read ? 'transparent' : 'rgba(232,184,109,0.04)',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
              transition: 'background .15s',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.04)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background=n.read?'transparent':'rgba(232,184,109,0.04)'}
          >
            {/* Avatar */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg,#1a4a6b,#0d9488)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff' }}>
                {n.avatar
                  ? <img src={`${apiBase}${n.avatar}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                  : (n.title?.[0] || '?').toUpperCase()}
              </div>
              {/* Type Badge */}
              <div style={{ position: 'absolute', bottom: -2, right: -2, width: 16, height: 16, borderRadius: '50%', background: '#0d0f18', display: 'flex', alignItems: 'center', justifyContent: 'center', color: typeColor[n.type], border: '1.5px solid #0d0f18' }}>
                <TypeIcon type={n.type} />
              </div>
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
                <span style={{ fontSize: 13, fontWeight: n.read ? 500 : 700, color: n.read ? 'rgba(255,255,255,0.7)' : '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{n.title}</span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>{formatTime(n.createdAt)}</span>
              </div>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{n.preview}</p>
            </div>

            {/* Unread dot */}
            {!n.read && (
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#e8b86d', flexShrink: 0, alignSelf: 'center' }} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}