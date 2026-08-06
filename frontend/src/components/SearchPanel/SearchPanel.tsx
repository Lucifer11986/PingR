import { useState, useRef } from 'react'
import { useChatStore } from '../../store/chatStore'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import type { Message } from '../../types'

interface Props { onClose: () => void }

export default function SearchPanel({ onClose }: Props) {
  const { conversations, searchMessages, setActiveConversation } = useChatStore()
  const [q, setQ]             = useState('')
  const [results, setResults] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>()

  const handleInput = (val: string) => {
    setQ(val)
    clearTimeout(timer.current)
    if (val.length < 2) { setResults([]); setSearched(false); return }
    timer.current = setTimeout(async () => {
      setLoading(true)
      const res = await searchMessages(val)
      setResults(res)
      setSearched(true)
      setLoading(false)
    }, 400)
  }

  const getConvName = (convId: string) => {
    const conv = conversations.find(c => c._id === convId)
    if (!conv) return 'Unbekannt'
    return conv.isGroup ? (conv.groupName || 'Gruppe') : (conv.participants[0]?.username || 'Chat')
  }

  const goToMessage = (msg: Message) => {
    setActiveConversation(msg.conversationId)
    onClose()
  }

  const highlightedContent = (content: string) => {
    if (!q) return content
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const matcher = new RegExp(`(${escaped})`, 'gi')
    return content.split(matcher).map((part, index) =>
      part.toLocaleLowerCase() === q.toLocaleLowerCase()
        ? <mark key={index} style={{ background:'rgba(79,110,247,0.4)', color:'white', borderRadius:2, padding:'0 2px' }}>{part}</mark>
        : part
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center pt-20 px-4" onClick={onClose}>
      <div className="bg-[#13131f] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
          <span>🔍</span>
          <input autoFocus value={q} onChange={e => handleInput(e.target.value)}
            className="flex-1 bg-transparent text-white placeholder-white/30 outline-none text-sm"
            placeholder="Nachrichten durchsuchen…" />
          {loading && <span className="text-white/30 text-xs animate-pulse">Suche…</span>}
          <button onClick={onClose} className="text-white/40 hover:text-white text-xl leading-none">✕</button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {!searched && (
            <div className="text-center py-10 text-white/30">
              <div className="text-4xl mb-3">🔍</div>
              <p className="text-sm">Mindestens 2 Zeichen eingeben</p>
            </div>
          )}
          {searched && results.length === 0 && (
            <div className="text-center py-10 text-white/30">
              <div className="text-4xl mb-3">😶</div>
              <p className="text-sm">Keine Nachrichten für „{q}"</p>
            </div>
          )}
          {results.map(msg => (
            <button key={msg._id} onClick={() => goToMessage(msg)}
              className="w-full flex items-start gap-3 px-4 py-3 hover:bg-white/5 text-left border-b border-white/5 last:border-0">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                {msg.sender.username[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between gap-2">
                  <span className="text-sm font-semibold">{msg.sender.username}</span>
                  <span className="text-xs text-white/30">{format(new Date(msg.createdAt),'dd.MM. HH:mm',{locale:de})}</span>
                </div>
                <p className="text-xs text-white/40 mt-0.5 truncate">{getConvName(msg.conversationId)}</p>
                <p className="text-sm text-white/80 mt-1">{highlightedContent(msg.content)}</p>
              </div>
            </button>
          ))}
        </div>
        {results.length > 0 && (
          <div className="px-4 py-2 border-t border-white/10 text-xs text-white/30 text-center">
            {results.length} Ergebnis{results.length !== 1 ? 'se' : ''}
          </div>
        )}
      </div>
    </div>
  )
}
