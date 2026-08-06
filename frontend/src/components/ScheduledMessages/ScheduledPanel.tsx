import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import api from '../../services/api'

interface ScheduledMsg {
  _id:          string
  content:      string
  scheduledFor: string
  conversationId: { _id: string; groupName?: string; participants?: unknown[] }
}

interface Props {
  conversationId: string
  onClose:        () => void
}

export default function ScheduledPanel({ conversationId, onClose }: Props) {
  const [msgs, setMsgs]       = useState<ScheduledMsg[]>([])
  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState('')
  const [when, setWhen]       = useState('')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  useEffect(() => {
    api.get('/api/users/scheduled').then(r => {
      setMsgs(r.data.filter((m: ScheduledMsg) =>
        typeof m.conversationId === 'string'
          ? m.conversationId === conversationId
          : m.conversationId?._id === conversationId
      ))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [conversationId])

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!content.trim() || !when) { setError('Inhalt und Zeitpunkt erforderlich'); return }
    setSaving(true)
    try {
      const { data } = await api.post('/api/users/scheduled', {
        conversationId, content: content.trim(),
        scheduledFor: new Date(when).toISOString(),
      })
      setMsgs(m => [...m, data])
      setContent(''); setWhen('')
    } catch (_err) {
      setError('Fehler beim Planen')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    await api.delete(`/api/users/scheduled/${id}`)
    setMsgs(m => m.filter(msg => msg._id !== id))
  }

  // Mindest-Datetime = jetzt + 1 Minute
  const minDate = new Date(Date.now() + 60000).toISOString().slice(0, 16)

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}>
      <div className="bg-[#13131f] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h2 className="font-bold">⏰ Geplante Nachrichten</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white text-xl">✕</button>
        </div>

        <div className="p-5 space-y-4">
          {/* Neue geplante Nachricht */}
          <form onSubmit={handleSchedule} className="space-y-3">
            <textarea value={content} onChange={e => setContent(e.target.value)}
              className="input-field resize-none text-sm" rows={2}
              placeholder="Nachricht eingeben…" maxLength={500} />
            <div>
              <label className="block text-white/60 text-xs mb-1">Zeitpunkt</label>
              <input type="datetime-local" value={when} onChange={e => setWhen(e.target.value)}
                className="input-field" min={minDate} style={{ colorScheme: 'dark' }} />
            </div>
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <button type="submit" disabled={saving || !content.trim() || !when}
              className="btn-primary w-full text-sm disabled:opacity-50">
              {saving ? 'Planen…' : '⏰ Nachricht planen'}
            </button>
          </form>

          {/* Bestehende geplante Nachrichten */}
          {msgs.length > 0 && (
            <div>
              <p className="text-xs text-white/40 mb-2 uppercase tracking-wider font-semibold">
                Geplant ({msgs.length})
              </p>
              <div className="space-y-2">
                {msgs.map(msg => (
                  <div key={msg._id}
                    className="flex items-start gap-3 p-3 bg-white/5 border border-white/10 rounded-xl">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white/80 truncate">{msg.content}</p>
                      <p className="text-xs text-white/40 mt-1">
                        ⏰ {format(new Date(msg.scheduledFor), 'dd.MM.yyyy HH:mm', { locale: de })}
                      </p>
                    </div>
                    <button onClick={() => handleDelete(msg._id)}
                      className="text-white/20 hover:text-red-400 transition-colors text-sm flex-shrink-0">
                      🗑
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {loading && <p className="text-white/30 text-sm text-center">Lade…</p>}
          {!loading && msgs.length === 0 && (
            <p className="text-white/30 text-xs text-center">Keine geplanten Nachrichten für diesen Chat</p>
          )}
        </div>
      </div>
    </div>
  )
}