import { useState } from 'react'
import api from '../../services/api'
import { useAuthStore } from '../../store/authStore'

interface PollOption { text: string; votes: string[] }
interface PollData {
  _id: string; question: string; options: PollOption[]
  multipleChoice: boolean; endsAt?: string
  createdBy: { username: string }
}

export default function PollView({ poll: initialPoll }: { poll: PollData }) {
  const [poll, setPoll] = useState(initialPoll)
  const user = useAuthStore(s => s.user)
  const total = poll.options.reduce((s, o) => s + o.votes.length, 0)
  const isEnded = poll.endsAt ? new Date(poll.endsAt) < new Date() : false
  const hasVoted = poll.options.some(o => o.votes.includes(user?._id || ''))

  const vote = async (idx: number) => {
    if (isEnded) return
    try {
      const { data } = await api.post(`/api/polls/${poll._id}/vote`, { optionIndexes: [idx] })
      setPoll(data)
    } catch (_err) {}
  }

  return (
    <div style={{ background: 'rgba(79,110,247,0.08)', border: '1px solid rgba(79,110,247,0.25)', borderRadius: '12px', padding: '12px 14px', maxWidth: '300px' }}>
      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px', display: 'flex', justifyContent: 'space-between' }}>
        <span>📊 Umfrage von {poll.createdBy?.username}</span>
        {isEnded && <span style={{ color: '#f87171' }}>Beendet</span>}
      </div>

      <p style={{ fontWeight: 600, fontSize: '13px', marginBottom: '10px', lineHeight: 1.4 }}>
        {poll.question}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {poll.options.map((opt, idx) => {
          const pct = total > 0 ? Math.round(opt.votes.length / total * 100) : 0
          const voted = opt.votes.includes(user?._id || '')

          return (
            <button key={idx} onClick={() => vote(idx)} disabled={isEnded}
              style={{
                position: 'relative', background: 'none', border: `1px solid ${voted ? 'rgba(79,110,247,0.6)' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: '8px', padding: '7px 10px', cursor: isEnded ? 'default' : 'pointer',
                textAlign: 'left', overflow: 'hidden', color: 'white',
              }}>
              {/* Progress Bar */}
              <div style={{
                position: 'absolute', left: 0, top: 0, height: '100%', width: `${pct}%`,
                background: voted ? 'rgba(79,110,247,0.25)' : 'rgba(255,255,255,0.05)',
                transition: 'width 0.4s ease',
              }} />
              <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                <span>{voted && '✓ '}{opt.text}</span>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px' }}>{pct}%</span>
              </div>
            </button>
          )
        })}
      </div>

      <div style={{ marginTop: '8px', fontSize: '10px', color: 'rgba(255,255,255,0.3)', display: 'flex', justifyContent: 'space-between' }}>
        <span>{total} Stimme{total !== 1 ? 'n' : ''}</span>
        {poll.endsAt && !isEnded && (
          <span>Endet {new Date(poll.endsAt).toLocaleDateString('de-DE')}</span>
        )}
        {poll.multipleChoice && <span>Mehrfachauswahl</span>}
      </div>
    </div>
  )
}