import { useState, useEffect } from 'react'
import api from '../../services/api'

interface GiveawayModalProps {
  isOpen: boolean
  onClose: () => void
  conversationId: string
  onSubmit: (data: GiveawayData) => void
  currentUserId?: string
}

interface GiveawayData {
  prize: string
  description: string
  duration: number
  winners: number
  requirements: string
}

interface ActiveGiveaway {
  _id: string
  prize: string
  description: string
  duration: number
  winnersCount: number
  requirements: string
  endsAt: string
  participants: any[]
  winners: any[]
  status: 'active' | 'completed' | 'ended' | 'cancelled'
  createdBy: string
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 5) return 'gerade eben'
  if (diff < 60) return `${diff} Sek. zuvor`
  if (diff < 3600) return `${Math.floor(diff / 60)} Min. zuvor`
  return `${Math.floor(diff / 3600)} Std. zuvor`
}

function formatCountdown(endsAt: string): string {
  const diff = new Date(endsAt).getTime() - Date.now()
  if (diff <= 0) return 'Beendet'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

export default function GiveawayModal({ isOpen, onClose, conversationId, onSubmit, currentUserId }: GiveawayModalProps) {
  const [activeGiveaway, setActiveGiveaway] = useState<ActiveGiveaway | null>(null)
  const [loading, setLoading]       = useState(true)
  const [countdown, setCountdown]   = useState('')
  const [tick, setTick]             = useState(0)
  const [joining, setJoining]       = useState(false)
  const [drawLoading, setDrawLoading] = useState(false)

  const [formData, setFormData] = useState<GiveawayData>({
    prize: '', description: '', duration: 60, winners: 1,
    requirements: 'Klicke auf "Teilnehmen" um mitzumachen'
  })

  useEffect(() => {
    if (isOpen) loadActiveGiveaway()
  }, [isOpen, conversationId])

  // Live-Update: wenn giveaway_updated Socket-Event kommt
  useEffect(() => {
    if (!isOpen) return
    const handler = () => loadActiveGiveaway()
    window.addEventListener('giveaway_refresh', handler)
    return () => window.removeEventListener('giveaway_refresh', handler)
  }, [isOpen, conversationId])

  useEffect(() => {
    if (activeGiveaway?.status === 'active') {
      setCountdown(formatCountdown(activeGiveaway.endsAt))
      const interval = setInterval(() => {
        setCountdown(formatCountdown(activeGiveaway.endsAt))
        setTick(t => t + 1)
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [activeGiveaway])

  const loadActiveGiveaway = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/api/giveaways?conversationId=${conversationId}`)
      setActiveGiveaway(res.data.giveaway || null)
    } catch {
      setActiveGiveaway(null)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  const handleJoin = async () => {
    if (!activeGiveaway) return
    setJoining(true)
    try {
      await api.post(`/api/giveaways/${activeGiveaway._id}/participate`)
      await loadActiveGiveaway()
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Fehler beim Teilnehmen')
    } finally {
      setJoining(false)
    }
  }

  const handleDraw = async () => {
    if (!activeGiveaway) return
    setDrawLoading(true)
    try {
      await api.post(`/api/giveaways/${activeGiveaway._id}/draw`)
      await loadActiveGiveaway()
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Fehler beim Ziehen')
    } finally {
      setDrawLoading(false)
    }
  }

  const handleCancel = async () => {
    if (!activeGiveaway || !confirm('Giveaway wirklich abbrechen?')) return
    try {
      await api.delete(`/api/giveaways/${activeGiveaway._id}`)
      await loadActiveGiveaway()
    } catch {}
  }

  const handleReset = () => {
    setActiveGiveaway(null)
    setFormData({ prize: '', description: '', duration: 60, winners: 1, requirements: 'Klicke auf "Teilnehmen" um mitzumachen' })
  }

  const isParticipating = currentUserId
    ? activeGiveaway?.participants?.some((p: any) => {
        const id = typeof p === 'string' ? p : (p.userId || p._id || p)
        return id?.toString() === currentUserId
      })
    : false

  if (!isOpen) return null

  const inp: React.CSSProperties = {
    width: '100%', padding: '10px 14px',
    backgroundColor: '#1e1e30',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px', color: '#fff', fontSize: '14px',
    outline: 'none', boxSizing: 'border-box',
  }
  const card: React.CSSProperties = {
    backgroundColor: '#1a1a2e', borderRadius: '12px',
    padding: '14px', border: '1px solid rgba(255,255,255,0.07)',
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: '#12121e',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '16px',
          boxShadow: '0 32px 64px rgba(0,0,0,0.6)',
          width: '100%',
          maxWidth: activeGiveaway ? '860px' : '480px',
          maxHeight: '88vh',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* HEADER */}
        <div style={{ background: 'linear-gradient(135deg,#7c3aed,#2563eb)', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '22px' }}>🎉</span>
            <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '17px' }}>
              {activeGiveaway ? 'Giveaway Live' : 'Giveaway erstellen'}
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: '24px', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        {/* BODY */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '48px', color: '#9ca3af' }}>
              <div style={{ width: '36px', height: '36px', border: '3px solid #7c3aed', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
              Lädt...
            </div>

          ) : activeGiveaway ? (

            /* ── ZWEI-SPALTEN LAYOUT ── */
            <div style={{ display: 'flex', minHeight: '420px' }}>

              {/* LINKE SPALTE: Teilnehmerliste */}
              <div style={{ width: '260px', flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.07)', padding: '16px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                    <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '14px' }}>Live Teilnehmer</span>
                    {activeGiveaway.status === 'active' && (
                      <span style={{ backgroundColor: '#22c55e', color: '#fff', fontSize: '10px', fontWeight: 'bold', padding: '1px 7px', borderRadius: '999px' }}>LIVE</span>
                    )}
                  </div>
                  <div style={{ color: '#6b7280', fontSize: '12px' }}>{activeGiveaway.participants.length} Teilnehmer</div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {activeGiveaway.participants.length === 0 ? (
                    <div style={{ color: '#6b7280', fontSize: '13px', textAlign: 'center', paddingTop: '20px' }}>Noch keine Teilnehmer</div>
                  ) : (
                    [...activeGiveaway.participants].reverse().map((p: any, i) => {
                      const name = p.username || `User ${i + 1}`
                      const joinedAt = p.joinedAt || new Date().toISOString()
                      const isWinner = activeGiveaway.winners?.some((w: any) => {
                        const wId = typeof w === 'string' ? w : (w._id || w.userId || w)
                        const pId = typeof p === 'string' ? p : (p.userId || p._id || p)
                        return wId?.toString() === pId?.toString()
                      })
                      return (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '7px 9px', borderRadius: '8px',
                          backgroundColor: isWinner ? 'rgba(234,179,8,0.1)' : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${isWinner ? 'rgba(234,179,8,0.3)' : 'transparent'}`,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                            <div style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: '#2d2d4e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: '#fff', fontWeight: 'bold', flexShrink: 0 }}>
                              {isWinner ? '🏆' : name.charAt(0).toUpperCase()}
                            </div>
                            <span style={{ color: isWinner ? '#fbbf24' : '#e5e7eb', fontSize: '13px', fontWeight: isWinner ? 'bold' : 'normal' }}>{name}</span>
                          </div>
                          <span style={{ color: '#6b7280', fontSize: '11px' }}>{timeAgo(joinedAt)}</span>
                        </div>
                      )
                    })
                  )}
                </div>

                <div style={{ paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.07)', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: activeGiveaway.status === 'active' ? '#22c55e' : '#6b7280' }} />
                  <span style={{ color: '#6b7280', fontSize: '11px' }}>{activeGiveaway.status === 'active' ? 'Echtzeit Updates aktiv' : 'Giveaway beendet'}</span>
                </div>
              </div>

              {/* RECHTE SPALTE: Details */}
              <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto' }}>

                {/* Preis Card */}
                <div style={card}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <span style={{ fontSize: '36px', flexShrink: 0 }}>🎁</span>
                    <div>
                      <div style={{ color: '#6b7280', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>PREIS</div>
                      <div style={{ color: '#fff', fontSize: '17px', fontWeight: 'bold' }}>{activeGiveaway.prize}</div>
                      {activeGiveaway.description && <div style={{ color: '#9ca3af', fontSize: '13px', marginTop: '3px' }}>{activeGiveaway.description}</div>}
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '8px' }}>
                  {[
                    { label: 'STATUS', val: activeGiveaway.status === 'active' ? '🟢 Läuft' : activeGiveaway.status === 'completed' || activeGiveaway.status === 'ended' ? '✅ Beendet' : '❌ Abgebrochen' },
                    { label: 'ENDET IN', val: activeGiveaway.status === 'active' ? countdown : '—' },
                    { label: 'TEILNEHMER', val: String(activeGiveaway.participants.length) },
                    { label: 'GEWINNER', val: activeGiveaway.winners?.length > 0 ? `${activeGiveaway.winners.length} gezogen` : `${activeGiveaway.winnersCount} geplant` },
                  ].map((s,i) => (
                    <div key={i} style={{ ...card, textAlign: 'center', padding: '10px 8px' }}>
                      <div style={{ color: '#6b7280', fontSize: '10px', fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px' }}>{s.label}</div>
                      <div style={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}>{s.val}</div>
                    </div>
                  ))}
                </div>

                {/* Teilnahmebedingungen */}
                <div style={card}>
                  <div style={{ color: '#fff', fontWeight: 'bold', fontSize: '13px', marginBottom: '8px' }}>Teilnahmebedingungen</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#d1d5db', fontSize: '13px' }}>
                    <span>✅</span><span>{activeGiveaway.requirements}</span>
                  </div>
                </div>

                {/* Gewinner */}
                {activeGiveaway.winners?.length > 0 && (
                  <div style={{ backgroundColor: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.25)', borderRadius: '12px', padding: '14px' }}>
                    <div style={{ color: '#fbbf24', fontWeight: 'bold', fontSize: '13px', marginBottom: '8px' }}>🏆 Gewinner</div>
                    {activeGiveaway.winners.map((w: any, i) => (
                      <div key={i} style={{ color: '#fde68a', fontSize: '15px', fontWeight: 'bold' }}>🎊 {w.username || w}</div>
                    ))}
                  </div>
                )}

                {/* Gewinner ziehen (nur Creator) */}
                {activeGiveaway.status === 'active' && (
                  <div style={card}>
                    <div style={{ color: '#fff', fontWeight: 'bold', fontSize: '13px', marginBottom: '4px' }}>Gewinner ziehen</div>
                    <div style={{ color: '#9ca3af', fontSize: '12px', marginBottom: '10px' }}>Der Gewinner wird automatisch im Chat angekündigt.</div>
                    <button onClick={handleDraw} disabled={drawLoading || activeGiveaway.participants.length === 0}
                      style={{ width: '100%', padding: '10px', background: activeGiveaway.participants.length === 0 ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg,#f59e0b,#d97706)', border: 'none', borderRadius: '10px', color: '#fff', fontWeight: 'bold', fontSize: '13px', cursor: activeGiveaway.participants.length === 0 ? 'not-allowed' : 'pointer', opacity: drawLoading ? 0.7 : 1 }}>
                      {drawLoading ? '⏳ Ziehe...' : `🏆 Gewinner ziehen (${activeGiveaway.participants.length} Teilnehmer)`}
                    </button>
                  </div>
                )}

                {/* Teilnehmen Button */}
                {activeGiveaway.status === 'active' && (
                  <button onClick={handleJoin} disabled={joining || !!isParticipating}
                    style={{ width: '100%', padding: '12px', background: isParticipating ? 'rgba(34,197,94,0.15)' : 'linear-gradient(135deg,#7c3aed,#2563eb)', border: isParticipating ? '1px solid rgba(34,197,94,0.3)' : 'none', borderRadius: '10px', color: '#fff', fontWeight: 'bold', fontSize: '14px', cursor: isParticipating ? 'default' : 'pointer', opacity: joining ? 0.7 : 1 }}>
                    {isParticipating ? '✅ Du nimmst bereits teil!' : joining ? '⏳ Beitreten...' : '🎉 Jetzt teilnehmen'}
                  </button>
                )}

                {/* Aktionen */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  {(activeGiveaway.status === 'completed' || activeGiveaway.status === 'ended' || activeGiveaway.status === 'cancelled') && (
                    <button onClick={handleReset} style={{ flex: 1, padding: '10px', background: 'linear-gradient(135deg,#7c3aed,#2563eb)', border: 'none', borderRadius: '10px', color: '#fff', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>
                      ➕ Neues Giveaway
                    </button>
                  )}
                  {activeGiveaway.status === 'active' && (<>
                    <button onClick={handleCancel} style={{ flex: 1, padding: '10px', backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px', color: '#f87171', cursor: 'pointer', fontSize: '13px' }}>
                      🗑️ Abbrechen
                    </button>
                    <button onClick={loadActiveGiveaway} style={{ flex: 1, padding: '10px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#9ca3af', cursor: 'pointer', fontSize: '13px' }}>
                      🔄 Aktualisieren
                    </button>
                  </>)}
                </div>

              </div>
            </div>

          ) : (
            /* ── ERSTELLEN FORMULAR ── */
            <form onSubmit={handleSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', color: '#fff', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>🏆 Hauptpreis *</label>
                <input type="text" value={formData.prize} required placeholder="z.B. PlayStation 5, 100€ Amazon Gutschein"
                  onChange={e => setFormData({...formData, prize: e.target.value})} style={inp} />
              </div>
              <div>
                <label style={{ display: 'block', color: '#fff', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>📝 Beschreibung</label>
                <textarea value={formData.description} rows={2} placeholder="Weitere Details..."
                  onChange={e => setFormData({...formData, description: e.target.value})} style={{...inp, resize:'none'}} />
              </div>
              <div>
                <label style={{ display: 'block', color: '#fff', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>✅ Teilnahmebedingungen</label>
                <input type="text" value={formData.requirements}
                  onChange={e => setFormData({...formData, requirements: e.target.value})} style={inp} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', color: '#fff', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>⏱️ Dauer (min)</label>
                  <input type="number" value={formData.duration} min={1} max={10080}
                    onChange={e => setFormData({...formData, duration: parseInt(e.target.value)||1})} style={inp} />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#fff', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>👥 Gewinner</label>
                  <input type="number" value={formData.winners} min={1} max={10}
                    onChange={e => setFormData({...formData, winners: parseInt(e.target.value)||1})} style={inp} />
                </div>
              </div>
              <div style={{ backgroundColor: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '10px', padding: '10px 14px', fontSize: '13px', color: '#93c5fd' }}>
                💡 Nach {formData.duration} Minuten werden automatisch {formData.winners} Gewinner gezogen!
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" onClick={onClose} style={{ flex: 1, padding: '11px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff', cursor: 'pointer' }}>
                  Abbrechen
                </button>
                <button type="submit" style={{ flex: 1, padding: '11px', background: 'linear-gradient(135deg,#7c3aed,#2563eb)', border: 'none', borderRadius: '10px', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>
                  🎉 Erstellen
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}