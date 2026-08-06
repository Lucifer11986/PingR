import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useChatStore } from '../../store/chatStore'
import api from '../../services/api'
import type { Contact } from '../../types'

interface Props {
  contacts:  Contact[]
  onClose:   () => void
  onCreated: () => void
}

type View = 'create' | 'join' | 'browse'

function GroupCard({ conv, apiBase, onJoin }: { conv: any; apiBase: string; onJoin: (c: any) => void }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/8 transition-colors">
      <div className="w-10 h-10 rounded-full bg-teal-700 overflow-hidden flex items-center justify-center font-bold flex-shrink-0">
        {conv.groupAvatar
          ? <img src={`${apiBase}${conv.groupAvatar}`} className="w-full h-full object-cover" alt="" />
          : (conv.groupName || 'G')[0].toUpperCase()
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold truncate">{conv.groupName}</p>
        <p className="text-xs text-white/40">
          👥 {conv.participants?.length || 0} Mitglieder
        </p>
      </div>
      <button onClick={() => onJoin(conv)}
        style={{ fontSize:11, padding:"4px 12px", background:"linear-gradient(135deg,#b46a0e,#e8b86d)", border:"none", borderRadius:8, color:"#fff", fontWeight:600, cursor:"pointer", flexShrink:0 }}
        aria-label={`${conv.groupName} beitreten`}>
        Beitreten
      </button>
    </div>
  )
}


export default function GroupModal({ contacts, onClose, onCreated }: Props) {
  const { setActiveConversation } = useChatStore()
  const [view, setView]         = useState<View>('create')

  // Erstellen
  const [groupName, setGroupName]       = useState('')
  const [selected, setSelected]         = useState<string[]>([])
  const [isPublic, setIsPublic]         = useState(false)
  const [creating, setCreating]         = useState(false)
  const [createError, setCreateError]   = useState('')
  const [joinLink, setJoinLink]         = useState('')

  // Beitreten
  const [joinCode, setJoinCode]         = useState('')
  const [joining, setJoining]           = useState(false)
  const [joinError, setJoinError]       = useState('')

  // Suchen
  const [searchQ, setSearchQ]           = useState('')
  const apiBase = import.meta.env.VITE_API_URL || ''
  const [searchResults,  setSearchResults]  = useState<any[]>([])
  const [popularGroups,  setPopularGroups]  = useState<any[]>([])
  const [loadingPopular, setLoadingPopular] = useState(false)
  const [searching, setSearching]       = useState(false)

  const toggleMember = (id: string) => {
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!groupName.trim()) { setCreateError('Gruppenname erforderlich'); return }
    setCreating(true)
    setCreateError('')
    try {
      const { data } = await api.post('/api/conversations/group', {
        groupName: groupName.trim(),
        participantIds: selected,
        isPublic,
      })
      setActiveConversation(data._id)
      if (isPublic && data.joinCode) {
        setJoinLink(`${window.location.origin}/join/${data.joinCode}`)
      } else {
        onCreated()
      }
    } catch (_err) {
      setCreateError('Fehler beim Erstellen.')
    } finally {
      setCreating(false)
    }
  }

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    setJoining(true)
    setJoinError('')
    try {
      const code = joinCode.trim().split('/').pop() || joinCode.trim()
      const { data } = await api.get(`/api/conversations/join/${code}`)
      setActiveConversation(data._id)
      onCreated()
    } catch (_err) {
      setJoinError('Code ungültig oder Gruppe nicht gefunden.')
    } finally {
      setJoining(false)
    }
  }


  // Beliebte Gruppen laden wenn Browse-Tab geöffnet wird
  useEffect(() => {
    if (view !== 'browse') return
    setLoadingPopular(true)
    api.get('/api/conversations/public?popular=true')
      .then(r => setPopularGroups(r.data || []))
      .catch(() => {})
      .finally(() => setLoadingPopular(false))
  }, [view])

  const handleSearch = async () => {
    if (!searchQ.trim()) return
    setSearching(true)
    try {
      const { data } = await api.get(`/api/conversations/public?q=${encodeURIComponent(searchQ)}`)
      setSearchResults(data)
    } catch (_err) { /* ignore */ }
    finally { setSearching(false) }
  }

  const handleJoinGroup = async (conv: any) => {
    try {
      const { data } = await api.get(`/api/conversations/join/${conv.joinCode}`)
      setActiveConversation(data._id)
      onCreated()
    } catch (_err) { /* ignore */ }
  }

  return createPortal(
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:"16px" }}>
      <div style={{ background:"#0d0f18", border:"1px solid rgba(255,255,255,0.08)", borderRadius:"20px", width:"100%", maxWidth:"520px", boxShadow:"0 25px 60px rgba(0,0,0,0.7)", backdropFilter:"blur(24px)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-bold">👥 Gruppen</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white text-xl leading-none">✕</button>
        </div>

        {/* Sub-Tabs */}
        <div className="flex border-b border-white/10">
          {([
            { id: 'create', label: '+ Erstellen' },
            { id: 'join',   label: '🔗 Beitreten' },
            { id: 'browse', label: '🔍 Entdecken' },
          ] as { id: View; label: string }[]).map(t => (
            <button key={t.id} onClick={() => setView(t.id)}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                view === t.id ? 'text-amber-active border-b-2 border-amber-400' : 'text-white/40 hover:text-white/70'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-5 max-h-[70vh] overflow-y-auto">

          {/* ── Gruppe erstellen ── */}
          {view === 'create' && !joinLink && (
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-white/70 text-sm mb-1">Gruppenname *</label>
                <input value={groupName} onChange={e => setGroupName(e.target.value)}
                  style={{ width:"100%", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, padding:"9px 13px", fontSize:13, color:"white", outline:"none", boxSizing:"border-box" }} placeholder="z.B. Freunde, Team XY…"
                  maxLength={50} required autoFocus />
              </div>

              {/* Mitglieder wählen */}
              {contacts.length > 0 && (
                <div>
                  <label className="block text-white/70 text-sm mb-2">
                    Mitglieder hinzufügen
                    {selected.length > 0 && (
                      <span className="ml-2 text-xs text-amber-400">{selected.length} ausgewählt</span>
                    )}
                  </label>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {contacts.map(c => (
                      <label key={c._id}
                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                          selected.includes(c.user._id)
                            ? 'bg-amber-600/20 border border-amber-500/30'
                            : 'hover:bg-white/5 border border-transparent'
                        }`}>
                        <input type="checkbox" checked={selected.includes(c.user._id)}
                          onChange={() => toggleMember(c.user._id)}
                          className="accent-amber" />
                        <div className="w-7 h-7 rounded-full bg-pingr-accent flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {c.user.username[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{c.user.username}</p>
                          <p className="text-xs text-amber-400/60 font-mono">#{c.user.uin}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Öffentlich */}
              <label className="flex items-center gap-3 p-3 bg-white/5 rounded-xl cursor-pointer hover:bg-white/8 transition-colors">
                <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)}
                  className="accent-amber w-4 h-4" />
                <div>
                  <p className="text-sm font-medium">🌐 Öffentliche Gruppe</p>
                  <p className="text-xs text-white/40">Jeder mit dem Link kann beitreten</p>
                </div>
              </label>

              {createError && <p className="text-red-400 text-sm">{createError}</p>}
              <button type="submit" disabled={creating}
                style={{ width:"100%", padding:"11px", background:"linear-gradient(135deg,#b46a0e,#e8b86d)", border:"none", borderRadius:12, color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer", opacity:creating?0.6:1 }}>
                {creating ? 'Erstelle…' : '👥 Gruppe erstellen'}
              </button>
            </form>
          )}

          {/* Join-Link anzeigen nach Erstellen */}
          {view === 'create' && joinLink && (
            <div className="space-y-4 text-center">
              <div className="text-4xl">🎉</div>
              <h3 className="text-lg font-bold">Gruppe erstellt!</h3>
              <p className="text-white/50 text-sm">Teile diesen Link damit andere beitreten können:</p>
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 font-mono text-xs text-blue-300 break-all">
                {joinLink}
              </div>
              <button onClick={() => { navigator.clipboard.writeText(joinLink) }}
                style={{ width:"100%", padding:"10px", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:12, color:"rgba(255,255,255,0.6)", fontSize:13, cursor:"pointer" }}>
                📋 Link kopieren
              </button>
              <button onClick={onCreated} style={{ width:"100%", padding:"11px", background:"linear-gradient(135deg,#b46a0e,#e8b86d)", border:"none", borderRadius:12, color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer" }}>
                Weiter →
              </button>
            </div>
          )}

          {/* ── Per Code beitreten ── */}
          {view === 'join' && (
            <form onSubmit={handleJoin} className="space-y-4">
              <p className="text-white/50 text-sm">
                Gib einen Einladungscode oder -link ein um einer Gruppe beizutreten.
              </p>
              <div>
                <label className="block text-white/70 text-sm mb-1">Code oder Link</label>
                <input value={joinCode} onChange={e => setJoinCode(e.target.value)}
                  style={{ width:"100%", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, padding:"9px 13px", fontSize:13, color:"white", outline:"none", fontFamily:"monospace", boxSizing:"border-box" }} placeholder="abc123 oder https://…/join/abc123"
                  required autoFocus />
              </div>
              {joinError && <p className="text-red-400 text-sm">{joinError}</p>}
              <button type="submit" disabled={joining}
                style={{ width:"100%", padding:"11px", background:"linear-gradient(135deg,#b46a0e,#e8b86d)", border:"none", borderRadius:12, color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer", opacity:joining?0.6:1 }}>
                {joining ? 'Beitreten…' : '🔗 Gruppe beitreten'}
              </button>
            </form>
          )}

          {/* ── Öffentliche Gruppen entdecken ── */}
          {view === 'browse' && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  style={{ flex:1, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, padding:"8px 13px", fontSize:12, color:"white", outline:"none" }} placeholder="Gruppenname suchen…" />
                <button onClick={handleSearch} disabled={searching}
                  style={{ padding:"8px 14px", background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, color:"rgba(255,255,255,0.7)", fontSize:13, cursor:"pointer", flexShrink:0 }}
                  aria-label="Suchen">
                  {searching ? '…' : '🔍'}
                </button>
              </div>

              {/* Suchergebnisse */}
              {searchResults.length > 0 && (
                <div className="space-y-2">
                  {searchResults.map(conv => (
                    <GroupCard key={conv._id} conv={conv} apiBase={apiBase} onJoin={handleJoinGroup} />
                  ))}
                </div>
              )}

              {/* Beliebte Gruppen */}
              {searchResults.length === 0 && (
                <>
                  <p className="text-xs font-semibold text-white/30 uppercase tracking-wider">
                    ⭐ Beliebteste Gruppen
                  </p>
                  {loadingPopular && <p className="text-white/30 text-sm text-center py-4">Lade…</p>}
                  {!loadingPopular && popularGroups.length === 0 && (
                    <p className="text-white/30 text-sm text-center py-4">Keine öffentlichen Gruppen</p>
                  )}
                  <div className="space-y-2">
                    {popularGroups.map((conv, idx) => (
                      <div key={conv._id} className="relative">
                        {idx < 3 && (
                          <span className="absolute -top-1 -left-1 z-10 text-xs">
                            {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                          </span>
                        )}
                        <GroupCard conv={conv} apiBase={apiBase} onJoin={handleJoinGroup} />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  , document.body)
}