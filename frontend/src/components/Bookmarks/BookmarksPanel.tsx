import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import { useAuthStore } from '../../store/authStore'
import { useChatStore } from '../../store/chatStore'
import api from '../../services/api'
import type { Message } from '../../types'

interface Props { onClose: () => void }

export default function BookmarksPanel({ onClose }: Props) {
  const { setActiveConversation } = useChatStore()
  const [bookmarks, setBookmarks] = useState<Message[]>([])
  const [loading, setLoading]     = useState(true)
  const apiBase = import.meta.env.VITE_API_URL || ''

  useEffect(() => {
    api.get('/api/users/bookmarks').then(r => {
      setBookmarks(r.data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const removeBookmark = async (msgId: string) => {
    await api.post(`/api/users/bookmarks/${msgId}`)
    setBookmarks(b => b.filter(m => m._id !== msgId))
  }

  const goToChat = (msg: Message) => {
    setActiveConversation(msg.conversationId)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center pt-16 px-4"
      onClick={onClose}>
      <div className="bg-[#13131f] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl max-h-[70vh] flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h2 className="font-bold flex items-center gap-2">🔖 Lesezeichen</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white text-xl">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && <div className="text-center py-10 text-white/30 text-sm">Lade…</div>}

          {!loading && bookmarks.length === 0 && (
            <div className="text-center py-12 text-white/30">
              <div className="text-4xl mb-3">🔖</div>
              <p className="text-sm">Noch keine Lesezeichen</p>
              <p className="text-xs mt-1">Hover über eine Nachricht → 🔖</p>
            </div>
          )}

          {bookmarks.map(msg => (
            <div key={msg._id}
              className="flex items-start gap-3 px-5 py-3 hover:bg-white/5 border-b border-white/5 last:border-0">
              <div className="w-8 h-8 rounded-full bg-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                {msg.sender?.username?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => goToChat(msg)}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold">{msg.sender?.username}</span>
                  <span className="text-xs text-white/30">
                    {format(new Date(msg.createdAt), 'dd.MM. HH:mm', { locale: de })}
                  </span>
                </div>
                {msg.type === 'voice'
                  ? <p className="text-xs text-white/50 mt-0.5">🎤 Sprachnachricht</p>
                  : msg.type === 'image'
                    ? <p className="text-xs text-white/50 mt-0.5">🖼️ Bild</p>
                    : <p className="text-sm text-white/80 mt-0.5 truncate">{msg.content}</p>
                }
              </div>
              <button onClick={() => removeBookmark(msg._id)}
                className="text-white/20 hover:text-red-400 transition-colors flex-shrink-0 text-sm"
                title="Lesezeichen entfernen">
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}