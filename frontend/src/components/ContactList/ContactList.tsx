import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { useAuthStore } from '../../store/authStore'
import { useI18n } from '../../hooks/useI18n'
import { useContactStore } from '../../store/contactStore'
import { useChatStore } from '../../store/chatStore'
import IdentitySwitcher from '../IdentitySwitcher/IdentitySwitcher'
import { useContacts } from '../../hooks/useContacts'
import { formatDistanceToNow } from 'date-fns'
import { de } from 'date-fns/locale'
import GroupModal from '../GroupModal/GroupModal'
import UserProfile from '../UserProfile/UserProfile'
import StatusBar from '../Status/StatusBar'
import CreateChannelModal from '../CreateChannel/CreateChannelModal'

interface Props {
  onOpenSettings:  () => void
  onOpenSearch:    () => void
  onOpenBookmarks: () => void
  retroMode:       boolean
  onToggleRetro:   () => void
  activeTab?:      'chats' | 'contacts'
  onTabChange?:    (t: 'chats' | 'contacts') => void
}

/* ─── Avatar Helper ─────────────────────────────────────────────── */
function Avatar({ src, name, size = 36, radius = '50%', color = 'linear-gradient(135deg,#b46a0e,#e8b86d)' }: {
  src?: string | null, name: string, size?: number, radius?: string, color?: string
}) {
  return (
    <div style={{
      width: size, height: size, borderRadius: radius,
      background: color, overflow: 'hidden', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 700, color: '#fff',
    }}>
      {src
        ? <img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
        : (name?.[0] ?? '?').toUpperCase()
      }
    </div>
  )
}

/* ─── Status Dot ────────────────────────────────────────────────── */
function StatusDot({ status }: { status?: string }) {
  const color = status === 'online' ? '#4ade80' : status === 'away' ? '#fbbf24' : 'rgba(255,255,255,0.2)'
  return (
    <span style={{
      position: 'absolute', bottom: 1, right: 1,
      width: 10, height: 10, borderRadius: '50%',
      background: color, border: '2px solid #08090f',
    }} />
  )
}

export default function ContactList({ onOpenSettings, onOpenSearch, onOpenBookmarks, retroMode, onToggleRetro, activeTab, onTabChange }: Props) {
  const user     = useAuthStore(s => s.user)
  const logout   = useAuthStore(s => s.logout)
  const navigate = useNavigate()
  const { tr }         = useI18n()
  const { contacts }   = useContacts()
  const addContact     = useContactStore(s => s.addContact)
  const { conversations, activeConversationId, setActiveConversation, deleteConversation,
          createConversation, fetchConversations } = useChatStore()

  const [addInput, setAddInput] = useState('')
  const [addError, setAddError] = useState('')
  const [showAdd,  setShowAdd]  = useState(false)
  const tab    = activeTab  ?? 'chats'
  const setTab = onTabChange ?? ((_t: 'chats'|'contacts') => {})
  const [showGroupModal,    setShowGroupModal]    = useState(false)
  const [showCreateChannel, setShowCreateChannel] = useState(false)
  const [contactMenu,   setContactMenu]   = useState<{ userId: string; name: string; x: number; y: number } | null>(null)
  const [editingChannel, setEditingChannel] = useState<any>(null)
  const [editName,       setEditName]       = useState('')
  const [editDesc,       setEditDesc]       = useState('')
  const [editIsAdult,    setEditIsAdult]    = useState(false)
  const [editIsPublic,   setEditIsPublic]   = useState(true)
  const [editSaving,     setEditSaving]     = useState(false)
  const [profileUserId,  setProfileUserId]  = useState<string | null>(null)
  const [hoveredConvId,  setHoveredConvId]  = useState<string | null>(null)
  const [filterPill,     setFilterPill]     = useState<'all'|'unread'|'groups'|'channels'>('all')

  const handleLogout = () => { logout(); navigate('/login') }

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault(); setAddError('')
    try { await addContact(addInput.trim()); setAddInput(''); setShowAdd(false) }
    catch (_err) { setAddError('UIN nicht gefunden.') }
  }

  const goToChat = async (userId: string) => {
    const convId = await createConversation(userId)
    setActiveConversation(convId)
    setTab('chats')
    setContactMenu(null)
  }

  const showProfile = (userId: string) => {
    setProfileUserId(userId)
    setContactMenu(null)
  }

  const apiBase     = import.meta.env.VITE_API_URL || ''
  const directConvs  = (conversations ?? []).filter(c => !c.isGroup && !(c as any).isChannel)
  const groupConvs   = (conversations ?? []).filter(c => c.isGroup && !(c as any).isChannel)
  const channelConvs = (conversations ?? []).filter(c => (c as any).isChannel)

  // Phase 3: Dynamische Zeit-Anzeige
  const formatLastSeen = (lastSeen?: string | Date): string => {
    if (!lastSeen) return 'Zuletzt gesehen: unbekannt'
    const diff = Date.now() - new Date(lastSeen).getTime()
    const min  = Math.floor(diff / 60000)
    const h    = Math.floor(diff / 3600000)
    const d    = Math.floor(diff / 86400000)
    if (min < 2)  return 'Gerade eben aktiv'
    if (min < 60) return `Zuletzt aktiv vor ${min} Min`
    if (h < 24)   return `Zuletzt aktiv vor ${h} Std`
    if (d === 1)  return 'Gestern aktiv'
    return `Zuletzt aktiv vor ${d} Tagen`
  }

  const S = {
    convItem: (isActive: boolean): React.CSSProperties => ({
      position: 'relative', display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 12px 9px 14px', cursor: 'pointer', transition: 'all .18s',
      background: isActive ? 'rgba(232,184,109,0.07)' : 'transparent',
      borderRadius: 12, margin: '0 6px 3px',
      border: isActive ? '1px solid rgba(232,184,109,0.16)' : '1px solid transparent',
      borderLeft: isActive ? '3px solid #e8b86d' : '3px solid transparent',
      boxShadow: isActive ? '0 1px 8px rgba(180,106,14,0.08)' : 'none',
    }),
    activeLine: {
      position: 'absolute' as const, left: 0, top: 6, bottom: 6,
      width: 3, background: 'linear-gradient(180deg,#b46a0e,#e8b86d)',
      borderRadius: '0 3px 3px 0',
    },
    convName: { fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.85)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
    convLast: { fontSize: 11, color: 'rgba(255,255,255,0.3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, marginTop: 1 },
    convTime: { fontSize: 10, color: 'rgba(255,255,255,0.22)', flexShrink: 0 },
    badge: { background: '#e8b86d', color: '#08090f', fontSize: 10, fontWeight: 800, borderRadius: 99, padding: '1px 6px', minWidth: 18, textAlign: 'center' as const },
    sectionLabel: { fontSize: '9.5px', fontWeight: 700, color: 'rgba(255,255,255,0.22)', letterSpacing: '1.2px', textTransform: 'uppercase' as const, padding: '10px 14px 5px' },
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Header ── */}
      <div style={{ padding:'12px 14px 10px', borderBottom:'1px solid rgba(255,255,255,0.06)', flexShrink:0 }}>
        <IdentitySwitcher />
        <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:8 }}>
          <div style={{ position:'relative', cursor:'pointer', flexShrink:0 }} onClick={() => onOpenSettings()}>
            <Avatar src={user?.avatar ? `${apiBase}${user.avatar}` : null} name={user?.username ?? '?'} size={38} color="linear-gradient(135deg,#b46a0e,#e8b86d)" />
            <StatusDot status="online" />
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user?.username}</div>
            <div style={{ fontSize:10, color:'rgba(255,255,255,0.3)', fontFamily:'monospace' }}>#{user?.uin}</div>
          </div>
          <div style={{ display:'flex', gap:2 }}>
            <button onClick={onOpenBookmarks} title="Gespeicherte Nachrichten"
              style={{ width:30, height:30, border:'none', background:'rgba(255,255,255,0.04)', borderRadius:8, color:'rgba(255,255,255,0.45)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
            </button>
            {/* Neuer Chat Button */}
            <button onClick={() => {}} title="Neuer Chat"
              style={{ width:30, height:30, border:'none', background:'rgba(255,255,255,0.04)', borderRadius:8, color:'rgba(255,255,255,0.45)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            {/* Abmelden Button */}
            <button onClick={handleLogout} title="Abmelden"
              style={{ width:30, height:30, border:'none', background:'rgba(255,255,255,0.04)', borderRadius:8, color:'rgba(255,255,255,0.35)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </button>
          </div>
        </div>
      </div>

      {/* ── Suchfeld + Filter Pills ── */}
      <div style={{ padding:'8px 12px 0', flexShrink:0 }}>
        <div onClick={onOpenSearch} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:10, padding:'8px 12px', display:'flex', alignItems:'center', gap:8, cursor:'pointer', marginBottom:8 }}>
          <svg width="13" height="13" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <span style={{ fontSize:12, color:'rgba(255,255,255,0.25)' }}>Chats durchsuchen...</span>
        </div>
        {/* Status Bar */}
        <StatusBar />

        {/* Filter Pills */}
        <div style={{ display:'flex', gap:4, paddingBottom:8 }}>
          {([
            { id:'all',      label:'Alle' },
            { id:'unread',   label:'Ungelesen' },
            { id:'groups',   label:'Gruppen' },
            { id:'channels', label:'Channels' },
          ] as const).map(pill => (
            <button key={pill.id} onClick={() => setFilterPill(pill.id as any)}
              style={{ flex:1, padding:'4px 0', borderRadius:99, border:'none', cursor:'pointer', fontSize:10, fontWeight:600, transition:'all .15s', whiteSpace:'nowrap',
                background: filterPill===pill.id ? 'rgba(232,184,109,0.15)' : 'rgba(255,255,255,0.05)',
                color:      filterPill===pill.id ? '#e8b86d' : 'rgba(255,255,255,0.4)',
              }}>{pill.label}</button>
          ))}
        </div>
      </div>

      {/* ── Scroll-Bereich ── */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>

        {/* CHATS TAB */}
        {tab === 'chats' && (
          <>
            {/* Filter-Logik */}
            {/* ── Favoriten (ungelesene Chats zuerst) ── */}
            {conversations.filter(c => (c.unreadCount||0) > 0 && !c.isGroup && !(c as any).isChannel).length > 0 && (
              <div>
                <p style={S.sectionLabel}>Angeheftet</p>
                {conversations
                  .filter(c => (c.unreadCount||0) > 0 && !c.isGroup && !(c as any).isChannel)
                  .slice(0, 3)
                  .map(conv => {
                    const other = conv.participants?.find((p: any) => p._id !== user?._id)
                    const isActive = conv._id === activeConversationId
                    return (
                      <div key={`fav-${conv._id}`} style={{
                        ...S.convItem(isActive),
                        borderLeft: '3px solid #e8b86d',
                        marginLeft: 6,
                      }}
                        onClick={() => setActiveConversation(conv._id)}
                        onMouseEnter={() => setHoveredConvId(conv._id)}
                        onMouseLeave={() => setHoveredConvId(null)}>
                        {isActive && <div style={S.activeLine} />}
                        <div style={{ position:'relative', flexShrink:0 }}>
                          <Avatar src={other?.avatar ? `${apiBase}${other.avatar}` : null} name={other?.username ?? '?'} color="linear-gradient(135deg,#1a4a6b,#0d9488)" />
                          <StatusDot status={other?.status} />
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:4 }}>
                            <span style={{ ...S.convName, fontWeight:700 }}>{other?.username}</span>
                          </div>
                          <p style={{ ...S.convLast, color:'rgba(255,255,255,0.5)' }}>{conv.lastMessage?.content || '…'}</p>
                        </div>
                        <span style={S.badge}>{conv.unreadCount}</span>
                      </div>
                    )
                  })}
              </div>
            )}

            {/* ── Gespeicherte Nachrichten ── */}
            <div>
              <p style={S.sectionLabel}>Notizen</p>
              <div
                style={{ ...S.convItem(activeConversationId === '__saved__'), margin: '0 5px 6px', cursor: 'pointer' }}
                onClick={() => setActiveConversation('__saved__')}
                onMouseEnter={() => setHoveredConvId('__saved__')}
                onMouseLeave={() => setHoveredConvId(null)}
              >
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#4a1a6b,#b46a0e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🔖</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={S.convName}>Gespeicherte Nachrichten</span>
                  <p style={S.convLast}>Notizen, Links, Entwürfe</p>
                </div>
              </div>
            </div>
            {directConvs.filter(conv => {
              if (filterPill === 'unread') return (conv.unreadCount||0) > 0
              if (filterPill === 'groups') return false
              if (filterPill === 'channels') return false
              return true
            }).length > 0 && filterPill !== 'groups' && filterPill !== 'channels' && (
              <div>
                <p style={S.sectionLabel}>Direktnachrichten</p>
                {directConvs.filter(conv => filterPill !== 'unread' || (conv.unreadCount||0) > 0).map(conv => {
                  const other    = conv.participants.find((p: any) => p._id !== user?._id)
                  const isActive = conv._id === activeConversationId
                  return (
                    <div key={conv._id} style={S.convItem(isActive)}
                      onClick={() => setActiveConversation(conv._id)}
                      onMouseEnter={() => setHoveredConvId(conv._id)}
                      onMouseLeave={() => setHoveredConvId(null)}>
                      {isActive && <div style={S.activeLine} />}
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <Avatar
                          src={other?.avatar ? `${apiBase}${other.avatar}` : null}
                          name={other?.username ?? '?'}
                          color="linear-gradient(135deg,#1a4a6b,#0d9488)"
                        />
                        <StatusDot status={other?.status} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 4 }}>
                          <span style={S.convName}>{other?.username}</span>
                          {conv.lastMessage && (
                            <span style={S.convTime}>
                              {formatDistanceToNow(new Date(conv.lastMessage.createdAt), { locale: de, addSuffix: false })}
                            </span>
                          )}
                        </div>
                        <p style={S.convLast}>
                          {conv.lastMessage?.type === 'voice' ? '🎤 Sprachnachricht' : conv.lastMessage?.content || '…'}
                        </p>
                      </div>
                      {conv.unreadCount > 0 && (
                        <span style={S.badge}>{conv.unreadCount}</span>
                      )}
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          if (confirm('Chat löschen? Alle Nachrichten werden entfernt.')) {
                            deleteConversation(conv._id).catch((err: any) => alert(err.message))
                          }
                        }}
                        style={{
                          opacity: hoveredConvId === conv._id ? 1 : 0,
                          marginLeft: 2, width: 28, height: 28,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          borderRadius: 7, border: 'none', cursor: 'pointer',
                          fontSize: 13, flexShrink: 0, transition: 'opacity .15s, background .15s',
                          background: hoveredConvId === conv._id ? 'rgba(239,68,68,0.1)' : 'none',
                          color: '#f87171',
                        }}
                        title="Chat löschen">
                        🗑️
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {groupConvs.filter(conv => {
              if (filterPill === 'unread') return (conv.unreadCount||0) > 0
              if (filterPill === 'channels') return false
              return true
            }).length > 0 && filterPill !== 'channels' && (
              <div>
                <p style={S.sectionLabel}>Gruppen</p>
                {groupConvs.filter(conv => filterPill !== 'unread' || (conv.unreadCount||0) > 0).map(conv => {
                  const isActive = conv._id === activeConversationId
                  return (
                    <div key={conv._id} style={S.convItem(isActive)}
                      onClick={() => setActiveConversation(conv._id)}
                      onMouseEnter={() => setHoveredConvId(conv._id)}
                      onMouseLeave={() => setHoveredConvId(null)}>
                      {isActive && <div style={S.activeLine} />}
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <Avatar
                          src={(conv as any).groupAvatar ? `${apiBase}${(conv as any).groupAvatar}` : null}
                          name={conv.groupName ?? 'G'}
                          radius="11px"
                          color="linear-gradient(135deg,#4a1a6b,#b46a0e)"
                        />
                        {conv.isPublic && <span style={{ position: 'absolute', top: -4, right: -4, fontSize: 10 }}>🌐</span>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={S.convName}>{conv.groupName}</p>
                        <p style={S.convLast}>
                        {conv.lastMessage
                          ? <>{conv.lastMessage.sender?.username ? <span style={{ color:'rgba(255,255,255,0.5)' }}>{conv.lastMessage.sender.username}: </span> : null}{conv.lastMessage.content || '📎'}</>
                          : `${conv.participants.length} ${tr('members')}`}
                      </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {conversations.length === 0 && (
              <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13, textAlign: 'center', marginTop: 32, padding: '0 16px' }}>
                Noch keine Gespräche.<br />
                <span style={{ fontSize: 11 }}>Kontakt hinzufügen oder Gruppe erstellen.</span>
              </p>
            )}

            {/* Channel erstellen wenn noch keine vorhanden */}
            {channelConvs.length === 0 && (
              <div style={{ padding: '4px 10px 8px' }}>
                <button onClick={() => setShowCreateChannel(true)}
                  style={{ width:'100%', padding:'8px 12px', borderRadius:10, border:'1px dashed rgba(59,130,246,0.2)', background:'rgba(59,130,246,0.03)', color:'rgba(255,255,255,0.25)', cursor:'pointer', fontSize:12, textAlign:'left' as const }}>
                  📢 Channel erstellen
                </button>
              </div>
            )}
          

            {/* ── CHANNELS ── */}
            {channelConvs.filter(conv => {
              if (filterPill === 'unread') return (conv.unreadCount||0) > 0
              if (filterPill === 'groups') return false
              return true
            }).length > 0 && filterPill !== 'groups' && (
              <div>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px 5px' }}>
                  <p style={{ ...S.sectionLabel, padding:0 }}>CHANNELS</p>
                  <button onClick={() => setShowCreateChannel(true)} title="Channel erstellen"
                    style={{ background:'none', border:'none', color:'rgba(255,255,255,0.3)', cursor:'pointer', fontSize:18, lineHeight:1, padding:'0 4px' }}>+</button>
                </div>
                {channelConvs.map(conv => {
                  const isActive = activeConversationId === conv._id
                  const unread   = conv.unreadCount || 0
                  const isHov    = hoveredConvId === conv._id
                  return (
                    <div key={conv._id}
                      style={{ ...S.convItem(isActive), background: isHov && !isActive ? 'rgba(255,255,255,0.03)' : undefined }}
                      onClick={() => setActiveConversation(conv._id)}
                      onMouseEnter={() => setHoveredConvId(conv._id)}
                      onMouseLeave={() => setHoveredConvId(null)}
                    >
                      <div style={{ position:'relative', flexShrink:0 }}>
                        <div style={{ width:38, height:38, borderRadius:10, background:'linear-gradient(135deg,#1e40af,#7c3aed)', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>
                          {(conv as any).groupAvatar
                            ? <img src={`${apiBase}${(conv as any).groupAvatar}`} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" />
                            : '📢'}
                        </div>
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:2 }}>
                          <span style={{ fontSize:13, fontWeight: unread > 0 ? 700 : 500, color: unread > 0 ? '#fff' : 'rgba(255,255,255,0.85)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>
                            {conv.groupName}
                          </span>
                          {(conv as any).verified && <span style={{ fontSize:11, color:'#60a5fa', fontWeight:700 }}>✓</span>}
                        </div>
                        {(conv as any).channelHandle && (
                          <p style={{ fontSize:10, color:'rgba(255,255,255,0.3)', marginBottom:1 }}>@{(conv as any).channelHandle}</p>
                        )}
                        <p style={{ ...S.convLast }}>
                          {conv.lastMessage ? (conv.lastMessage.content || '📎') : `${(conv as any).subscribers?.length || 0} Abonnenten`}
                        </p>
                      </div>
                      {unread > 0 && <span style={S.badge}>{unread}</span>}
                      {/* Edit Button — nur für Owner/Admin beim Hover */}
                      {hoveredConvId === conv._id && (
                        (conv as any).owner === user?._id ||
                        ((conv as any).admins || []).includes(user?._id)
                      ) && (
                        <button onClick={e => {
                          e.stopPropagation()
                          setEditingChannel(conv)
                          setEditName((conv as any).groupName || '')
                          setEditDesc((conv as any).description || '')
                          setEditIsAdult(!!(conv as any).isAdult)
                          setEditIsPublic((conv as any).isPublic !== false)
                        }} style={{ width:22, height:22, borderRadius:5, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.5)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                          <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

          </>
        )}

        {/* CONTACTS TAB */}
        {tab === 'contacts' && (
          <div style={{ padding: 8 }}>
            {contacts.map((c: any) => (
              <div key={c._id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 11, transition: 'background .15s', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <div style={{ position: 'relative', flexShrink: 0 }} onClick={() => showProfile(c.user._id)}>
                  <Avatar
                    src={c.user.avatar ? `${apiBase}${c.user.avatar}` : null}
                    name={c.user.username}
                    color="linear-gradient(135deg,#1a4a6b,#0d9488)"
                  />
                  <StatusDot status={c.user.status} />
                </div>
                <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => showProfile(c.user._id)}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.85)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.nickname || c.user.username}
                  </p>
                  <p style={{ fontSize: 11, color: '#e8b86d', fontFamily: 'monospace', opacity: 0.6 }}>#{c.user.uin}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <button onClick={() => showProfile(c.user._id)} title="Profil"
                    style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 12 }}>
                    👤
                  </button>
                  <button onClick={async () => { const id = await createConversation(c.user._id); setActiveConversation(id); setTab('chats') }}
                    title="Nachricht"
                    style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 12 }}>
                    💬
                  </button>
                  <button onClick={async () => {
                    if (!confirm(`Kontakt ${c.user.username} entfernen?`)) return
                    try {
                      await api.delete(`/api/contacts/${c._id}`)
                      window.dispatchEvent(new Event('contacts_changed'))
                    } catch (_e) {}
                  }} title="Entfernen"
                    style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 12 }}>
                    🗑️
                  </button>
                </div>
              </div>
            ))}
            {contacts.length === 0 && (
              <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13, textAlign: 'center', marginTop: 24 }}>Noch keine Kontakte</p>
            )}
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div style={{ padding:'10px 12px', borderTop:'1px solid rgba(255,255,255,0.06)', flexShrink:0 }}>
        {showAdd ? (
          <form onSubmit={handleAddContact} style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <input autoFocus type="number" value={addInput} onChange={e => setAddInput(e.target.value)}
              placeholder="UIN eingeben…"
              style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:10, padding:'9px 12px', fontSize:13, color:'white', outline:'none', fontFamily:'monospace' }} />
            {addError && <p style={{ color:'#f87171', fontSize:11 }}>{addError}</p>}
            <div style={{ display:'flex', gap:8 }}>
              <button type="submit" style={{ flex:1, padding:'9px', background:'linear-gradient(135deg,#b46a0e,#e8b86d)', border:'none', borderRadius:10, color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>Hinzufügen</button>
              <button type="button" onClick={() => { setShowAdd(false); setAddError('') }}
                style={{ padding:'9px 14px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:10, color:'rgba(255,255,255,0.5)', fontSize:13, cursor:'pointer' }}>✕</button>
            </div>
          </form>
        ) : (
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => setShowAdd(true)}
              style={{ flex:1, padding:'10px 8px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:10, color:'rgba(255,255,255,0.55)', fontSize:12, cursor:'pointer', fontWeight:500 }}>
              + Kontakt
            </button>
            <button onClick={() => setShowGroupModal(true)}
              style={{ flex:1, padding:'10px 8px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:10, color:'rgba(255,255,255,0.55)', fontSize:12, cursor:'pointer', fontWeight:500 }}>
              👥 Gruppe
            </button>
          </div>
        )}
      </div>

      {/* ── Kontext-Menü ── */}
      {contactMenu && (
        <div style={{ position: 'fixed', zIndex: 50, left: contactMenu.x, top: contactMenu.y }}
          onMouseLeave={() => setContactMenu(null)}>
          <div style={{ background: '#13131f', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.5)', padding: '4px 0', minWidth: 160 }}>
            <button onClick={() => showProfile(contactMenu.userId)}
              style={{ width: '100%', padding: '10px 16px', fontSize: 13, textAlign: 'left', background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              👤 Profil anzeigen
            </button>
            <button onClick={() => goToChat(contactMenu.userId)}
              style={{ width: '100%', padding: '10px 16px', fontSize: 13, textAlign: 'left', background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              💬 Nachricht schreiben
            </button>
          </div>
        </div>
      )}

      {showGroupModal && (
        <GroupModal contacts={contacts} onClose={() => setShowGroupModal(false)}
          onCreated={() => { fetchConversations(); setShowGroupModal(false) }} />
      )}

      {profileUserId && (
        <UserProfile userId={profileUserId} onClose={() => setProfileUserId(null)} />
      )}

      {showCreateChannel && (
        <CreateChannelModal
          onClose={() => setShowCreateChannel(false)}
          onCreate={() => { fetchConversations(); setShowCreateChannel(false) }}
        />
      )}

      {/* ── Channel Bearbeiten Modal ── */}
      {editingChannel && (
        <div onClick={() => setEditingChannel(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', backdropFilter:'blur(8px)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background:'#0d0f18', border:'1px solid rgba(255,255,255,0.08)', borderRadius:20, padding:24, maxWidth:440, width:'100%', boxShadow:'0 24px 60px rgba(0,0,0,0.7)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h2 style={{ fontSize:17, fontWeight:800, color:'#fff' }}>Channel bearbeiten</h2>
              <button onClick={() => setEditingChannel(null)} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer', fontSize:22 }}>x</button>
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:600, color:'rgba(255,255,255,0.4)', marginBottom:5, textTransform:'uppercase' as const, letterSpacing:'0.05em' }}>Name</label>
              <input value={editName} onChange={e => setEditName(e.target.value)} style={{ width:'100%', padding:'9px 13px', borderRadius:9, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'#fff', fontSize:13, outline:'none', boxSizing:'border-box' as const }} />
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:600, color:'rgba(255,255,255,0.4)', marginBottom:5, textTransform:'uppercase' as const, letterSpacing:'0.05em' }}>Beschreibung</label>
              <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={3} maxLength={300} style={{ width:'100%', padding:'9px 13px', borderRadius:9, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'#fff', fontSize:13, outline:'none', resize:'none' as const, boxSizing:'border-box' as const }} />
            </div>
            <div style={{ display:'flex', gap:8, marginBottom:14 }}>
              {[{v:true,l:'Oeffentlich'},{v:false,l:'Privat'}].map(opt => (
                <button key={String(opt.v)} onClick={() => setEditIsPublic(opt.v)} style={{ flex:1, padding:'9px', borderRadius:9, cursor:'pointer', background: editIsPublic===opt.v ? 'rgba(30,64,175,0.15)' : 'rgba(255,255,255,0.04)', border:`1px solid ${editIsPublic===opt.v ? 'rgba(30,64,175,0.4)' : 'rgba(255,255,255,0.08)'}`, color: editIsPublic===opt.v ? '#93c5fd' : 'rgba(255,255,255,0.5)', fontSize:12, fontWeight:600 }}>{opt.l}</button>
              ))}
            </div>
            <label style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:10, cursor:'pointer', background: editIsAdult ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)', border:`1px solid ${editIsAdult ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.07)'}`, marginBottom:20, transition:'all .15s' }}>
              <input type="checkbox" checked={editIsAdult} onChange={e => setEditIsAdult(e.target.checked)} style={{ width:16, height:16, accentColor:'#ef4444', cursor:'pointer' }} />
              <div>
                <div style={{ fontSize:13, fontWeight:700, color: editIsAdult ? '#f87171' : 'rgba(255,255,255,0.8)' }}>FSK18 / Nur fuer Erwachsene</div>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.35)', marginTop:2 }}>Channel wird mit 18+ Badge markiert</div>
              </div>
            </label>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setEditingChannel(null)} style={{ flex:1, padding:'10px', borderRadius:9, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.6)', cursor:'pointer' }}>Abbrechen</button>
              <button disabled={editSaving || !editName.trim()} onClick={async () => {
                setEditSaving(true)
                try {
                  await api.patch('/api/channels/' + editingChannel._id, { name: editName.trim(), description: editDesc.trim(), isPublic: editIsPublic, isAdult: editIsAdult })
                  fetchConversations()
                  setEditingChannel(null)
                } catch {}
                setEditSaving(false)
              }} style={{ flex:2, padding:'10px', borderRadius:9, border:'none', background: editName.trim() ? 'linear-gradient(135deg,#1e40af,#7c3aed)' : 'rgba(255,255,255,0.06)', color: editName.trim() ? '#fff' : 'rgba(255,255,255,0.3)', cursor: editName.trim() ? 'pointer' : 'not-allowed', fontWeight:700, opacity: editSaving ? 0.7 : 1 }}>
                {editSaving ? 'Speichert...' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}