import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import DevSidebar from './DevSidebar'
import { devFetch } from '../services/devApi'

interface Bot {
  id: string; name: string; description: string; botId: string
  status: 'active' | 'inactive'; permissions: string[]
  icon?: string; isNokki?: boolean; isMarketplace?: boolean
  installedIn?: { channelId: string; channelName: string; installationId: string }[]
  stats: { totalMessages: number; apiCalls30d: number; lastActive: string }
  createdAt: string
}

const PERMISSIONS = [
  { id: 'READ_MESSAGES',   desc: 'Nachrichten lesen',        color: '#3b82f6' },
  { id: 'SEND_MESSAGES',   desc: 'Nachrichten senden',       color: '#22c55e' },
  { id: 'DELETE_MESSAGES', desc: 'Nachrichten loeschen',     color: '#f59e0b' },
  { id: 'MANAGE_MEMBERS',  desc: 'User kicken/bannen/muten', color: '#8b5cf6' },
  { id: 'MANAGE_MESSAGES', desc: 'Massen-Loeschung (purge)', color: '#ec4899' },
  { id: 'ADMINISTRATOR',   desc: 'Alle Rechte (Vorsicht!)',  color: '#ef4444' },
]

const permColor = (id: string) => PERMISSIONS.find(p => p.id === id)?.color || '#6b7280'

const token = () => localStorage.getItem('nokki_dev_token') || ''

const avatarColor = (name: string) => {
  const colors = ['#7c3aed','#2563eb','#059669','#d97706','#dc2626','#db2777']
  let h = 0; for (let i = 0; i < name.length; i++) h += name.charCodeAt(i)
  return colors[h % colors.length]
}

const DevBots: React.FC = () => {
  const navigate = useNavigate()
  const [bots, setBots]             = useState<Bot[]>([])
  const [loading, setLoading]       = useState(true)
  const [editingBot, setEditingBot] = useState<Bot | null>(null)
  const [editName, setEditName]     = useState('')
  const [editDesc, setEditDesc]     = useState('')
  const [editPerms, setEditPerms]   = useState<string[]>([])
  const [editWebhook, setEditWebhook] = useState('')
  const [editSupportUrl, setEditSupportUrl] = useState('')
  const [saving, setSaving]         = useState(false)
  const [copied, setCopied]         = useState<string | null>(null)
  const [showGuide, setShowGuide]   = useState(false)
  // Publish Modal
  const [publishBot, setPublishBot]       = useState<Bot | null>(null)
  const [pubDescription, setPubDescription] = useState('')
  const [pubLongDesc, setPubLongDesc]     = useState('')
  const [pubCategory, setPubCategory]     = useState('utility')
  const [pubPlatform, setPubPlatform]     = useState('nokki')
  const [pubIcon, setPubIcon]             = useState('🤖')
  const [pubTags, setPubTags]             = useState('')
  const [pubCommandPrefix, setPubCommandPrefix] = useState('/')
  const [pubSupportUrl, setPubSupportUrl] = useState('')
  const [pubWebhookUrl, setPubWebhookUrl] = useState('')
  const [pubSaving, setPubSaving]         = useState(false)
  const [pubMsg, setPubMsg]               = useState('')

  const PLATFORMS = [
    { id: 'nokki',     label: 'Nokki',     icon: '💬' },
    { id: 'discord',   label: 'Discord',   icon: '🎮' },
    { id: 'telegram',  label: 'Telegram',  icon: '✈️' },
    { id: 'teamspeak', label: 'TeamSpeak', icon: '🎧' },
    { id: 'slack',     label: 'Slack',     icon: '💼' },
    { id: 'matrix',    label: 'Matrix',    icon: '🔷' },
    { id: 'other',     label: 'Sonstiges', icon: '🤖' },
  ]

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try {
      const r = await devFetch('/api/dev/bots', { headers: { Authorization: `Bearer ${token()}` } })
      const d = await r.json()
      setBots(d.bots || [])
    } catch {} finally { setLoading(false) }
  }

  const startEdit = (bot: Bot) => {
    setEditingBot(bot); setEditName(bot.name)
    setEditDesc(bot.description || ''); setEditPerms(bot.permissions || [])
    setEditWebhook((bot as any).webhookUrl || '')
    setEditSupportUrl((bot as any).supportUrl || '')
  }

  const save = async () => {
    if (!editingBot) return
    setSaving(true)
    try {
      const r = await devFetch(`/api/dev/bots/${editingBot.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, description: editDesc, permissions: editPerms, webhookUrl: editWebhook, supportUrl: editSupportUrl })
      })
      if (r.ok) { setEditingBot(null); load() }
      else alert('Fehler beim Speichern')
    } catch { alert('Verbindungsfehler') } finally { setSaving(false) }
  }

  const toggleStatus = async (bot: Bot) => {
    const s = bot.status === 'active' ? 'inactive' : 'active'
    await devFetch(`/api/dev/bots/${bot.id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: s })
    })
    load()
  }

  const del = async (id: string) => {
    if (!confirm('Bot wirklich loeschen?\nAlle Installationen werden deaktiviert!')) return
    await devFetch(`/api/dev/bots/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } })
    load()
  }

  const copy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(key); setTimeout(() => setCopied(null), 2000)
  }

  const togglePerm = (p: string) =>
    setEditPerms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])

  const uninstallFromGroup = async (botId: string, channelId: string) => {
    if (!confirm('Bot aus dieser Gruppe deinstallieren?')) return
    await devFetch(`/api/dev/bots/${botId}/uninstall`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId })
    })
    load()
  }

  const openPublish = (bot: Bot) => {
    setPublishBot(bot)
    setPubDescription((bot as any).description || '')
    setPubLongDesc((bot as any).longDescription || '')
    setPubCategory((bot as any).category || 'utility')
    setPubPlatform((bot as any).platform || 'nokki')
    setPubIcon((bot as any).icon || '🤖')
    setPubTags(((bot as any).tags || []).join(', '))
    setPubCommandPrefix((bot as any).commandPrefix || '/')
    setPubSupportUrl((bot as any).supportUrl || '')
    setPubWebhookUrl((bot as any).webhookUrl || '')
    setPubMsg('')
  }

  const submitPublish = async () => {
    if (!publishBot) return
    setPubSaving(true); setPubMsg('')
    try {
      const res = await devFetch(`/api/dev/bots/${publishBot.id}/publish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: pubDescription, longDescription: pubLongDesc,
          category: pubCategory, platform: pubPlatform, icon: pubIcon,
          tags: pubTags, commandPrefix: pubCommandPrefix,
          supportUrl: pubSupportUrl, webhookUrl: pubWebhookUrl,
        })
      })
      const data = await res.json()
      if (data.success) {
        setPubMsg('✅ Bot wurde zur Prüfung eingereicht!')
        setTimeout(() => { setPublishBot(null); load() }, 1500)
      } else {
        setPubMsg('❌ ' + (data.error || 'Fehler'))
      }
    } catch { setPubMsg('❌ Netzwerkfehler') }
    setPubSaving(false)
  }

  const unpublish = async (bot: Bot) => {
    if (!confirm(`${bot.name} vom Marktplatz zurückziehen?`)) return
    await devFetch(`/api/dev/bots/${bot.id}/unpublish`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token()}` }
    })
    load()
  }

  const uninstallAll = async (botId: string, name: string) => {
    if (!confirm(`${name} aus ALLEN Gruppen deinstallieren?`)) return
    await devFetch(`/api/dev/bots/${botId}/uninstall`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })
    load()
  }

  // Bots aufteilen
  const ownBots        = (bots as Bot[]).filter(b => !b.isMarketplace)
  const marketplaceBots = (bots as Bot[]).filter(b => b.isMarketplace)

  const inp: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: '8px',
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
    color: '#f1f0f8', fontSize: '14px', outline: 'none', boxSizing: 'border-box'
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#08090f', color: '#f1f0f8' }}>
      <DevSidebar active="bots" />

      <div style={{ flex: 1, padding: '32px', overflowY: 'auto', maxHeight: '100vh' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 900, marginBottom: '4px' }}>Meine Bots</h1>
            <p style={{ color: '#8b8aa8', fontSize: '14px' }}>Erstelle und verwalte deine Bots</p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => setShowGuide(!showGuide)} style={{ padding: '9px 16px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#8b8aa8', cursor: 'pointer', fontSize: '13px' }}>
              {showGuide ? 'Guide schliessen' : 'Permission Guide'}
            </button>
            <button onClick={() => navigate('/dev-dashboard')} style={{ padding: '10px 22px', borderRadius: '8px', background: 'linear-gradient(135deg,#b46a0e,#e8b86d)', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '14px' }}>
              + Neuer Bot
            </button>
          </div>
        </div>

        {/* Permission Guide */}
        {showGuide && (
          <div style={{ background: '#0a0d1a', border: '1px solid rgba(232,184,109,0.2)', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#e8b86d', marginBottom: '14px' }}>Permissions erklaert</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: '10px' }}>
              {PERMISSIONS.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                  <span style={{ padding: '2px 8px', borderRadius: '5px', fontSize: '11px', fontWeight: 700, background: `${p.color}20`, color: p.color, whiteSpace: 'nowrap' as const, fontFamily: 'monospace' }}>{p.id}</span>
                  <span style={{ color: '#8b8aa8', fontSize: '12px' }}>{p.desc}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '12px', padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', fontSize: '12px', color: '#fca5a5' }}>
              Tipp: Vergib nur die Permissions die dein Bot wirklich braucht. ADMINISTRATOR nur wenn absolut notwendig.
            </div>
          </div>
        )}

        {/* Bot Liste */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px', color: '#8b8aa8' }}>
            <div style={{ width: '36px', height: '36px', border: '3px solid #b46a0e', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            Lade Bots...
          </div>
        ) : bots.length === 0 ? (
          <div style={{ background: '#0d0f18', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '80px', textAlign: 'center' }}>
            <div style={{ fontSize: '56px', marginBottom: '16px' }}>🤖</div>
            <h3 style={{ fontSize: '20px', marginBottom: '8px' }}>Noch keine Bots</h3>
            <p style={{ color: '#8b8aa8', marginBottom: '24px', fontSize: '14px', maxWidth: '380px', margin: '0 auto 24px', lineHeight: 1.7 }}>
              Erstelle deinen ersten Bot. Er bekommt automatisch READ_MESSAGES und SEND_MESSAGES.
            </p>
            <button onClick={() => navigate('/dev-dashboard')} style={{ padding: '12px 28px', borderRadius: '8px', background: 'linear-gradient(135deg,#b46a0e,#e8b86d)', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
              Ersten Bot erstellen
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '16px' }}>
            {/* Eigene Dev-Bots */}
            {ownBots.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase' as const, color: '#e8b86d', marginBottom: -4 }}>
                  Eigene Bots
                </div>
                {ownBots.map(bot => (
              <div key={bot.id} style={{ background: '#0d0f18', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', overflow: 'hidden' }}>

                {/* Top: Avatar + Info + Buttons */}
                <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '16px', borderBottom: '1px solid rgba(255,255,255,0.05)', flexWrap: 'wrap' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: `linear-gradient(135deg,${avatarColor(bot.name)},${avatarColor(bot.name)}88)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 }}>
                    🤖
                  </div>
                  <div style={{ flex: 1, minWidth: '160px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '17px', fontWeight: 700 }}>{bot.name}</span>
                      <span style={{ padding: '2px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: 700, background: bot.status === 'active' ? 'rgba(34,197,94,0.15)' : 'rgba(107,114,128,0.15)', color: bot.status === 'active' ? '#22c55e' : '#6b7280', border: `1px solid ${bot.status === 'active' ? 'rgba(34,197,94,0.3)' : 'rgba(107,114,128,0.3)'}` }}>
                        {bot.status === 'active' ? 'Aktiv' : 'Inaktiv'}
                      </span>
                      {(bot as any).isPublished && (
                        <span style={{ padding:'2px 8px', borderRadius:99, fontSize:11, fontWeight:700, background:'rgba(232,184,109,.12)', color:'#e8b86d', border:'1px solid rgba(232,184,109,.25)' }}>
                          🌐 Marktplatz
                        </span>
                      )}
                    </div>
                    <p style={{ color: '#8b8aa8', fontSize: '13px', marginBottom: '6px' }}>{bot.description || 'Keine Beschreibung'}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <code style={{ background: 'rgba(232,184,109,0.1)', color: '#e8b86d', padding: '2px 8px', borderRadius: '5px', fontSize: '11px' }}>{bot.botId}</code>
                      <button onClick={() => copy(bot.botId, `id_${bot.id}`)} style={{ background: 'none', border: 'none', color: copied === `id_${bot.id}` ? '#22c55e' : '#6b7280', cursor: 'pointer', fontSize: '11px', padding: '2px 6px' }}>
                        {copied === `id_${bot.id}` ? 'Kopiert' : 'ID kopieren'}
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <button onClick={() => toggleStatus(bot)} style={{ padding: '8px 14px', borderRadius: '7px', background: bot.status === 'active' ? 'rgba(234,179,8,0.1)' : 'rgba(34,197,94,0.1)', border: `1px solid ${bot.status === 'active' ? 'rgba(234,179,8,0.3)' : 'rgba(34,197,94,0.3)'}`, color: bot.status === 'active' ? '#fde047' : '#22c55e', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
                      {bot.status === 'active' ? 'Deaktivieren' : 'Aktivieren'}
                    </button>
                    <button onClick={() => navigate(`/dev-bots/${bot.botId}/installations`)} style={{ padding: '8px 14px', borderRadius: '7px', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', color: '#a78bfa', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
                      Installationen
                    </button>
                    <button onClick={() => startEdit(bot)} style={{ padding: '8px 14px', borderRadius: '7px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', color: '#93c5fd', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
                      Bearbeiten
                    </button>
                    {(bot as any).isPublished ? (
                      <button onClick={() => unpublish(bot)} style={{ padding: '8px 14px', borderRadius: '7px', background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)', color: '#fde047', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
                        Vom Marktplatz
                      </button>
                    ) : (
                      <button onClick={() => openPublish(bot)} style={{ padding: '8px 14px', borderRadius: '7px', background: 'rgba(232,184,109,0.15)', border: '1px solid rgba(232,184,109,0.3)', color: '#e8b86d', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
                        🚀 Veröffentlichen
                      </button>
                    )}
                    <button onClick={() => del(bot.id)} style={{ padding: '8px 12px', borderRadius: '7px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', cursor: 'pointer', fontSize: '14px' }}>
                      🗑
                    </button>
                  </div>
                </div>

                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  {[
                    { label: 'Nachrichten', value: String(bot.stats?.totalMessages ?? 0), color: '#3b82f6' },
                    { label: 'API Calls (30T)', value: String(bot.stats?.apiCalls30d ?? 0), color: '#f59e0b' },
                    { label: 'Zuletzt aktiv', value: bot.stats?.lastActive || 'Nie', color: '#8b8aa8', small: true },
                    { label: 'Erstellt', value: new Date(bot.createdAt).toLocaleDateString('de-DE'), color: '#8b8aa8', small: true },
                  ].map((s, i) => (
                    <div key={i} style={{ padding: '14px 20px', borderRight: i < 3 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                      <div style={{ fontSize: '10px', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: '6px' }}>{s.label}</div>
                      <div style={{ fontSize: s.small ? '13px' : '20px', fontWeight: s.small ? 500 : 800, color: s.color }}>{s.value}</div>
                    </div>
                  ))}
                </div>

                {/* Permissions + Install Link */}
                <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase' as const, marginRight: '4px' }}>Permissions:</span>
                    {(bot.permissions || []).map(p => (
                      <span key={p} style={{ padding: '2px 8px', borderRadius: '5px', fontSize: '11px', fontWeight: 600, background: `${permColor(p)}18`, color: permColor(p), border: `1px solid ${permColor(p)}35`, fontFamily: 'monospace' }}>{p}</span>
                    ))}
                    {(!bot.permissions || bot.permissions.length === 0) && <span style={{ color: '#6b7280', fontSize: '12px' }}>Keine</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: '8px', padding: '8px 12px' }}>
                    <span style={{ fontSize: '11px', color: '#6b7280', whiteSpace: 'nowrap' as const }}>Install-Link:</span>
                    <code style={{ fontSize: '11px', color: '#93c5fd', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                      {`${window.location.origin}/install-bot?bot_id=${bot.botId}`}
                    </code>
                    <button onClick={() => copy(`${window.location.origin}/install-bot?bot_id=${bot.botId}`, `link_${bot.id}`)} style={{ background: 'none', border: 'none', color: copied === `link_${bot.id}` ? '#22c55e' : '#6b7280', cursor: 'pointer', fontSize: '13px', flexShrink: 0 }}>
                      {copied === `link_${bot.id}` ? '✓' : '⎘'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
              </>
            )}

            {/* Installierte Marktplatz-Bots */}
            {marketplaceBots.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase' as const, color: '#e8b86d', marginTop: ownBots.length > 0 ? 12 : 0, marginBottom: -4 }}>
                  Installierte Marktplatz-Bots
                </div>
                {marketplaceBots.map(bot => (
                  <div key={bot.botId} style={{ background: '#0d0f18', border: '1px solid rgba(232,184,109,.15)', borderRadius: '14px', overflow: 'hidden' }}>
                    {/* Header */}
                    <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '14px', borderBottom: '1px solid rgba(255,255,255,0.05)', flexWrap: 'wrap' }}>
                      <div style={{ width: 46, height: 46, borderRadius: 12, background: 'rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                        {bot.icon || '🤖'}
                      </div>
                      <div style={{ flex: 1, minWidth: 160 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' as const }}>
                          <span style={{ fontSize: 16, fontWeight: 700 }}>{bot.name}</span>
                          <span style={{ fontSize: 9, fontWeight: 800, background: 'linear-gradient(135deg,#b46a0e,#e8b86d)', color: '#fff', borderRadius: 4, padding: '2px 6px', letterSpacing: '.06em' }}>NOKKI</span>
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: 'rgba(34,197,94,.12)', color: '#4ade80', border: '1px solid rgba(34,197,94,.2)' }}>Aktiv</span>
                        </div>
                        <p style={{ color: '#8b8aa8', fontSize: 12 }}>{bot.description}</p>
                      </div>
                      <button
                        onClick={() => uninstallAll(bot.botId, bot.name)}
                        style={{ padding: '8px 14px', borderRadius: 7, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', color: '#f87171', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                      >
                        Alle deinstallieren
                      </button>
                    </div>

                    {/* Installierte Gruppen */}
                    <div style={{ padding: '12px 24px' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '.06em', marginBottom: 8 }}>
                        Installiert in {bot.installedIn?.length || 0} Gruppe(n)
                      </div>
                      {bot.installedIn && bot.installedIn.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 8 }}>
                          {bot.installedIn.map(inst => (
                            <div key={inst.channelId} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, padding: '5px 10px' }}>
                              <span style={{ fontSize: 12, color: 'rgba(255,255,255,.7)' }}>👥 {inst.channelName}</span>
                              <button
                                onClick={() => uninstallFromGroup(bot.botId, inst.channelId)}
                                style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: '0 2px' }}
                                title="Aus dieser Gruppe entfernen"
                              >×</button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: '#6b7280' }}>Keine aktiven Installationen</span>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingBot && (
        <div onClick={() => setEditingBot(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#13141f', borderRadius: '16px', padding: '28px', maxWidth: '540px', width: '100%', border: '1px solid rgba(255,255,255,0.08)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Bot bearbeiten</h2>
              <button onClick={() => setEditingBot(null)} style={{ background: 'none', border: 'none', color: '#8b8aa8', fontSize: '24px', cursor: 'pointer' }}>x</button>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Name</label>
              <input value={editName} onChange={e => setEditName(e.target.value)} style={inp} />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Beschreibung</label>
              <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={3} style={{ ...inp, resize: 'vertical' as const }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Webhook-URL
                  <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: 400, marginLeft: '6px' }}>optional</span>
                </label>
                <input
                  value={editWebhook}
                  onChange={e => setEditWebhook(e.target.value)}
                  placeholder="https://dein-server.de/webhook"
                  style={inp}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Support-URL
                  <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: 400, marginLeft: '6px' }}>optional</span>
                </label>
                <input
                  value={editSupportUrl}
                  onChange={e => setEditSupportUrl(e.target.value)}
                  placeholder="https://docs.dein-bot.de"
                  style={inp}
                />
              </div>
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '10px' }}>Permissions</label>
              <div style={{ display: 'grid', gap: '8px' }}>
                {PERMISSIONS.map(p => (
                  <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: '8px', cursor: 'pointer', background: editPerms.includes(p.id) ? `${p.color}15` : 'rgba(255,255,255,0.03)', border: `1px solid ${editPerms.includes(p.id) ? `${p.color}40` : 'rgba(255,255,255,0.07)'}` }}>
                    <input type="checkbox" checked={editPerms.includes(p.id)} onChange={() => togglePerm(p.id)} style={{ accentColor: p.color, cursor: 'pointer' }} />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, fontFamily: 'monospace', color: editPerms.includes(p.id) ? p.color : '#f1f0f8' }}>{p.id}</div>
                      <div style={{ fontSize: '12px', color: '#8b8aa8' }}>{p.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setEditingBot(null)} style={{ flex: 1, padding: '11px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f1f0f8', cursor: 'pointer' }}>Abbrechen</button>
              <button onClick={save} disabled={saving} style={{ flex: 1, padding: '11px', borderRadius: '8px', background: 'linear-gradient(135deg,#b46a0e,#e8b86d)', border: 'none', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 700, opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Speichert...' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Publish Modal ── */}
      {publishBot && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)', backdropFilter:'blur(16px)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
          onClick={() => setPublishBot(null)}>
          <div style={{ background:'#0d0f18', border:'1px solid rgba(255,255,255,.1)', borderRadius:20, width:'100%', maxWidth:560, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 30px 80px rgba(0,0,0,.7)' }}
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{ padding:'20px 24px', borderBottom:'1px solid rgba(255,255,255,.08)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <div style={{ fontWeight:800, fontSize:18 }}>🚀 Bot veröffentlichen</div>
                <div style={{ fontSize:12, color:'rgba(255,255,255,.35)', marginTop:3 }}>
                  {publishBot.name} wird öffentlich auf dem Marktplatz sichtbar
                </div>
              </div>
              <button onClick={() => setPublishBot(null)} style={{ background:'none', border:'none', color:'rgba(255,255,255,.3)', cursor:'pointer', fontSize:24 }}>×</button>
            </div>

            <div style={{ padding:24, display:'flex', flexDirection:'column', gap:14 }}>
              {/* Plattform */}
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'#e8b86d', textTransform:'uppercase', letterSpacing:'.08em', display:'block', marginBottom:6 }}>Plattform *</label>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {PLATFORMS.map(p => (
                    <button key={p.id} onClick={() => setPubPlatform(p.id)}
                      style={{ padding:'7px 14px', borderRadius:99, border:'none', cursor:'pointer', fontSize:12, fontWeight:600, transition:'all .15s', background:pubPlatform===p.id?'rgba(232,184,109,.2)':'rgba(255,255,255,.05)', color:pubPlatform===p.id?'#e8b86d':'rgba(255,255,255,.4)', outline:pubPlatform===p.id?'1px solid rgba(232,184,109,.4)':'none' }}>
                      {p.icon} {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Icon + Kategorie */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr', gap:12 }}>
                <div>
                  <label style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,.4)', textTransform:'uppercase', letterSpacing:'.08em', display:'block', marginBottom:6 }}>Icon (Emoji) *</label>
                  <input value={pubIcon} onChange={e => setPubIcon(e.target.value)}
                    style={{ width:'100%', padding:'10px 12px', borderRadius:9, border:'1px solid rgba(255,255,255,.12)', background:'#1a1b28', color:'white', fontSize:22, outline:'none', textAlign:'center' }}
                    placeholder="🤖" maxLength={2}/>
                </div>
                <div>
                  <label style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,.4)', textTransform:'uppercase', letterSpacing:'.08em', display:'block', marginBottom:6 }}>Kategorie *</label>
                  <select value={pubCategory} onChange={e => setPubCategory(e.target.value)}
                    style={{ width:'100%', padding:'10px 12px', borderRadius:9, border:'1px solid rgba(255,255,255,.12)', background:'#1a1b28', color:'white', fontSize:13, outline:'none' }}>
                    {[['utility','Utility'],['moderation','Moderation'],['fun','Fun & Games'],['productivity','Produktivität'],['info','Info & News'],['games','Spiele'],['other','Sonstiges']].map(([v,l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Kurzbeschreibung */}
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,.4)', textTransform:'uppercase', letterSpacing:'.08em', display:'block', marginBottom:6 }}>Kurzbeschreibung * <span style={{ color:'rgba(255,255,255,.25)', fontWeight:400 }}>(max. 160 Zeichen)</span></label>
                <input value={pubDescription} onChange={e => setPubDescription(e.target.value)} maxLength={160}
                  placeholder="Was macht dein Bot in einem Satz?"
                  style={{ width:'100%', padding:'10px 12px', borderRadius:9, border:'1px solid rgba(255,255,255,.12)', background:'#1a1b28', color:'white', fontSize:13, outline:'none' }}/>
                <div style={{ fontSize:11, color:'rgba(255,255,255,.25)', textAlign:'right', marginTop:3 }}>{pubDescription.length}/160</div>
              </div>

              {/* Langbeschreibung */}
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,.4)', textTransform:'uppercase', letterSpacing:'.08em', display:'block', marginBottom:6 }}>Ausführliche Beschreibung * <span style={{ color:'rgba(255,255,255,.25)', fontWeight:400 }}>(Commands, Features etc.)</span></label>
                <textarea value={pubLongDesc} onChange={e => setPubLongDesc(e.target.value)} rows={5} maxLength={2000}
                  placeholder="Beschreibe alle Features und Commands deines Bots..."
                  style={{ width:'100%', padding:'10px 12px', borderRadius:9, border:'1px solid rgba(255,255,255,.12)', background:'#1a1b28', color:'white', fontSize:13, outline:'none', resize:'vertical', fontFamily:'inherit' }}/>
              </div>

              {/* Tags + Präfix */}
              <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:12 }}>
                <div>
                  <label style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,.4)', textTransform:'uppercase', letterSpacing:'.08em', display:'block', marginBottom:6 }}>Tags <span style={{ color:'rgba(255,255,255,.25)', fontWeight:400 }}>(kommagetrennt)</span></label>
                  <input value={pubTags} onChange={e => setPubTags(e.target.value)}
                    placeholder="musik, playlist, youtube"
                    style={{ width:'100%', padding:'10px 12px', borderRadius:9, border:'1px solid rgba(255,255,255,.12)', background:'#1a1b28', color:'white', fontSize:13, outline:'none' }}/>
                </div>
                <div>
                  <label style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,.4)', textTransform:'uppercase', letterSpacing:'.08em', display:'block', marginBottom:6 }}>Command-Präfix</label>
                  <input value={pubCommandPrefix} onChange={e => setPubCommandPrefix(e.target.value)}
                    style={{ width:'100%', padding:'10px 12px', borderRadius:9, border:'1px solid rgba(255,255,255,.12)', background:'#1a1b28', color:'white', fontSize:13, outline:'none', fontFamily:'monospace' }}/>
                </div>
              </div>

              {/* Optionale Links */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,.4)', textTransform:'uppercase', letterSpacing:'.08em', display:'block', marginBottom:6 }}>Support-URL</label>
                  <input value={pubSupportUrl} onChange={e => setPubSupportUrl(e.target.value)}
                    placeholder="https://..."
                    style={{ width:'100%', padding:'10px 12px', borderRadius:9, border:'1px solid rgba(255,255,255,.12)', background:'#1a1b28', color:'white', fontSize:13, outline:'none' }}/>
                </div>
                <div>
                  <label style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,.4)', textTransform:'uppercase', letterSpacing:'.08em', display:'block', marginBottom:6 }}>Webhook-URL</label>
                  <input value={pubWebhookUrl} onChange={e => setPubWebhookUrl(e.target.value)}
                    placeholder="https://..."
                    style={{ width:'100%', padding:'10px 12px', borderRadius:9, border:'1px solid rgba(255,255,255,.12)', background:'#1a1b28', color:'white', fontSize:13, outline:'none' }}/>
                </div>
              </div>

              {pubMsg && (
                <div style={{ padding:'10px 14px', borderRadius:9, fontSize:13, background:pubMsg.startsWith('✅')?'rgba(34,197,94,.08)':'rgba(239,68,68,.08)', color:pubMsg.startsWith('✅')?'#4ade80':'#f87171' }}>
                  {pubMsg}
                </div>
              )}

              <div style={{ display:'flex', gap:8, paddingTop:4 }}>
                <button onClick={submitPublish} disabled={pubSaving}
                  style={{ flex:1, padding:'12px', borderRadius:10, border:'none', cursor:'pointer', fontWeight:700, fontSize:14, background:'linear-gradient(135deg,#b46a0e,#e8b86d)', color:'white', opacity:pubSaving?0.6:1 }}>
                  {pubSaving ? '⏳ Wird veröffentlicht...' : '🚀 Jetzt veröffentlichen'}
                </button>
                <button onClick={() => setPublishBot(null)}
                  style={{ padding:'12px 20px', borderRadius:10, border:'none', cursor:'pointer', fontWeight:700, fontSize:14, background:'rgba(255,255,255,.06)', color:'white' }}>
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

export default DevBots
