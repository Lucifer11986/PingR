// /opt/pingr/frontend/src/pages/BotStore.tsx
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../services/api'
import { useAuthStore } from '../store/authStore'

interface Bot {
  id: string; name: string; description: string; longDescription: string
  botId: string; ownerName: string; category: string; tags: string[]
  verified: boolean; featured: boolean; isNokki: boolean; icon: string
  installs: number; commandPrefix: string; permissions: string[]
}
interface Category { id: string; label: string; icon: string; count: number }

const CAT_LABELS: Record<string,string> = {
  all:'Alle', utility:'Utility', moderation:'Moderation', fun:'Fun & Games',
  productivity:'Produktivität', info:'Info & News', games:'Spiele', other:'Sonstiges',
}

export default function BotStore() {
  const navigate        = useNavigate()
  const [searchParams]  = useSearchParams()
  const fromDev         = searchParams.get('from') === 'dev'
  const { user }        = useAuthStore()

  const [bots,       setBots]       = useState<Bot[]>([])
  const [featured,   setFeatured]   = useState<Bot[]>([])
  const [cats,       setCats]       = useState<Category[]>([])
  const [groups,     setGroups]     = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [tab,        setTab]        = useState<'store'|'installed'>('store')
  const [cat,        setCat]        = useState('all')
  const [sort,       setSort]       = useState('featured')
  const [selected,   setSelected]   = useState<Bot|null>(null)
  const [instConv,   setInstConv]   = useState('')
  const [instMsg,    setInstMsg]    = useState('')
  const [installing, setInstalling] = useState(false)
  const [installed,  setInstalled]  = useState<string[]>([])
  const [installedBotObjects, setInstalledBotObjects] = useState<Bot[]>([])

  // Wenn Gruppe gewechselt wird: installierte Bots laden
  useEffect(() => {
    if (!instConv) { setInstalled([]); setInstalledBotObjects([]); return }
    api.get(`/api/bot-store/installed/${instConv}`)
      .then(async r => {
        const installedList = r.data.bots || []
        setInstalled(installedList.map((b: any) => b.botId))
        // Vollständige Bot-Daten laden für den Installiert-Tab
        if (installedList.length > 0) {
          try {
            const allBots = await api.get('/api/bot-store/public?sort=featured')
            const allBotData = allBots.data.bots || []
            const installedIds = installedList.map((b: any) => b.botId)
            setInstalledBotObjects(allBotData.filter((b: Bot) => installedIds.includes(b.botId)))
          } catch { setInstalledBotObjects([]) }
        } else {
          setInstalledBotObjects([])
        }
      })
      .catch(() => { setInstalled([]); setInstalledBotObjects([]) })
  }, [instConv])

  // Gruppen direkt per API laden — funktioniert unabhängig vom chatStore
  useEffect(() => {
    async function loadGroups() {
      try {
        const res = await api.get('/api/conversations')
        const all = res.data?.conversations || res.data || []
        setGroups(all.filter((c: any) => c.isGroup && !c.isChannel))
      } catch {
        setGroups([])
      }
    }
    if (user) loadGroups()
  }, [user])

  useEffect(() => { loadStore() }, [cat, sort])
  useEffect(() => {
    const t = setTimeout(() => loadStore(), 300)
    return () => clearTimeout(t)
  }, [search])

  async function loadStore() {
    setLoading(true)
    try {
      const [b, f, c] = await Promise.all([
        api.get(`/api/bot-store/public?category=${cat}&search=${encodeURIComponent(search)}&sort=${sort}`),
        api.get('/api/bot-store/featured'),
        api.get('/api/bot-store/categories'),
      ])
      setBots(b.data.bots || [])
      setFeatured(f.data.bots || [])
      setCats(c.data.categories || [])
    } catch {
      setBots([])
    }
    setLoading(false)
  }

  async function install(bot: Bot) {
    if (!instConv) { setInstMsg('Bitte eine Gruppe auswählen'); return }
    const requestedPermissions = (bot.permissions || ['READ_MESSAGES', 'SEND_MESSAGES']).map(p => p.toUpperCase())
    const permissionText = requestedPermissions.join(', ')
    if (!confirm(`${bot.name} installieren?\n\nAngeforderte Rechte:\n${permissionText}\n\nDiese Rechte können Bot-Aktionen in der gewählten Gruppe erlauben.`)) return
    setInstalling(true); setInstMsg('')
    try {
      const conv = groups.find((g:any) => g._id === instConv)
      await api.post(`/api/bot-store/${bot.botId}/install`, {
        conversationId: instConv,
        channelName: (conv as any)?.groupName || 'Gruppe',
        permissions: requestedPermissions,
      })
      setInstMsg('✅ ' + bot.name + ' erfolgreich installiert!')
      setInstalled(p => [...p, bot.botId])
      setTimeout(() => { setSelected(null); setInstMsg('') }, 1800)
    } catch (e: any) {
      setInstMsg(e.response?.data?.error || 'Fehler bei der Installation')
    }
    setInstalling(false)
  }

  async function uninstall(botId: string) {
    if (!instConv) return
    try {
      await api.delete(`/api/bot-store/${botId}/uninstall`, { data: { conversationId: instConv } })
      setInstalled(p => p.filter(b => b !== botId))
      setInstMsg('Bot deinstalliert')
      setTimeout(() => setInstMsg(''), 1500)
    } catch {}
  }

  // ── Styles ──────────────────────────────────────────────────────────────────
  const card = {
    background: '#0d0f18',
    border: '1px solid rgba(255,255,255,.08)',
    borderRadius: 16,
    padding: 20,
    cursor: 'pointer',
    transition: 'all .2s',
    position: 'relative' as const,
  }

  function BotCard({ bot, feat }: { bot: Bot; feat?: boolean }) {
    return (
      <div
        style={{ ...card, ...(feat ? { borderColor:'rgba(232,184,109,.18)', background:'rgba(232,184,109,.03)' } : {}) }}
        onMouseEnter={e => {
          ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'
          ;(e.currentTarget as HTMLElement).style.borderColor = feat ? 'rgba(232,184,109,.4)' : 'rgba(232,184,109,.25)'
        }}
        onMouseLeave={e => {
          ;(e.currentTarget as HTMLElement).style.transform = 'none'
          ;(e.currentTarget as HTMLElement).style.borderColor = feat ? 'rgba(232,184,109,.18)' : 'rgba(255,255,255,.08)'
        }}
        onClick={() => { setSelected(bot); setInstMsg('') }}
      >
        {bot.isNokki && (
          <div style={{ position:'absolute', top:12, right:12, fontSize:9, fontWeight:800, background:'linear-gradient(135deg,#b46a0e,#e8b86d)', color:'#fff', borderRadius:5, padding:'2px 7px', letterSpacing:'.06em' }}>NOKKI</div>
        )}
        <div style={{ display:'flex', gap:14, marginBottom:12 }}>
          <div style={{ width:52, height:52, borderRadius:13, background:'rgba(255,255,255,.06)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, flexShrink:0 }}>
            {bot.icon}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3, flexWrap:'wrap' as const }}>
              <span style={{ fontWeight:700, fontSize:14 }}>{bot.name}</span>
              {bot.verified && (
                <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:99, background:'rgba(34,197,94,.1)', color:'#4ade80', border:'1px solid rgba(34,197,94,.2)' }}>✓ Verifiziert</span>
              )}
            </div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,.3)' }}>von {bot.ownerName}</div>
          </div>
        </div>

        <p style={{ fontSize:13, color:'rgba(255,255,255,.45)', lineHeight:1.6, marginBottom:12, minHeight:40 }}>
          {bot.description}
        </p>

        {bot.tags?.length > 0 && (
          <div style={{ display:'flex', gap:4, flexWrap:'wrap' as const, marginBottom:12 }}>
            {bot.tags.slice(0,3).map(t => (
              <span key={t} style={{ fontSize:10, padding:'1px 7px', borderRadius:99, background:'rgba(255,255,255,.05)', color:'rgba(255,255,255,.3)' }}>#{t}</span>
            ))}
          </div>
        )}

        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingTop:12, borderTop:'1px solid rgba(255,255,255,.05)' }}>
          <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:99, background:'rgba(139,92,246,.1)', color:'#c4b5fd', border:'1px solid rgba(139,92,246,.2)' }}>
            {CAT_LABELS[bot.category] || bot.category}
          </span>
          <span style={{ fontSize:11, color:'rgba(255,255,255,.25)' }}>
            {String.fromCodePoint(0x2B07)} {bot.installs.toLocaleString()}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div style={{ height:'100vh', background:'#08090f', color:'white', fontFamily:"'Inter',-apple-system,sans-serif", display:'flex', flexDirection:'column', overflow:'hidden' }}>

      {/* ── Topbar ── */}
      <div style={{ background:'rgba(13,15,24,.96)', borderBottom:'1px solid rgba(255,255,255,.08)', padding:'0 32px', height:60, display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky' as const, top:0, zIndex:50, backdropFilter:'blur(20px)', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:32, height:32, borderRadius:8, background:'linear-gradient(135deg,#b46a0e,#e8b86d)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:16, color:'#fff' }}>N</div>
          <div>
            <div style={{ fontWeight:700, fontSize:14 }}>Bot Marktplatz</div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,.35)' }}>Nokki Bots & Extensions</div>
          </div>
        </div>

        <div style={{ display:'flex', gap:8 }}>
          {fromDev && (
            <button
              onClick={() => navigate('/dev-dashboard')}
              style={{ padding:'8px 16px', borderRadius:9, border:'1px solid rgba(255,255,255,.08)', background:'rgba(255,255,255,.05)', color:'rgba(255,255,255,.6)', cursor:'pointer', fontSize:12, fontWeight:600 }}
            >
              Dev Dashboard
            </button>
          )}
          <button
            onClick={() => navigate('/chat')}
            style={{ padding:'8px 16px', borderRadius:9, border:'1px solid rgba(255,255,255,.08)', background:'rgba(255,255,255,.05)', color:'rgba(255,255,255,.6)', cursor:'pointer', fontSize:12, fontWeight:600 }}
          >
            Zurück zum Chat
          </button>
        </div>
      </div>

      <div style={{ maxWidth:1140, margin:'0 auto', width:'100%', padding:'32px 24px 80px', flex:1, overflowY:'auto' }}>

        {/* ── Hero ── */}
        <div style={{ background:'linear-gradient(135deg,rgba(180,106,14,.09),rgba(139,92,246,.06))', border:'1px solid rgba(232,184,109,.12)', borderRadius:20, padding:'36px 40px', marginBottom:32, position:'relative' as const, overflow:'hidden' }}>
          <div style={{ position:'absolute', top:-40, right:-40, width:180, height:180, borderRadius:'50%', background:'radial-gradient(circle,rgba(232,184,109,.07),transparent 70%)', pointerEvents:'none' }} />
          <h1 style={{ fontSize:28, fontWeight:800, letterSpacing:-1, marginBottom:8 }}>Bot Marktplatz</h1>
          <p style={{ fontSize:14.5, color:'rgba(255,255,255,.45)', lineHeight:1.7, marginBottom:24, maxWidth:520 }}>
            Erweitere deine Gruppen mit mächtigen Bots. Commands, automatische Reaktionen und vieles mehr — alles kostenlos.
          </p>
          <div style={{ display:'flex', alignItems:'center', gap:10, background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.1)', borderRadius:12, padding:'10px 16px', maxWidth:480 }}>
            <span style={{ color:'rgba(255,255,255,.4)', fontSize:14 }}>suchen</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Bots suchen..."
              style={{ background:'none', border:'none', outline:'none', color:'white', fontSize:14, width:'100%' }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ background:'none', border:'none', color:'rgba(255,255,255,.3)', cursor:'pointer', fontSize:18, lineHeight:1 }}>x</button>
            )}
          </div>
        </div>

        {/* ── Tabs ── */}
        <div style={{ display:'flex', gap:4, marginBottom:24, background:'rgba(255,255,255,.04)', borderRadius:12, padding:4, width:'fit-content' }}>
          {(['store','installed'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{ padding:'8px 20px', borderRadius:9, border:'none', cursor:'pointer', fontSize:13, fontWeight:600, transition:'all .15s', background:tab===t?'linear-gradient(135deg,#b46a0e,#e8b86d)':'transparent', color:tab===t?'white':'rgba(255,255,255,.4)' }}
            >
              {t === 'store' ? 'Store' : 'Installiert'}
            </button>
          ))}
        </div>

        {tab === 'store' && (
          <>
            {/* Featured */}
            {!search && cat === 'all' && featured.length > 0 && (
              <div style={{ marginBottom:36 }}>
                <div style={{ fontSize:11, fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase' as const, color:'#e8b86d', marginBottom:14 }}>
                  Featured
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:12 }}>
                  {featured.map(b => <BotCard key={b.id} bot={b} feat/>)}
                </div>
              </div>
            )}

            {/* Kategorien */}
            <div style={{ display:'flex', gap:8, overflowX:'auto' as const, paddingBottom:4, marginBottom:24, scrollbarWidth:'none' as const }}>
              {cats.map(c => (
                <button
                  key={c.id}
                  onClick={() => setCat(c.id)}
                  style={{ padding:'7px 16px', borderRadius:99, border:'none', cursor:'pointer', fontSize:12, fontWeight:600, whiteSpace:'nowrap' as const, flexShrink:0, transition:'all .15s', background:cat===c.id?'rgba(232,184,109,.15)':'rgba(255,255,255,.05)', color:cat===c.id?'#e8b86d':'rgba(255,255,255,.4)', outline:cat===c.id?'1px solid rgba(232,184,109,.3)':'none' }}
                >
                  {c.icon} {c.label} <span style={{ opacity:.5, marginLeft:3 }}>({c.count})</span>
                </button>
              ))}
            </div>

            {/* Sort + Count */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
              <span style={{ fontSize:13, color:'rgba(255,255,255,.3)' }}>{bots.length} Bots</span>
              <select
                value={sort}
                onChange={e => setSort(e.target.value)}
                style={{ background:'#1a1b28', border:'1px solid rgba(255,255,255,.12)', borderRadius:8, padding:'6px 10px', color:'white', fontSize:12, outline:'none' }}
              >
                <option value="featured">Featured</option>
                <option value="newest">Neueste</option>
                <option value="name">Name A–Z</option>
              </select>
            </div>

            {/* Grid */}
            {loading ? (
              <div style={{ textAlign:'center', padding:'60px 0', color:'rgba(255,255,255,.3)' }}>
                <div style={{ fontSize:32, marginBottom:12 }}>laden...</div>
              </div>
            ) : bots.length === 0 ? (
              <div style={{ textAlign:'center', padding:'60px 0', color:'rgba(255,255,255,.25)' }}>
                <div style={{ fontSize:48, marginBottom:12 }}>keine bots</div>
                <div style={{ fontSize:16, fontWeight:600 }}>Keine Bots gefunden</div>
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(310px,1fr))', gap:16 }}>
                {bots.map(b => <BotCard key={b.id} bot={b}/>)}
              </div>
            )}
          </>
        )}

        {tab === 'installed' && (
          <div>
            <p style={{ fontSize:14, color:'rgba(255,255,255,.4)', marginBottom:20 }}>Waehle eine Gruppe um installierte Bots zu sehen und zu verwalten.</p>
            <select
              style={{ width:'100%', maxWidth:400, padding:'10px 13px', borderRadius:10, border:'1px solid rgba(255,255,255,.12)', background:'#1a1b28', color:'white', fontSize:13, outline:'none', marginBottom:20 }}
              value={instConv}
              onChange={e => setInstConv(e.target.value)}
            >
              <option value="">Gruppe auswaehlen...</option>
              {groups.map((g:any) => <option key={g._id} value={g._id}>{(g as any).groupName || 'Gruppe'}</option>)}
            </select>

            {instConv && installedBotObjects.length === 0 && (
              <div style={{ textAlign:'center', padding:'40px 0', color:'rgba(255,255,255,.25)' }}>
                <div style={{ fontSize:40, marginBottom:10 }}>Keine Bots</div>
                <div style={{ marginBottom:14 }}>Keine Bots in dieser Gruppe installiert</div>
                <button onClick={() => setTab('store')} style={{ padding:'9px 20px', borderRadius:9, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#b46a0e,#e8b86d)', color:'white', fontWeight:700, fontSize:13 }}>
                  Bots entdecken
                </button>
              </div>
            )}

            {instConv && installedBotObjects.length > 0 && (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:12 }}>
                {installedBotObjects.map(bot => (
                  <div key={bot.botId} style={{ background:'#0d0f18', border:'1px solid rgba(34,197,94,.15)', borderRadius:14, padding:16 }}>
                    <div style={{ display:'flex', gap:12, marginBottom:10 }}>
                      <div style={{ width:42, height:42, borderRadius:11, background:'rgba(255,255,255,.06)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>{bot.icon}</div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:700, fontSize:13, marginBottom:2 }}>{bot.name}</div>
                        <div style={{ fontSize:11, color:'rgba(255,255,255,.35)' }}>{CAT_LABELS[bot.category]}</div>
                      </div>
                      <span style={{ fontSize:10, padding:'2px 7px', borderRadius:99, background:'rgba(34,197,94,.1)', color:'#4ade80', border:'1px solid rgba(34,197,94,.2)', height:'fit-content' }}>Aktiv</span>
                    </div>
                    <button
                      onClick={() => uninstall(bot.botId)}
                      style={{ width:'100%', padding:'8px', borderRadius:8, border:'none', cursor:'pointer', background:'rgba(239,68,68,.1)', color:'#f87171', fontSize:12, fontWeight:600 }}
                    >
                      Deinstallieren
                    </button>
                  </div>
                ))}
              </div>
            )}
            {instMsg && <div style={{ fontSize:13, color:'#4ade80', marginTop:12 }}>{instMsg}</div>}
          </div>
        )}
      </div>

      {/* ── Detail Modal ── */}
      {selected && (
        <div
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)', backdropFilter:'blur(16px)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
          onClick={() => { setSelected(null); setInstMsg('') }}
        >
          <div
            style={{ background:'#0d0f18', border:'1px solid rgba(255,255,255,.1)', borderRadius:20, width:'100%', maxWidth:540, maxHeight:'88vh', overflowY:'auto', boxShadow:'0 30px 80px rgba(0,0,0,.7)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ padding:'20px 24px', borderBottom:'1px solid rgba(255,255,255,.08)', display:'flex', gap:16, alignItems:'flex-start' }}>
              <div style={{ width:58, height:58, borderRadius:14, background:'rgba(255,255,255,.06)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, flexShrink:0 }}>
                {selected.icon}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' as const }}>
                  <span style={{ fontWeight:800, fontSize:18 }}>{selected.name}</span>
                  {selected.isNokki && (
                    <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:99, background:'rgba(232,184,109,.12)', color:'#e8b86d', border:'1px solid rgba(232,184,109,.25)' }}>Offiziell</span>
                  )}
                  {selected.verified && !selected.isNokki && (
                    <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:99, background:'rgba(34,197,94,.1)', color:'#4ade80', border:'1px solid rgba(34,197,94,.2)' }}>Verifiziert</span>
                  )}
                </div>
                <div style={{ fontSize:12, color:'rgba(255,255,255,.35)', marginTop:4 }}>
                  von {selected.ownerName} · {selected.installs.toLocaleString()} Installs · {CAT_LABELS[selected.category]}
                </div>
              </div>
              <button
                onClick={() => { setSelected(null); setInstMsg('') }}
                style={{ background:'none', border:'none', color:'rgba(255,255,255,.3)', cursor:'pointer', fontSize:24, lineHeight:1, flexShrink:0 }}
              >x</button>
            </div>

            <div style={{ padding:24 }}>
              {/* Beschreibung */}
              {selected.longDescription ? (
                <div style={{ marginBottom:20 }}>
                  {selected.longDescription.split('\n').map((line, i) => {
                    if (line.startsWith('**') && line.endsWith('**'))
                      return <div key={i} style={{ fontWeight:700, fontSize:13, color:'#e8b86d', marginTop:i>0?12:0, marginBottom:4 }}>{line.replace(/\*\*/g,'')}</div>
                    if (line.startsWith('`'))
                      return <div key={i} style={{ fontFamily:'monospace', fontSize:12, color:'rgba(255,255,255,.6)', background:'rgba(255,255,255,.05)', padding:'3px 8px', borderRadius:5, margin:'2px 0' }}>{line.replace(/`/g,'')}</div>
                    return line
                      ? <p key={i} style={{ fontSize:13.5, color:'rgba(255,255,255,.5)', lineHeight:1.7, margin:'2px 0' }}>{line}</p>
                      : <br key={i}/>
                  })}
                </div>
              ) : (
                <p style={{ fontSize:14, color:'rgba(255,255,255,.5)', lineHeight:1.7, marginBottom:20 }}>{selected.description}</p>
              )}

              {/* Tags */}
              {selected.tags?.length > 0 && (
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' as const, marginBottom:20 }}>
                  {selected.tags.map(t => (
                    <span key={t} style={{ fontSize:11, padding:'2px 9px', borderRadius:99, background:'rgba(255,255,255,.05)', color:'rgba(255,255,255,.35)' }}>#{t}</span>
                  ))}
                </div>
              )}

              {/* Prefix */}
              <div style={{ background:'rgba(255,255,255,.04)', borderRadius:10, padding:'10px 14px', marginBottom:20, fontSize:12, color:'rgba(255,255,255,.4)', display:'flex', alignItems:'center', gap:8 }}>
                <span>Befehls-Präfix:</span>
                <code style={{ color:'#e8b86d', fontFamily:'monospace', fontSize:14 }}>{selected.commandPrefix}</code>
              </div>

              {/* Permissions */}
              {selected.permissions?.length > 0 && (
                <div style={{ background:'rgba(59,130,246,.06)', border:'1px solid rgba(59,130,246,.15)', borderRadius:10, padding:'12px 14px', marginBottom:20, fontSize:12, color:'#93c5fd' }}>
                  <strong style={{ display:'block', marginBottom:5 }}>Benötigte Berechtigungen</strong>
                  {selected.permissions.map(p => <span key={p} style={{ marginRight:8 }}>• {p.replace(/_/g,' ')}</span>)}
                </div>
              )}

              {/* Gruppe auswählen */}
              <div style={{ fontSize:11, fontWeight:700, letterSpacing:'.08em', textTransform:'uppercase' as const, color:'rgba(255,255,255,.3)', marginBottom:8 }}>In Gruppe installieren</div>
              <select
                style={{ width:'100%', padding:'10px 13px', borderRadius:10, border:'1px solid rgba(255,255,255,.12)', background:'#1a1b28', color:'white', fontSize:13, outline:'none', marginBottom:12 }}
                value={instConv}
                onChange={e => setInstConv(e.target.value)}
              >
                <option value="">Gruppe auswählen...</option>
                {groups.map((g:any) => <option key={g._id} value={g._id}>{(g as any).groupName || 'Gruppe'}</option>)}
              </select>

              {groups.length === 0 && (
                <p style={{ fontSize:12, color:'rgba(255,255,255,.35)', marginBottom:12 }}>Erstelle zuerst eine Gruppe.</p>
              )}

              {instMsg && (
                <div style={{ fontSize:13, padding:'9px 13px', borderRadius:9, marginBottom:12, background:instMsg.startsWith('✅')?'rgba(34,197,94,.08)':'rgba(239,68,68,.08)', color:instMsg.startsWith('✅')?'#4ade80':'#f87171' }}>
                  {instMsg}
                </div>
              )}

              <div style={{ display:'flex', gap:8 }}>
                {installed.includes(selected.botId) ? (
                  <button
                    onClick={() => uninstall(selected.botId)}
                    style={{ flex:1, padding:'11px 18px', borderRadius:10, border:'none', cursor:'pointer', fontWeight:700, fontSize:13, background:'rgba(239,68,68,.1)', color:'#f87171' }}
                  >
                    🗑️ Aus dieser Gruppe deinstallieren
                  </button>
                ) : (
                  <button
                    onClick={() => install(selected)}
                    disabled={installing || !instConv}
                    style={{ flex:1, padding:'11px 18px', borderRadius:10, border:'none', cursor:'pointer', fontWeight:700, fontSize:13, background:'linear-gradient(135deg,#b46a0e,#e8b86d)', color:'white', opacity:(!instConv||installing)?0.5:1 }}
                  >
                    {installing ? 'Installiere...' : '⬇️ Bot installieren'}
                  </button>
                )}
                <button
                  onClick={() => { setSelected(null); setInstMsg('') }}
                  style={{ padding:'11px 18px', borderRadius:10, border:'none', cursor:'pointer', fontWeight:700, fontSize:13, background:'rgba(255,255,255,.06)', color:'white' }}
                >
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// CSS injection für dunkle Dropdowns
if (typeof document !== 'undefined') {
  const style = document.createElement('style')
  style.textContent = `
    .nokki-select { background: #1a1b28 !important; color: white !important; border: 1px solid rgba(255,255,255,.12) !important; }
    .nokki-select option { background: #1a1b28 !important; color: white !important; }
  `
  if (!document.head.querySelector('#nokki-select-style')) {
    style.id = 'nokki-select-style'
    document.head.appendChild(style)
  }
}
