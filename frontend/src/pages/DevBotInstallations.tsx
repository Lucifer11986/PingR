import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import DevSidebar from './DevSidebar'
import { devFetch } from '../services/devApi'

interface Installation {
  _id: string; botId: string; channelId: string
  channelName: string; channelType: 'channel' | 'group' | 'dm' | 'nokki_channel'
  installedAt: string; active: boolean
}
interface Bot { id: string; name: string; botId: string }
interface ScheduledMessage {
  _id: string; message: string; scheduleType: string
  nextRunAt: string; status: string
  conversationId: { groupName: string }
}

const tk = () => localStorage.getItem('nokki_dev_token') || ''

const inp: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: '8px',
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
  color: '#f1f0f8', fontSize: '14px', outline: 'none', boxSizing: 'border-box'
}

const DevBotInstallations: React.FC = () => {
  const { botId } = useParams<{ botId: string }>()
  const navigate  = useNavigate()

  const [bot, setBot]                         = useState<Bot | null>(null)
  const [installations, setInstallations]     = useState<Installation[]>([])
  const [scheduled, setScheduled]             = useState<ScheduledMessage[]>([])
  const [loading, setLoading]                 = useState(true)
  const [toast, setToast]                     = useState('')

  // Test Modal
  const [showTest, setShowTest]               = useState(false)
  const [testChannelId, setTestChannelId]     = useState('')
  const [testMsg, setTestMsg]                 = useState('')
  const [sending, setSending]                 = useState(false)

  // Timer Modal
  const [showTimer, setShowTimer]             = useState(false)
  const [timerChannelId, setTimerChannelId]   = useState('')
  const [timerMsg, setTimerMsg]               = useState('')
  const [scheduleType, setScheduleType]       = useState<'once'|'daily'|'weekly'|'monthly'>('once')
  const [schedDate, setSchedDate]             = useState('')
  const [schedTime, setSchedTime]             = useState('09:00')
  const [dayOfWeek, setDayOfWeek]             = useState(1)
  const [dayOfMonth, setDayOfMonth]           = useState(1)

  useEffect(() => { if (botId) { load(); loadScheduled() } }, [botId])

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const load = async () => {
    setLoading(true)
    try {
      const [botsRes, instRes] = await Promise.all([
        devFetch('/api/dev/bots', { headers: { Authorization: `Bearer ${tk()}` } }),
        devFetch(`/api/bot-install/bot/${botId}`, { headers: { Authorization: `Bearer ${tk()}` } }),
      ])
      const botsData = await botsRes.json()
      const instData = await instRes.json()
      setBot(botsData.bots?.find((b: any) => b.botId === botId) || null)
      setInstallations(instData.installations || [])
    } catch {} finally { setLoading(false) }
  }

  const loadScheduled = async () => {
    try {
      const r = await devFetch(`/api/bot-scheduler/bot/${botId}`, { headers: { Authorization: `Bearer ${tk()}` } })
      const d = await r.json()
      setScheduled(d.scheduled || [])
    } catch {}
  }

  const uninstall = async (id: string, name: string) => {
    if (!confirm(`Bot wirklich aus "${name}" entfernen?`)) return
    await devFetch(`/api/bot-install/uninstall/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${tk()}` } })
    load()
  }

  const sendTest = async () => {
    if (!testMsg.trim()) { showToast('Nachricht eingeben'); return }
    setSending(true)
    try {
      const r = await devFetch('/api/bot-test/send', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tk()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ botId, channelId: testChannelId, message: testMsg })
      })
      const d = await r.json()
      if (r.ok) { showToast('Test-Nachricht gesendet!'); setShowTest(false); setTestMsg('') }
      else showToast('Fehler: ' + (d.error || 'Unbekannt'))
    } catch { showToast('Verbindungsfehler') } finally { setSending(false) }
  }

  const scheduleTimer = async () => {
    if (!timerMsg.trim()) { showToast('Nachricht eingeben'); return }
    setSending(true)
    try {
      const payload: any = { botId, conversationId: timerChannelId, message: timerMsg, scheduleType }
      if (scheduleType === 'once') {
        if (!schedDate) { showToast('Datum auswählen'); setSending(false); return }
        payload.scheduledFor = new Date(`${schedDate}T${schedTime}`).toISOString()
      } else {
        payload.repeat = { enabled: true, interval: scheduleType, time: schedTime }
        if (scheduleType === 'weekly') payload.repeat.dayOfWeek = dayOfWeek
        if (scheduleType === 'monthly') payload.repeat.dayOfMonth = dayOfMonth
      }
      const r = await devFetch('/api/bot-scheduler/schedule', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tk()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const d = await r.json()
      if (r.ok) { showToast('Timer-Nachricht geplant!'); setShowTimer(false); setTimerMsg(''); setSchedDate(''); loadScheduled() }
      else showToast('Fehler: ' + (d.error || 'Unbekannt'))
    } catch { showToast('Verbindungsfehler') } finally { setSending(false) }
  }

  const cancelScheduled = async (id: string) => {
    if (!confirm('Timer-Nachricht wirklich abbrechen?')) return
    await devFetch(`/api/bot-scheduler/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${tk()}` } })
    loadScheduled()
  }

  const copyInstallLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/install-bot?bot_id=${botId}`)
    showToast('Installations-Link kopiert!')
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#08090f', color: '#f1f0f8' }}>
      <DevSidebar active="bots" />

      <div style={{ flex: 1, padding: '32px', overflowY: 'auto', maxHeight: '100vh' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '28px', flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/dev-bots')} style={{ padding: '8px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#8b8aa8', cursor: 'pointer', fontSize: '13px' }}>
            Zurueck
          </button>
          <div>
            <h1 style={{ fontSize: '26px', fontWeight: 900, marginBottom: '4px' }}>
              {bot?.name || 'Bot'} — Installationen
            </h1>
            <div style={{ color: '#8b8aa8', fontSize: '13px' }}>
              Bot ID: <code style={{ background: 'rgba(232,184,109,0.12)', color: '#e8b86d', padding: '1px 7px', borderRadius: '4px' }}>{botId}</code>
            </div>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <button onClick={copyInstallLink} style={{ padding: '9px 18px', borderRadius: '8px', background: 'rgba(232,184,109,0.1)', border: '1px solid rgba(232,184,109,0.25)', color: '#e8b86d', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
              Installations-Link kopieren
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px', color: '#8b8aa8' }}>
            <div style={{ width: '36px', height: '36px', border: '3px solid #b46a0e', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            Lade Installationen...
          </div>
        ) : installations.length === 0 ? (
          <div style={{ background: '#0d0f18', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '80px', textAlign: 'center' }}>
            <div style={{ fontSize: '56px', marginBottom: '16px' }}>🤖</div>
            <h3 style={{ fontSize: '20px', marginBottom: '8px' }}>Bot noch nicht installiert</h3>
            <p style={{ color: '#8b8aa8', marginBottom: '24px', fontSize: '14px', maxWidth: '400px', margin: '0 auto 24px', lineHeight: 1.7 }}>
              Teile den Installations-Link mit einem Gruppen-Admin oder Channel-Owner um den Bot zu installieren.
            </p>
            <button onClick={copyInstallLink} style={{ padding: '12px 28px', borderRadius: '8px', background: 'linear-gradient(135deg,#b46a0e,#e8b86d)', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
              Installations-Link kopieren
            </button>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '12px', marginBottom: '24px' }}>
              {[
                { label: 'Installationen', value: installations.length, color: '#22c55e' },
                { label: 'Geplante Nachrichten', value: scheduled.length, color: '#8b5cf6' },
                { label: 'Aktiv', value: installations.filter(i => i.active).length, color: '#3b82f6' },
              ].map((s, i) => (
                <div key={i} style={{ background: '#0d0f18', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '16px' }}>
                  <div style={{ fontSize: '10px', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase' as const, marginBottom: '6px' }}>{s.label}</div>
                  <div style={{ fontSize: '22px', fontWeight: 900, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Geplante Nachrichten */}
            {scheduled.length > 0 && (
              <div style={{ background: '#0d0f18', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '14px', color: '#a78bfa' }}>
                  Geplante Nachrichten ({scheduled.length})
                </h3>
                <div style={{ display: 'grid', gap: '10px' }}>
                  {scheduled.map(msg => (
                    <div key={msg._id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: '200px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>{msg.message}</div>
                        <div style={{ fontSize: '11px', color: '#8b8aa8' }}>
                          {msg.scheduleType} · Naechste: {new Date(msg.nextRunAt).toLocaleString('de-DE')}
                        </div>
                      </div>
                      <span style={{ padding: '2px 8px', borderRadius: '5px', fontSize: '11px', background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>{msg.status}</span>
                      <button onClick={() => cancelScheduled(msg._id)} style={{ padding: '6px 12px', borderRadius: '6px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', cursor: 'pointer', fontSize: '11px' }}>
                        Abbrechen
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Installationen */}
            <div style={{ display: 'grid', gap: '14px' }}>
              {installations.map(inst => (
                <div key={inst._id} style={{ background: '#0d0f18', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '18px 22px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: inst.channelType === 'group' ? 'rgba(79,110,247,0.12)' : inst.channelType === 'nokki_channel' ? 'rgba(30,64,175,0.15)' : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>
                      {inst.channelType === 'group' ? '👥' : inst.channelType === 'nokki_channel' ? '📢' : '#'}
                    </div>
                    <div style={{ flex: 1, minWidth: '140px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '15px', fontWeight: 700 }}>{inst.channelName}</span>
                        <span style={{ padding: '2px 8px', borderRadius: '99px', fontSize: '10px', fontWeight: 700, background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>Aktiv</span>
                        <span style={{ fontSize: '11px', color: '#6b7280' }}>
                          {inst.channelType === 'group' ? '👥 Gruppe' : inst.channelType === 'nokki_channel' ? '📢 Channel' : inst.channelType}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>
                        Installiert: {new Date(inst.installedAt).toLocaleString('de-DE')}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button onClick={() => { setTestChannelId(inst.channelId); setShowTest(true) }} style={{ padding: '7px 14px', borderRadius: '7px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', color: '#93c5fd', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
                        Test senden
                      </button>
                      <button onClick={() => { setTimerChannelId(inst.channelId); setShowTimer(true) }} style={{ padding: '7px 14px', borderRadius: '7px', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)', color: '#a78bfa', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
                        Timer planen
                      </button>
                      <button onClick={() => uninstall(inst._id, inst.channelName)} style={{ padding: '7px 12px', borderRadius: '7px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', cursor: 'pointer', fontSize: '12px' }}>
                        Entfernen
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Test Modal */}
      {showTest && (
        <div onClick={() => setShowTest(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#13141f', borderRadius: '16px', padding: '28px', maxWidth: '480px', width: '100%', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800 }}>Test-Nachricht senden</h2>
              <button onClick={() => setShowTest(false)} style={{ background: 'none', border: 'none', color: '#8b8aa8', fontSize: '22px', cursor: 'pointer' }}>x</button>
            </div>
            <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '8px', padding: '10px', marginBottom: '16px', fontSize: '12px', color: '#93c5fd' }}>
              Die Nachricht wird direkt in der Gruppe oder dem Channel gepostet um zu prüfen ob der Bot korrekt installiert ist.
            </div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Nachricht</label>
            <textarea value={testMsg} onChange={e => setTestMsg(e.target.value)} placeholder="z.B. Hallo, ich bin ein Test!" rows={3} style={{ ...inp, resize: 'vertical' as const, marginBottom: '20px' }} />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowTest(false)} style={{ flex: 1, padding: '10px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f1f0f8', cursor: 'pointer' }}>Abbrechen</button>
              <button onClick={sendTest} disabled={sending} style={{ flex: 1, padding: '10px', borderRadius: '8px', background: 'linear-gradient(135deg,#b46a0e,#e8b86d)', border: 'none', color: '#fff', cursor: sending ? 'not-allowed' : 'pointer', fontWeight: 700, opacity: sending ? 0.7 : 1 }}>
                {sending ? 'Sendet...' : 'Senden'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Timer Modal */}
      {showTimer && (
        <div onClick={() => setShowTimer(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#13141f', borderRadius: '16px', padding: '28px', maxWidth: '520px', width: '100%', border: '1px solid rgba(255,255,255,0.08)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800 }}>Timer-Nachricht planen</h2>
              <button onClick={() => setShowTimer(false)} style={{ background: 'none', border: 'none', color: '#8b8aa8', fontSize: '22px', cursor: 'pointer' }}>x</button>
            </div>
            <div style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '8px', padding: '10px', marginBottom: '16px', fontSize: '12px', color: '#a78bfa' }}>
              Der Bot sendet diese Nachricht automatisch zum geplanten Zeitpunkt in die Gruppe oder den Channel.
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Nachricht</label>
              <textarea value={timerMsg} onChange={e => setTimerMsg(e.target.value)} placeholder="z.B. Guten Morgen Team!" rows={3} style={{ ...inp, resize: 'vertical' as const }} />
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Zeitplan</label>
              <select value={scheduleType} onChange={e => setScheduleType(e.target.value as any)} style={{ ...inp }}>
                <option value="once">Einmalig</option>
                <option value="daily">Taeglich</option>
                <option value="weekly">Woechentlich</option>
                <option value="monthly">Monatlich</option>
              </select>
            </div>
            {scheduleType === 'once' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Datum</label>
                  <input type="date" value={schedDate} onChange={e => setSchedDate(e.target.value)} style={inp} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Uhrzeit</label>
                  <input type="time" value={schedTime} onChange={e => setSchedTime(e.target.value)} style={inp} />
                </div>
              </div>
            )}
            {scheduleType === 'daily' && (
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Uhrzeit (jeden Tag)</label>
                <input type="time" value={schedTime} onChange={e => setSchedTime(e.target.value)} style={inp} />
              </div>
            )}
            {scheduleType === 'weekly' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Wochentag</label>
                  <select value={dayOfWeek} onChange={e => setDayOfWeek(Number(e.target.value))} style={inp}>
                    {['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'].map((d,i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Uhrzeit</label>
                  <input type="time" value={schedTime} onChange={e => setSchedTime(e.target.value)} style={inp} />
                </div>
              </div>
            )}
            {scheduleType === 'monthly' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Tag (1-31)</label>
                  <input type="number" min={1} max={31} value={dayOfMonth} onChange={e => setDayOfMonth(Number(e.target.value))} style={inp} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Uhrzeit</label>
                  <input type="time" value={schedTime} onChange={e => setSchedTime(e.target.value)} style={inp} />
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button onClick={() => setShowTimer(false)} style={{ flex: 1, padding: '10px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f1f0f8', cursor: 'pointer' }}>Abbrechen</button>
              <button onClick={scheduleTimer} disabled={sending} style={{ flex: 1, padding: '10px', borderRadius: '8px', background: 'linear-gradient(135deg,#7c3aed,#a855f7)', border: 'none', color: '#fff', cursor: sending ? 'not-allowed' : 'pointer', fontWeight: 700, opacity: sending ? 0.7 : 1 }}>
                {sending ? 'Plant...' : 'Planen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '12px 20px', fontSize: '13px', zIndex: 9999, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
          {toast}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

export default DevBotInstallations
