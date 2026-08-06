import React, { useEffect, useRef, useState, useCallback } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { de } from 'date-fns/locale'
import { useAuthStore } from '../../store/authStore'
import { useChatStore } from '../../store/chatStore'
import { useContactStore } from '../../store/contactStore'
import { getSocket } from '../../services/socket'
import { useSound } from '../../hooks/useSound'
import MessageBubble from '../MessageBubble/MessageBubble'
import FileUpload from '../FileUpload/FileUpload'
import EmojiPicker from '../EmojiPicker/EmojiPicker'
import GroupSettings from '../GroupSettings/GroupSettings'
import ScheduledPanel from '../ScheduledMessages/ScheduledPanel'
import GifPicker from '../GifPicker/GifPicker'
import PinnedMessages from '../PinnedMessages/PinnedMessages'
import VideoCall from '../VideoCall/VideoCall'
import MessageSearch from '../MessageSearch/MessageSearch'
import { useI18n } from '../../hooks/useI18n'
import { encryptMessage, getLocalKeys } from '../../utils/e2e'
import CreatePoll from '../Poll/CreatePoll'
import TimeCapsulePicker from '../TimeCapsule/TimeCapsulePicker'
import GiveawayModal from '../GiveawayModal/GiveawayModal'
import api from '../../services/api'
import VoiceChannel from '../VoiceChannel/VoiceChannel'
import type { Message, Conversation } from '../../types'

interface Props { conversationId: string }

const TIMER_OPTIONS = [
  { value: '',    label: '∞ Kein Timer' },
  { value: '30s', label: '30 Sekunden' },
  { value: '5m',  label: '5 Minuten'   },
  { value: '1h',  label: '1 Stunde'    },
  { value: '1d',  label: '1 Tag'       },
  { value: '7d',  label: '7 Tage'      },
]

const BG_OPTIONS = [
  { value: '', label: 'Standard' },
  { value: 'linear-gradient(135deg,#1a1a2e,#16213e)', label: '🌌 Dunkel Blau' },
  { value: 'linear-gradient(135deg,#0d1117,#161b22)', label: '⬛ Sehr Dunkel' },
  { value: 'linear-gradient(135deg,#1a0a2e,#2d1b69)', label: '🟣 Lila Nacht'  },
  { value: 'linear-gradient(135deg,#0a1628,#0f2942)', label: '🌊 Tiefsee'     },
  { value: 'linear-gradient(135deg,#1a2e1a,#0d2e0d)', label: '🌿 Wald'        },
]

// ── Einmal-Ansehen Upload Handler ────────────────────────────────────────────
async function uploadViewOnce(file: File, conversationId: string) {
  const form = new FormData()
  form.append('file', file)
  form.append('conversationId', conversationId)
  form.append('viewOnce', 'true')
  await api.post('/api/messages/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } })
}

// ── Weiterleiten Modal ─────────────────────────────────────────────────────
function ForwardModal({ message, conversations, onClose, onForward }: {
  message: Message; conversations: Conversation[]
  onClose: () => void; onForward: (targetId: string) => void
}) {
  const [selected, setSelected] = useState('')
  const user = useAuthStore(s => s.user)
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#13131f] border border-white/10 rounded-2xl w-full max-w-sm p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold">↪ Weiterleiten</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white">✕</button>
        </div>
        <div className="bg-white/5 rounded-xl p-3 mb-4 text-sm text-white/60 truncate">
          {message.type === 'voice' ? '🎤 Sprachnachricht' : message.content}
        </div>
        <div className="space-y-1 max-h-64 overflow-y-auto mb-4">
          {conversations.filter(c => c._id !== message.conversationId).map(conv => {
            const other = conv.isGroup ? null : conv.participants?.find(p => p._id !== user?._id)
            return (
              <button key={conv._id} onClick={() => setSelected(conv._id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors ${
                  selected === conv._id ? 'bg-blue-600/30 border border-blue-500/30' : 'hover:bg-white/5'
                }`}>
                <div className="w-8 h-8 rounded-full bg-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {(conv.groupName || other?.username || '?')[0]?.toUpperCase()}
                </div>
                <span className="text-sm">{conv.isGroup ? conv.groupName : (other?.username ?? '?')}</span>
              </button>
            )
          })}
        </div>
        <button onClick={() => selected && onForward(selected)}
          disabled={!selected}
          className="btn-primary w-full disabled:opacity-40">
          Weiterleiten →
        </button>
      </div>
    </div>
  )
}

// ── Haupt-Komponente ────────────────────────────────────────────────────────
export default function ChatWindow({ conversationId }: Props): any {
  const user          = useAuthStore(s => s.user)
  const { contacts }  = useContactStore()
  const {
    conversations, messages, loadingMessages,
    fetchMessages, sendMessage, forwardMessage,
    editMessage, deleteMessage, updateMessage,
    markMessageDeleted, updateConversation,
    setChatBackground, chatBackground: chatBackgrounds,
    addMessage,
  } = useChatStore()

  const { play } = useSound()
  const bottomRef    = useRef<HTMLDivElement>(null)
  const typingTimer  = useRef<ReturnType<typeof setTimeout>>()
  const isTyping     = useRef(false)

  const [input,        setInput]        = useState('')
  const [selectedTimer,setTimer]        = useState('')
  const [replyTo,      setReplyTo]      = useState<Message | null>(null)
  const [forwardMsg,   setForwardMsg]   = useState<Message | null>(null)
  const [showEmoji,    setShowEmoji]    = useState(false)
  const [showBg,       setShowBg]       = useState(false)
  const [showScheduled,setShowScheduled] = useState(false)
  const [showGroupSettings, setShowGroupSettings] = useState(false)
  const [showVoice,         setShowVoice]         = useState(false)  // Voice Channel Panel
  const [screenshotProtection, setScreenshotProtection] = useState<boolean>(false)
  const [peerTyping,   setPeerTyping]   = useState(false)
  const [pingCooldown, setPingCooldown] = useState(false)
  const { tr } = useI18n()
  const [blockedError, setBlockedError] = useState('')
  const [showGif,      setShowGif]      = useState(false)
  const [showExport,   setShowExport]   = useState(false)
  const [showPins,     setShowPins]     = useState(false)
  const [activeCall,   setActiveCall]   = useState<{targetId:string;targetName:string;isIncoming:boolean}|null>(null)
  const [showSearch,   setShowSearchMsg] = useState(false)
  const [e2eEnabled,   setE2eEnabled]   = useState(false)
  const [showPoll,     setShowPoll]      = useState(false)
  const [showCapsule,  setShowCapsule]   = useState(false)
  const [deliverAt,    setDeliverAt]     = useState('')
  const [recording,    setRecording]    = useState(false)
  const [recordSeconds,setRecordSeconds] = useState(0)
  const [anonymMode,   setAnonMode]     = useState(false)   // Anonym-Modus
  const [whisperTo,    setWhisperTo]    = useState<string|null>(null) // Flüster-Empfänger (userId)
  const [showGiveawayModal, setShowGiveawayModal] = useState(false)  // 🎉 Giveaway Modal
  const [showMobileActions, setShowMobileActions] = useState(false)  // Mobile + Menü

  // ── Mobile Detection ────────────────────────────────────────────────────────
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  const viewOnceDesktopRef = useRef<HTMLInputElement>(null)
  const viewOnceMobileRef  = useRef<HTMLInputElement>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef   = useRef<Blob[]>([])
  const recordTimer      = useRef<ReturnType<typeof setInterval>>()

  // ── DEFENSIVE: conversation könnte noch undefined sein ──────────────────
  const conversation = conversations?.find(c => c._id === conversationId) ?? null
  const convPeer     = conversation?.participants?.find(p => p._id !== user?._id) ?? null
  const isGroup      = conversation?.isGroup ?? !!conversation?.groupName

  // Screenshot-Schutz aus conversation laden sobald verfügbar
  useEffect(() => {
    setScreenshotProtection(!!(conversation as any)?.screenshotProtection)
  }, [conversation?._id, (conversation as any)?.screenshotProtection])

  const msgs         = messages[conversationId] ?? []  // IMMER Array, nie undefined

  // ── Saved Messages: Lokale Notizen (kein Backend) ──────────────────────────
  const [savedNotes, setSavedNotes]   = useState<{id:number;text:string;ts:string}[]>(() => {
    try { return JSON.parse(localStorage.getItem('pingr_saved_notes') || '[]') } catch { return [] }
  })
  const [savedInput, setSavedInput]   = useState('')

  const addSavedNote = () => {
    if (!savedInput.trim()) return
    const note = { id: Date.now(), text: savedInput.trim(), ts: new Date().toLocaleString('de-DE') }
    const updated = [note, ...savedNotes]
    setSavedNotes(updated)
    localStorage.setItem('pingr_saved_notes', JSON.stringify(updated))
    setSavedInput('')
  }

  const deleteSavedNote = (id: number) => {
    const updated = savedNotes.filter(n => n.id !== id)
    setSavedNotes(updated)
    localStorage.setItem('pingr_saved_notes', JSON.stringify(updated))
  }
  const isLoading    = loadingMessages[conversationId] ?? false
  const chatBg       = chatBackgrounds[conversationId] || ''

  const apiBase = import.meta.env.VITE_API_URL || ''

  // ── Saved Messages View ───────────────────────────────────────────────────
  if (conversationId === '__saved__') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#08090f' }}>
        {/* Header */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg,#4a1a6b,#b46a0e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🔖</div>
          <div>
            <p style={{ fontWeight: 700, fontSize: 14, color: 'rgba(255,255,255,0.9)' }}>Gespeicherte Nachrichten</p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Persönliche Notizen — nur für dich sichtbar</p>
          </div>
        </div>

        {/* Notizen-Liste */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {savedNotes.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.2)', gap: 12 }}>
              <span style={{ fontSize: 40 }}>🔖</span>
              <p style={{ fontSize: 13 }}>Noch keine Notizen</p>
              <p style={{ fontSize: 11 }}>Schreib etwas unten — es wird nur lokal gespeichert</p>
            </div>
          ) : savedNotes.map(note => (
            <div key={note.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '12px 14px', position: 'relative' }}>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{note.text}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>{note.ts}</span>
                <button onClick={() => deleteSavedNote(note.id)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', cursor: 'pointer', fontSize: 12, padding: '2px 6px', borderRadius: 6 }}>🗑️</button>
              </div>
            </div>
          ))}
        </div>

        {/* Eingabe */}
        <div style={{ padding: '12px 18px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 10, flexShrink: 0 }}>
          <textarea
            value={savedInput}
            onChange={e => setSavedInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addSavedNote() } }}
            placeholder="Notiz eingeben… (Enter zum Speichern, Shift+Enter für neue Zeile)"
            rows={2}
            style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: 'white', outline: 'none', resize: 'none', lineHeight: 1.5, colorScheme: 'dark' }}
          />
          <button onClick={addSavedNote} disabled={!savedInput.trim()} style={{ width: 44, height: 44, borderRadius: 12, background: savedInput.trim() ? 'linear-gradient(135deg,#b46a0e,#e8b86d)' : 'rgba(255,255,255,0.06)', border: 'none', cursor: savedInput.trim() ? 'pointer' : 'not-allowed', color: 'white', fontSize: 16, alignSelf: 'flex-end', flexShrink: 0 }}>
            🔖
          </button>
        </div>
      </div>
    )
  }

  useEffect(() => {
    // Bei Conversation-Wechsel prevLen zurücksetzen → kein Sound beim ersten Laden
    prevMsgLenRef.current = -1
    // __saved__ ist eine virtuelle Conversation → kein API-Call
    prevMsgLenRef.current = -1  // Reset: nächstes Laden ist kein Sound
    if (conversationId && conversationId !== '__saved__') fetchMessages(conversationId)
  }, [conversationId, fetchMessages])

  // Chat geleert → sofort neu laden (leer)
  useEffect(() => {
    const onCleared = (e: Event) => {
      const { conversationId: clearedId } = (e as CustomEvent).detail
      if (clearedId === conversationId && conversationId !== '__saved__') fetchMessages(conversationId)
    }
    window.addEventListener('pingr_chat_cleared', onCleared)
    return () => window.removeEventListener('pingr_chat_cleared', onCleared)
  }, [conversationId, fetchMessages])

  // ⏳ Eigene ausstehende Zeitkapseln laden
  const [pendingCapsules, setPendingCapsules] = useState<any[]>([])
  useEffect(() => {
    if (!conversationId || conversationId === '__saved__') return
    api.get('/api/messages/capsules/pending')
      .then(r => setPendingCapsules((r.data || []).filter((m: any) => m.conversationId === conversationId)))
      .catch(() => {})
  }, [conversationId])

  // Nach Senden einer Zeitkapsel: Liste aktualisieren
  const refreshCapsules = () => {
    api.get('/api/messages/capsules/pending')
      .then(r => setPendingCapsules((r.data || []).filter((m: any) => m.conversationId === conversationId)))
      .catch(() => {})
  }

  // Ref speichert die letzte bekannte Nachrichten-Anzahl pro Conversation
  const prevMsgLenRef = useRef<number>(-1)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })

    // Sound NUR wenn wirklich eine NEUE Nachricht dazugekommen ist
    // (nicht beim ersten Laden des Chats)
    const prevLen = prevMsgLenRef.current
    const isInitialLoad = prevLen === -1
    const hasNewMessage = !isInitialLoad && msgs.length > prevLen

    prevMsgLenRef.current = msgs.length

    if (hasNewMessage && msgs.length > 0) {
      const last = msgs[msgs.length - 1]
      const senderId = typeof last.sender === 'object' ? (last.sender as any)?._id : last.sender
      // Nur Sound wenn: Sender bekannt, nicht ich selbst, und nicht ein Bot (sender=null)
      console.log('[SOUND-DEBUG] senderId:', senderId, 'userId:', user?._id, 'match:', senderId === user?._id)
      if (senderId && senderId !== user?._id && typeof last.sender === 'object' && last.sender !== null) {
        play('ding')
        if (document.hidden && Notification.permission === 'granted') {
          const senderName = typeof last.sender === 'object' ? (last.sender as any)?.username : 'Jemand'
          const body = last.content?.length > 60 ? last.content.slice(0, 60) + '…' : last.content || 'Neue Nachricht'
          new Notification(`💬 ${senderName}`, { body, icon: '/favicon.svg', tag: `msg-${conversationId}` })
        }
      }
    }
  }, [msgs.length])

  useEffect(() => {
    const socket = getSocket()
    const onTypingStart    = ({ userId }: { userId: string }) => { if (userId !== user?._id) setPeerTyping(true)  }
    const onTypingStop     = ({ userId }: { userId: string }) => { if (userId !== user?._id) setPeerTyping(false) }
    const onIncomingPing   = ({ senderName }: { senderName: string }) => {
      play('ding')
      if (Notification.permission === 'granted') new Notification(`📣 ${senderName} pingt dich!`)
    }
    // Chat geleert → Nachrichten sofort leeren
    const onChatCleared = (data: any) => {
      if (data.conversationId === conversationId) {
        // chatStore Messages leeren
        window.dispatchEvent(new CustomEvent('pingr_chat_cleared', { detail: { conversationId } }))
      }
    }

    // 🤖 Bot-Nachrichten empfangen (neu)
        const onNewMessage = (msg: any) => {
      console.log('[NEW_MESSAGE] Received:', msg)  // ← NEU
      if (msg.conversationId === conversationId) {
        console.log('[NEW_MESSAGE] Adding to store!')  // ← NEU
        addMessage(msg)
      } else {
        console.log('[NEW_MESSAGE] Wrong conversation, ignoring')  // ← NEU
      }
    }
    
    // 🎉 Giveaway Interactive Command (neu)
    const onCommandInteractive = (data: any) => {
      console.log('[INTERACTIVE-COMMAND]', data)
      if (data.command.commandId === 'giveaway' && data.userId === user?._id) {
        setShowGiveawayModal(true)
      }
    }
    
    socket.on('user_typing',      onTypingStart)
    socket.on('user_stop_typing', onTypingStop)
    socket.on('incoming_ping',    onIncomingPing)
    socket.on('chat_cleared',     onChatCleared)
    socket.on('new_message',      onNewMessage)
    const onGiveawayUpdated = (_data: any) => {
      window.dispatchEvent(new CustomEvent('giveaway_refresh'))
    }

    socket.on('command_interactive', onCommandInteractive)
    socket.on('giveaway_updated',    onGiveawayUpdated)
    return () => {
      socket.off('user_typing',         onTypingStart)
      socket.off('user_stop_typing',    onTypingStop)
      socket.off('incoming_ping',       onIncomingPing)
      socket.off('chat_cleared',        onChatCleared)
      socket.off('new_message',         onNewMessage)
      socket.off('command_interactive', onCommandInteractive)
      socket.off('giveaway_updated',    onGiveawayUpdated)
    }
  }, [user?._id, play, addMessage, conversationId])

  // ── Sende-Handler ─────────────────────────────────────────────────────────
  const handleSend = async () => {
    const content = input.trim()
    if (!content) return
    setBlockedError('')

    // Commands direkt per API senden ohne optimistisches UI-Update
    const isCmd = content.startsWith('/')
    if (isCmd) {
      setInput(''); setReplyTo(null); setTimer('')
      try {
        await api.post('/api/messages', { conversationId, content, type: 'text' })
      } catch (err: unknown) {
        const e = err as { response?: { data?: { error?: string } } }
        if (e?.response?.data?.error) {
          setBlockedError(e.response.data.error)
          setTimeout(() => setBlockedError(''), 4000)
        }
      }
      return
    }

    try {
      await sendMessage(
        conversationId, content, 'text',
        selectedTimer || undefined,
        replyTo?._id
      )
      setInput(''); setReplyTo(null); setTimer('')
      // Flüster-Modus nach dem Senden automatisch zurücksetzen
      if (whisperTo) setWhisperTo(null)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string; blocked?: boolean } } }
      if (e?.response?.data?.blocked) {
        setBlockedError(e.response.data.error || 'Inhalt nicht erlaubt.')
        setTimeout(() => setBlockedError(''), 4000)
      }
    }
  }

  const handleTyping = () => {
    if (!isTyping.current) {
      isTyping.current = true
      getSocket().emit('typing_start', { conversationId, userId: user?._id })
    }
    clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(() => {
      isTyping.current = false
      getSocket().emit('typing_stop', { conversationId, userId: user?._id })
    }, 2000)
  }

  const handlePing = () => {
    if (!convPeer || pingCooldown) return
    // ONLY server sends sound to receiver via 'incoming_ping' event
    // Sender gets NO sound - only visual feedback
    getSocket().emit('ping_user', { targetUserId: convPeer._id, senderName: user?.username ?? 'Jemand' })
    setPingCooldown(true)
    setTimeout(() => setPingCooldown(false), 5000)
  }

  // ── Voice ─────────────────────────────────────────────────────────────────
  const startRecording = async () => {
    if (location.protocol !== 'https:' && !['localhost','127.0.0.1'].includes(location.hostname)) {
      setBlockedError('Mikrofon benötigt HTTPS.'); return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      audioChunksRef.current = []
      mr.ondataavailable = e => audioChunksRef.current.push(e.data)
      mr.start()
      mediaRecorderRef.current = mr
      setRecording(true); setRecordSeconds(0)
      recordTimer.current = setInterval(() => setRecordSeconds(s => s + 1), 1000)
    } catch (_err) {
      setBlockedError('Mikrofon-Zugriff verweigert.')
    }
  }

  const stopRecording = () => {
    const mr = mediaRecorderRef.current
    if (!mr) return
    clearInterval(recordTimer.current)
    mr.onstop = async () => {
      const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
      mr.stream.getTracks().forEach(t => t.stop())
      setRecording(false); setRecordSeconds(0)
      const form = new FormData()
      form.append('file', blob, 'voice.webm')
      form.append('conversationId', conversationId)
      await api.post('/api/messages/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } })
    }
    mr.stop()
  }

  const fmtSec = (s: number) => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`

  // ── Nachrichten-Aktionen ──────────────────────────────────────────────────
  const handleEdit = async (messageId: string, content: string) => {
    await editMessage(messageId, conversationId, content)
  }
  const handleDelete = async (messageId: string) => {
    await deleteMessage(messageId, conversationId)
    markMessageDeleted(messageId, conversationId)
  }
  const handleForward = async (targetId: string) => {
    if (!forwardMsg) return
    await forwardMessage(forwardMsg._id, targetId)
    setForwardMsg(null)
  }

  const handleReaction = async (messageId: string, emoji: string) => {
    const { data } = await api.post(`/api/messages/${messageId}/reaction`, { emoji })
    updateMessage(data)
  }

  const handleReport = async (messageId: string, reason: string, description?: string) => {
    await api.post(`/api/messages/${messageId}/report`, { reason, description })
  }

  // 🎉 Giveaway Submit Handler (neu)
  const handleGiveawaySubmit = async (giveawayData: any) => {
    try {
      const response = await api.post('/api/giveaways', {
        conversationId,
        ...giveawayData
      })
      if (response.data.success) {
        console.log('✅ Giveaway erstellt!')
        setShowGiveawayModal(false)
        setTimeout(() => setShowGiveawayModal(true), 300)
      }
    } catch (error) {
      console.error('❌ Fehler beim Erstellen:', error)
    }
  }


  const handleExport = async (format: 'txt' | 'json') => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || ''}/api/export/${conversationId}?format=${format}`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('pingr_token')}` } }
      )
      const blob = await response.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `Nokki_Chat_${conversationId.slice(-6)}.${format}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (_err) { alert('Export fehlgeschlagen') }
  }



  // E2E Status prüfen
  useEffect(() => {
    // Erst aktivieren, wenn Schlüsselprüfung, Gerätewechsel und Gruppen vollständig umgesetzt sind.
    setE2eEnabled(false)
  }, [conversationId])

  const encryptIfPossible = async (text: string, recipientId?: string): Promise<string> => {
    return text  // E2E deaktiviert
  }

  // ── Saved Messages View ───────────────────────────────────────────────────
  if (conversationId === '__saved__') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#08090f' }}>
        {/* Header */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg,#4a1a6b,#b46a0e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🔖</div>
          <div>
            <p style={{ fontWeight: 700, fontSize: 14, color: 'rgba(255,255,255,0.9)' }}>Gespeicherte Nachrichten</p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Persönliche Notizen — nur für dich sichtbar</p>
          </div>
        </div>

        {/* Notizen-Liste */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {savedNotes.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.2)', gap: 12 }}>
              <span style={{ fontSize: 40 }}>🔖</span>
              <p style={{ fontSize: 13 }}>Noch keine Notizen</p>
              <p style={{ fontSize: 11 }}>Schreib etwas unten — es wird nur lokal gespeichert</p>
            </div>
          ) : savedNotes.map(note => (
            <div key={note.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '12px 14px', position: 'relative' }}>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{note.text}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>{note.ts}</span>
                <button onClick={() => deleteSavedNote(note.id)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', cursor: 'pointer', fontSize: 12, padding: '2px 6px', borderRadius: 6 }}>🗑️</button>
              </div>
            </div>
          ))}
        </div>

        {/* Eingabe */}
        <div style={{ padding: '12px 18px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 10, flexShrink: 0 }}>
          <textarea
            value={savedInput}
            onChange={e => setSavedInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addSavedNote() } }}
            placeholder="Notiz eingeben… (Enter zum Speichern, Shift+Enter für neue Zeile)"
            rows={2}
            style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: 'white', outline: 'none', resize: 'none', lineHeight: 1.5, colorScheme: 'dark' }}
          />
          <button onClick={addSavedNote} disabled={!savedInput.trim()} style={{ width: 44, height: 44, borderRadius: 12, background: savedInput.trim() ? 'linear-gradient(135deg,#b46a0e,#e8b86d)' : 'rgba(255,255,255,0.06)', border: 'none', cursor: savedInput.trim() ? 'pointer' : 'not-allowed', color: 'white', fontSize: 16, alignSelf: 'flex-end', flexShrink: 0 }}>
            🔖
          </button>
        </div>
      </div>
    )
  }



  const startCall = () => {
    const conv = conversations?.find(c => c._id === conversationId)
    const other = conv?.participants?.find((p: any) => p._id !== user?._id)
    if (!other) return
    // Globales Event für Chat.tsx
    window.dispatchEvent(new CustomEvent('start_call', {
      detail: { targetId: other._id, targetName: other.username, conversationId }
    }))
  }

  // Eingehende Anrufe werden global in Chat.tsx verwaltet

  const jumpToMessage = (msgId: string) => {
    const el = document.getElementById(`msg-${msgId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.style.background = 'rgba(250,204,21,0.15)'
      setTimeout(() => { el.style.background = '' }, 2000)
    }
  }

  const toggleScreenshotProtection = async () => {
    const newVal = !screenshotProtection
    try {
      await api.patch(`/api/conversations/${conversationId}/screenshot-protection`, { enabled: newVal })
      setScreenshotProtection(newVal)
    } catch { /* non-fatal */ }
  }

  const handleGifSend = async (gifUrl: string) => {
    setShowGif(false)
    await sendMessage(conversationId, gifUrl, 'text')
  }

  const handleRead = async (messageId: string) => {
    await api.patch(`/api/messages/${messageId}/read`)
  }

  // ── Loading / leerer State ────────────────────────────────────────────────
  // Wenn conversation noch nicht geladen ist
  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center text-white/30">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-pulse">💬</div>
          <p className="text-sm">Lade Chat…</p>
        </div>
      </div>
    )
  }

  const displayName = isGroup
    ? (conversation.groupName ?? 'Gruppe')
    : (convPeer?.username ?? '?')

  const displayAvatar = convPeer?.avatar
    ? `${apiBase}${convPeer.avatar}`
    : null

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden"
      style={screenshotProtection ? { userSelect:'none', WebkitUserSelect:'none' } : undefined}
    >

      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-[#13131f]/80 flex-shrink-0">
        <div className="relative flex-shrink-0">
          <div className={`w-10 h-10 rounded-full overflow-hidden flex items-center justify-center font-bold text-sm ${
            isGroup ? 'bg-purple-600' : 'bg-blue-700'
          }`}>
            {displayAvatar
              ? <img src={displayAvatar} alt="" className="w-full h-full object-cover" />
              : displayName[0]?.toUpperCase()
            }
          </div>
          {!isGroup && convPeer?.status && (
            <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#13131f] ${
              convPeer.status === 'online' ? 'bg-green-400' : convPeer.status === 'away' ? 'bg-yellow-400' : 'bg-gray-500'
            }`} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{displayName}</p>
          <p className={`text-xs truncate ${
            peerTyping ? 'text-blue-400' :
            convPeer?.status === 'online' ? 'text-green-400' :
            convPeer?.status === 'away'   ? 'text-yellow-400' : 'text-white/40'
          }`}>
            {peerTyping
              ? '✍️ schreibt…'
              : isGroup
                ? `${conversation.participants?.length ?? 0} Mitglieder`
                : convPeer?.statusMessage || (convPeer?.status === 'online' ? 'Online' : convPeer?.status === 'away' ? 'Abwesend' : 'Offline')
            }
          </p>
        </div>

        {/* Header-Buttons */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Ping (nur 1:1) */}
          {!isGroup && convPeer && (
            <button onClick={handlePing} disabled={pingCooldown}
              className={`text-xs px-2 py-1 rounded-lg transition-all ${
                pingCooldown
                  ? 'bg-yellow-500/10 text-yellow-300/40 cursor-not-allowed'
                  : 'bg-white/5 hover:bg-yellow-500/20 text-white/40 hover:text-yellow-300'
              }`} title="Ping!">
              📣
            </button>
          )}
          {/* Gruppen-Einstellungen */}
          {isGroup && (
            <button onClick={() => setShowGroupSettings(true)}
              className="text-xs px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all"
              title="Gruppeneinstellungen">
              ⚙️
            </button>
          )}
          {/* Voice Channel Button (nur Gruppen) */}
          {isGroup && (
            <button onClick={() => setShowVoice(v => !v)}
              title="Voice Channel"
              style={{
                fontSize:13, padding:'4px 8px', borderRadius:8, border:'none', cursor:'pointer', transition:'all .15s',
                background: showVoice ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)',
                color:      showVoice ? '#4ade80'             : 'rgba(255,255,255,0.3)',
              }}>
              🔊
            </button>
          )}
          {/* Anruf-Button (nur DMs) */}
          {!isGroup && (
            <button onClick={() => startCall()}
              className="text-xs px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-green-400 transition-all"
              title="Videoanruf starten" aria-label="Anruf">
              📞
            </button>
          )}

          {/* Suche */}
          <button onClick={() => setShowSearchMsg(true)}
            className="text-xs px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all"
            title="Nachrichten durchsuchen" aria-label="Suchen">
            🔍
          </button>

          {/* Angepinnte Nachrichten */}
          <button onClick={() => setShowPins(s => !s)}
            className="text-xs px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all"
            title="Angepinnte Nachrichten" aria-label="Angepinnte Nachrichten">
            📌
          </button>

          {/* Screenshot-Sperre */}
          <button onClick={toggleScreenshotProtection}
            title={screenshotProtection ? 'Screenshot-Sperre aktiv — klicken zum Deaktivieren' : 'Screenshot-Sperre aktivieren'}
            style={{
              fontSize:13, padding:'4px 8px', borderRadius:8, border:'none', cursor:'pointer',
              background: screenshotProtection ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)',
              color:      screenshotProtection ? '#f87171' : 'rgba(255,255,255,0.3)',
              transition:'all .15s',
            }}>
            {screenshotProtection ? '🛡️' : '📷'}
          </button>

          {/* E2E Status */}
          {e2eEnabled && (
            <span style={{ fontSize:'11px', background:'rgba(34,197,94,0.15)', color:'#4ade80', border:'1px solid rgba(34,197,94,0.3)', borderRadius:'6px', padding:'2px 8px' }}
              title="Ende-zu-Ende verschlüsselt">
              🔒 E2E
            </span>
          )}

          {/* Chat Export */}
          <div className="relative">
            <button onClick={() => setShowExport(s => !s)}
              className="text-xs px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all"
              title="Chat exportieren">
              💾
            </button>
            {showExport && (
              <div className="absolute right-0 top-8 bg-[#1a1a2e] border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50 min-w-32"
                onMouseLeave={() => setShowExport(false)}>
                <button onClick={() => { handleExport('txt');  setShowExport(false) }}
                  className="w-full px-4 py-2.5 text-xs text-left hover:bg-white/10 transition-colors flex items-center gap-2">
                  📄 Als TXT
                </button>
                <button onClick={() => { handleExport('json'); setShowExport(false) }}
                  className="w-full px-4 py-2.5 text-xs text-left hover:bg-white/10 transition-colors flex items-center gap-2">
                  📋 Als JSON
                </button>
              </div>
            )}
          </div>

          {/* Geplante Nachrichten */}
          <button onClick={() => setShowScheduled(s => !s)}
            className="text-xs px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all"
            title="Geplante Nachrichten">
            ⏰
          </button>
          {/* Hintergrund */}
          <div className="relative">
            <button onClick={() => setShowBg(s => !s)}
              className="text-xs px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all"
              title="Hintergrund">
              🎨
            </button>
            {showBg && (
              <div className="absolute right-0 top-8 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl z-20 py-1 min-w-[180px]">
                {BG_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => { setChatBackground(conversationId, opt.value); setShowBg(false) }}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 transition-colors ${
                      chatBg === opt.value ? 'text-blue-400' : 'text-white/70'
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Voice Channel Panel (nur Gruppen) ── */}
      {isGroup && showVoice && (
        <VoiceChannel
          conversationId={conversationId}
          groupName={conversation?.groupName ?? 'Gruppe'}
        />
      )}

      {/* ── Nachrichten ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4"
        style={{ background: chatBg || undefined }}>

        {/* Loading Spinner */}
        {isLoading && msgs.length === 0 && (
          <div className="flex justify-center py-8">
            <div className="text-white/30 text-sm animate-pulse">Lade Nachrichten…</div>
          </div>
        )}

        {/* Leer */}
        {!isLoading && msgs.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-white/20 select-none">
            <div className="text-4xl mb-3">💬</div>
            <p className="text-sm">Noch keine Nachrichten</p>
            <p className="text-xs mt-1">Schreib die erste Nachricht!</p>
          </div>
        )}

        {/* ⏳ Ausstehende Zeitkapseln */}
        {pendingCapsules.map(msg => (
          <MessageBubble
            key={`capsule-${msg._id}`}
            message={msg}
            isOwn={true}
            showAvatar={false}
            onReply={() => {}}
            onForward={() => {}}
            // onEdit={() => {}}
            // onDelete={() => {}}
            // onReact={() => {}}
            // onReport={() => {}}
            // onRead={() => {}}
          />
        ))}

        {/* Nachrichten-Liste */}
        {msgs.map(msg => (
          <MessageBubble
            showAvatar={true}
            key={msg._id}
            message={msg}
            isOwn={msg.sender?._id === user?._id || msg.sender?._id === user?._id}
            onReply={setReplyTo}
            onForward={setForwardMsg}
            // onEdit={handleEdit}
            // onDelete={handleDelete}
            // onReact={handleReaction}
            // onReport={handleReport}
            // onRead={handleRead}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* ── Content-Filter Fehler ── */}
      {blockedError && (
        <div className="mx-4 mb-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-sm animate-pulse">
          🚫 {blockedError}
        </div>
      )}

      {/* ── Reply-Vorschau ── */}
      {replyTo && (
        <div className="mx-4 mb-2 flex items-center gap-3 px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-blue-400 font-medium">
              ↩ {replyTo.sender?.username ?? 'Jemand'}
            </p>
            <p className="text-xs text-white/60 truncate">
              {replyTo.type === 'voice' ? '🎤 Sprachnachricht' : replyTo.content}
            </p>
          </div>
          <button onClick={() => setReplyTo(null)} className="text-white/30 hover:text-white">✕</button>
        </div>
      )}

      {/* ── Eingabe ── */}
      <div className="px-4 py-3 border-t border-white/10 flex-shrink-0">
        {/* Timer + Emoji Row */}
        <div className="flex items-center gap-2 mb-2">
          <select value={selectedTimer} onChange={e => setTimer(e.target.value)}
            className="text-xs bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white/60 outline-none"
            style={{ colorScheme: 'dark' }}>
            {TIMER_OPTIONS.map(o => (
              <option key={o.value} value={o.value} style={{ background: '#0d0d14' }}>{o.label}</option>
            ))}
          </select>
          {selectedTimer && (
            <span className="text-xs text-orange-400 border border-orange-400/30 bg-orange-400/10 px-2 py-1 rounded-lg">
              ⏱ {TIMER_OPTIONS.find(o => o.value === selectedTimer)?.label}
            </span>
          )}
        </div>

        {/* Zeitkapsel-Indikator */}
        {deliverAt && (
          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 12px', background:'rgba(232,184,109,0.08)', border:'1px solid rgba(232,184,109,0.2)', borderRadius:10, marginBottom:8, fontSize:12, color:'#e8b86d' }}>
            <span>⏳</span>
            <span style={{ flex:1 }}>Zeitkapsel — Zustellung: <strong>{new Date(deliverAt).toLocaleString('de-DE', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}</strong></span>
            <button onClick={() => setDeliverAt('')} style={{ background:'none', border:'none', color:'rgba(232,184,109,0.5)', cursor:'pointer', fontSize:14 }}>✕</button>
          </div>
        )}

        {/* Eingabezeile */}
        {/* Versteckte Inputs für Einmal-Ansehen */}
        <input ref={viewOnceDesktopRef} type="file" accept="image/*" style={{ display:'none' }}
          onChange={async e => { const f=e.target.files?.[0]; if(f){ await uploadViewOnce(f,conversationId); e.target.value='' } }} />
        <input ref={viewOnceMobileRef} type="file" accept="image/*" style={{ display:'none' }}
          onChange={async e => { const f=e.target.files?.[0]; if(f){ await uploadViewOnce(f,conversationId); e.target.value='' } }} />

        {recording ? (
          <div className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
            <span className="text-sm text-red-400 font-mono">{fmtSec(recordSeconds)}</span>
            <div className="flex-1 flex items-center gap-0.5">
              {Array.from({ length: 20 }).map((_, i) => (
                <div key={i} className="flex-1 bg-red-400/40 rounded-full animate-pulse"
                  style={{ height: `${4 + Math.random() * 12}px`, animationDelay: `${i * 50}ms` }} />
              ))}
            </div>
            <button onClick={stopRecording}
              className="bg-red-500 hover:bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm transition-colors">
              ⏹
            </button>
          </div>
        ) : (
          <div className="flex items-end gap-2" style={{ minHeight: isMobile ? 48 : 56 }}>
            {/* Mobile: + Menü */}
            {isMobile ? (
              <div style={{ position:'relative' }}>
                <button onClick={() => setShowMobileActions(s => !s)}
                  style={{ width:38, height:38, borderRadius:11, border:'1px solid rgba(255,255,255,0.1)', background:showMobileActions?'rgba(255,255,255,0.08)':'rgba(255,255,255,0.04)', color:'rgba(255,255,255,0.5)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>
                  +
                </button>
                {showMobileActions && (
                  <div style={{ position:'absolute', bottom:'110%', left:0, background:'#0d0f18', border:'1px solid rgba(255,255,255,0.1)', borderRadius:14, padding:8, display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, minWidth:200, zIndex:100, boxShadow:'0 8px 24px rgba(0,0,0,0.6)' }}>
                    {[
                      { icon:'😊', label:'Emoji',      fn: () => { setShowEmoji(s => !s); setShowMobileActions(false) } },
                      { icon:'📎', label:'Datei',      fn: () => setShowMobileActions(false) },
                      { icon:'👁️', label:'Einmal',     fn: () => { viewOnceMobileRef.current?.click(); setShowMobileActions(false) } },
                      { icon:'🎤', label:'Sprachnotiz', fn: () => { startRecording(); setShowMobileActions(false) } },
                      { icon:'⏳', label:'Zeitkapsel', fn: () => { setShowCapsule(true); setShowMobileActions(false) } },
                      { icon:'🎁', label:'Giveaway',   fn: () => { setShowGiveawayModal(true); setShowMobileActions(false) } },
                      { icon:'📊', label:'Umfrage',    fn: () => { setShowPoll(true); setShowMobileActions(false) } },
                    ].map(item => (
                      <button key={item.label} onClick={item.fn}
                        style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 10px', borderRadius:9, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.7)', cursor:'pointer', fontSize:12, fontWeight:500 }}>
                        <span style={{ fontSize:16 }}>{item.icon}</span>{item.label}
                      </button>
                    ))}
                    <div style={{ gridColumn:'1/-1', padding:'4px 2px' }}>
                      <select value={selectedTimer} onChange={e => { setTimer(e.target.value); setShowMobileActions(false) }}
                        style={{ width:'100%', padding:'8px 10px', borderRadius:9, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.6)', fontSize:12, outline:'none', colorScheme:'dark' }}>
                        {TIMER_OPTIONS.map(o => <option key={o.value} value={o.value} style={{ background:'#0d0d14' }}>{o.label}</option>)}
                      </select>
                    </div>
                  </div>
                )}
                {showEmoji && (
                  <div style={{ position:'absolute', bottom:'110%', left:0, zIndex:200 }}>
                    <EmojiPicker onPick={e => { setInput(i => i+e); setShowEmoji(false) }} />
                  </div>
                )}
              </div>
            ) : (
              /* Desktop: Emoji */
              <div className="relative">
                <button onClick={() => setShowEmoji(s => !s)}
                  className="w-9 h-9 flex items-center justify-center rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-all text-base">
                  😊
                </button>
                {showEmoji && (
                  <div className="absolute bottom-12 left-0 z-20">
                    <EmojiPicker onPick={e => { setInput(i => i + e); setShowEmoji(false) }} />
                  </div>
                )}
              </div>
            )}

            {!isMobile && <FileUpload conversationId={conversationId} onClose={() => {}} />}

            {/* 👁️ Einmal ansehen — Desktop */}
            {!isMobile && (
              <button onClick={() => viewOnceDesktopRef.current?.click()}
                title="Einmal ansehen — wird nach dem Lesen gelöscht"
                style={{ width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center', borderRadius:11, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', cursor:'pointer', flexShrink:0, color:'rgba(255,255,255,0.4)', fontSize:16, transition:'all .15s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background='rgba(232,184,109,0.1)'; (e.currentTarget as HTMLElement).style.color='#e8b86d' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.04)'; (e.currentTarget as HTMLElement).style.color='rgba(255,255,255,0.4)' }}>
                👁️
              </button>
            )}

            {!isMobile && <button onClick={startRecording}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-white/40 hover:text-green-400 hover:bg-green-500/10 transition-all text-base">
              🎤
            </button>}

            {/* Zeitkapsel Button */}
            <button onClick={() => setShowCapsule(true)}
              style={{ width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center', borderRadius:11, background: deliverAt ? 'rgba(232,184,109,0.12)' : 'none', border: deliverAt ? '1px solid rgba(232,184,109,0.25)' : 'none', cursor:'pointer', fontSize:16, color: deliverAt ? '#e8b86d' : 'rgba(255,255,255,0.4)' }}
              title="Zeitkapsel-Nachricht">
              ⏳
            </button>

            {/* GIF Button */}
            <div className="relative">
              <button onClick={() => setShowGif(s => !s)}
                className="w-9 h-9 flex items-center justify-center rounded-xl text-white/40 hover:text-yellow-400 hover:bg-yellow-500/10 transition-all text-base"
                title="GIF senden">
                😂
              </button>
              {showGif && (
                <GifPicker
                  onPick={handleGifSend}
                  onClose={() => setShowGif(false)}
                />
              )}
            </div>

            {/* Poll Button (nur in Gruppen) */}
            {isGroup && (
              <button onClick={() => setShowPoll(true)}
                className="w-9 h-9 flex items-center justify-center rounded-xl text-white/40 hover:text-blue-400 hover:bg-blue-500/10 transition-all text-base"
                title="Umfrage erstellen">
                📊
              </button>
            )}

            {/* Anonym-Modus Button */}
            <button
              onClick={() => { setAnonMode(a => !a); if (whisperTo) setWhisperTo(null) }}
              title={anonymMode ? 'Anonym-Modus deaktivieren' : 'Anonym schreiben'}
              style={{ width:36, height:36, borderRadius:10, border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, background: anonymMode ? 'rgba(139,92,246,0.2)' : 'transparent', color: anonymMode ? '#a78bfa' : 'rgba(255,255,255,0.3)', transition:'all .15s' }}>
              🎭
            </button>

            {/* Flüster-Modus Button (nur in Gruppen) */}
            {isGroup && (
              <div style={{ position:'relative' }}>
                <button
                  onClick={() => {
                    if (whisperTo) { setWhisperTo(null); return }
                    const el = document.getElementById(`whisper-menu-${conversationId}`)
                    if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none'
                  }}
                  title="Flüstern — nur ein Mitglied sieht diese Nachricht"
                  style={{ width:36, height:36, borderRadius:10, border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, background: whisperTo ? 'rgba(59,130,246,0.2)' : 'transparent', color: whisperTo ? '#93c5fd' : 'rgba(255,255,255,0.3)', transition:'all .15s' }}>
                  🤫
                </button>
                <div id={`whisper-menu-${conversationId}`} style={{ display:'none', position:'absolute', bottom:'100%', right:0, marginBottom:6, background:'#0d0f18', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:6, minWidth:160, zIndex:100, boxShadow:'0 8px 24px rgba(0,0,0,0.5)' }}>
                  <p style={{ fontSize:10, color:'rgba(255,255,255,0.3)', padding:'4px 8px 6px', textTransform:'uppercase', letterSpacing:'0.08em', fontWeight:700 }}>Flüstern an…</p>
                  {conversation?.participants?.filter((p:any) => p._id !== user?._id).map((p:any) => (
                    <button key={p._id} onClick={() => {
                      setWhisperTo(p._id)
                      setAnonMode(false)
                      const el = document.getElementById(`whisper-menu-${conversationId}`)
                      if (el) el.style.display = 'none'
                    }} style={{ width:'100%', padding:'6px 10px', background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:8, borderRadius:8, color:'rgba(255,255,255,0.7)', fontSize:12, textAlign:'left' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                      <span style={{ width:24, height:24, borderRadius:'50%', background:'linear-gradient(135deg,#1a4a6b,#0d9488)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'#fff', flexShrink:0 }}>{p.username?.[0]?.toUpperCase()}</span>
                      {p.username}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Anonym/Flüster Badges */}
            {(anonymMode || whisperTo) && (
              <div style={{ display:'flex', gap:6, alignItems:'center', marginBottom:4 }}>
                {anonymMode && (
                  <span style={{ display:'inline-flex', alignItems:'center', gap:4, background:'rgba(139,92,246,0.15)', border:'1px solid rgba(139,92,246,0.35)', borderRadius:99, padding:'2px 10px', fontSize:11, color:'#a78bfa' }}>
                    🎭 Anonym
                    <button onClick={() => setAnonMode(false)} style={{ background:'none', border:'none', color:'rgba(167,139,250,0.6)', cursor:'pointer', fontSize:12, padding:'0 0 0 4px', lineHeight:1 }}>✕</button>
                  </span>
                )}
                {whisperTo && (
                  <span style={{ display:'inline-flex', alignItems:'center', gap:4, background:'rgba(59,130,246,0.15)', border:'1px solid rgba(59,130,246,0.35)', borderRadius:99, padding:'2px 10px', fontSize:11, color:'#93c5fd' }}>
                    🤫 Flüstere an {conversation?.participants?.find((p:any) => p._id === whisperTo)?.username || '…'}
                    <button onClick={() => setWhisperTo(null)} style={{ background:'none', border:'none', color:'rgba(147,197,253,0.6)', cursor:'pointer', fontSize:12, padding:'0 0 0 4px', lineHeight:1 }}>✕</button>
                  </span>
                )}
              </div>
            )}

            {/* Versteckte Inputs für Einmal-Ansehen */}
            <input ref={viewOnceDesktopRef} type="file" accept="image/*" style={{ display:'none' }}
              onChange={async e => { const f=e.target.files?.[0]; if(f){ await uploadViewOnce(f,conversationId); e.target.value='' } }} />
            <input ref={viewOnceMobileRef} type="file" accept="image/*" style={{ display:'none' }}
              onChange={async e => { const f=e.target.files?.[0]; if(f){ await uploadViewOnce(f,conversationId); e.target.value='' } }} />

            <textarea
              value={input}
              onChange={e => { setInput(e.target.value); handleTyping() }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
              }}
              placeholder={whisperTo ? '🤫 Flüsternachricht eingeben…' : anonymMode ? '🎭 Anonyme Nachricht eingeben…' : tr("typeMessage")}
              aria-label={tr("typeMessage")}
              rows={1}
              style={{
                color: '#f1f0f8', caretColor: '#60a5fa', WebkitTextFillColor: '#f1f0f8',
                background: 'transparent',
                minHeight: '44px', maxHeight: '120px',
                fontSize: '16px', /* verhindert iOS auto-zoom */
                lineHeight: '1.5',
              }}
              className="flex-1 bg-white/8 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none resize-none focus:border-blue-500/50 transition-colors"
            />

            <button onClick={handleSend} disabled={!input.trim()}
              className="w-9 h-9 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-all text-white text-sm">
              ➤
            </button>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {forwardMsg && (
        <ForwardModal
          message={forwardMsg}
          conversations={conversations ?? []}
          onClose={() => setForwardMsg(null)}
          onForward={handleForward}
        />
      )}

      {showGroupSettings && conversation && (
        <GroupSettings
          conversation={conversation}
          currentUserId={user?._id || ''}
          onClose={() => setShowGroupSettings(false)}
        />
      )}

      {/* Anrufe werden global in Chat.tsx verwaltet */}

      {showSearch && (
        <MessageSearch
          conversationId={conversationId}
          onJumpTo={(msgId) => { jumpToMessage(msgId); setShowSearchMsg(false) }}
          onClose={() => setShowSearchMsg(false)}
        />
      )}

      {showCapsule && (
        <TimeCapsulePicker
          value={deliverAt}
          onChange={setDeliverAt}
          onClose={() => setShowCapsule(false)}
        />
      )}

      {showPoll && (
        <CreatePoll
          conversationId={conversationId}
          onClose={() => setShowPoll(false)}
          onCreated={() => setShowPoll(false)}
        />
      )}

      {showScheduled && (
        <ScheduledPanel
          conversationId={conversationId}
          onClose={() => setShowScheduled(false)}
        />
      )}

      {/* 🎉 Giveaway Modal (neu) */}
      {showGiveawayModal && (
        <GiveawayModal
          isOpen={showGiveawayModal}
          onClose={() => setShowGiveawayModal(false)}
          conversationId={conversationId}
          onSubmit={handleGiveawaySubmit}
        />
      )}
    </div>
  )
}
