import { create } from 'zustand'
import api from '../services/api'
import type { Conversation, Message } from '../types'

interface ChatState {
  conversations:        Conversation[]
  activeConversationId: string | null
  messages:             Record<string, Message[]>
  loadingMessages:      Record<string, boolean>  // 🆕 pro Chat loading state
  loading:              boolean
  chatBackground:       Record<string, string>
  fetchConversations:   () => Promise<void>
  fetchMessages:        (conversationId: string) => Promise<void>
  sendMessage:          (conversationId: string, content: string, type?: string, timer?: string, replyToId?: string) => Promise<void>
  forwardMessage:       (messageId: string, targetConversationId: string) => Promise<void>
  addMessage:           (message: Message) => void
  editMessage:          (messageId: string, conversationId: string, content: string) => Promise<void>
  deleteMessage:        (messageId: string, conversationId: string) => Promise<void>
  deleteConversation:   (conversationId: string) => Promise<void>
  updateMessage:        (message: Message) => void
  markMessageDeleted:   (messageId: string, conversationId: string) => void
  updateConversation:   (conversationId: string, lastMessage: Message) => void
  markRead:             (conversationId: string, messageId: string, userId: string) => void
  setActiveConversation:(id: string | null) => void
  createConversation:   (participantId: string) => Promise<string>
  setChatBackground:    (conversationId: string, bg: string) => void
  searchMessages:       (q: string, conversationId?: string) => Promise<Message[]>
  resetForIdentitySwitch: () => void  // Alles zurücksetzen beim Identity-Wechsel
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations:        [],
  activeConversationId: null,
  messages:             {},
  loadingMessages:      {},
  loading:              false,
  chatBackground:       JSON.parse(localStorage.getItem('pingr_bg') || '{}'),

  fetchConversations: async () => {
    set({ loading: true })
    try {
      const [convRes, chanRes] = await Promise.allSettled([
        api.get('/api/conversations'),
        api.get('/api/channels'),
      ])
      const convs    = convRes.status === 'fulfilled' ? (convRes.value.data ?? []) : []
      const channels = chanRes.status === 'fulfilled' ? (chanRes.value.data ?? []) : []
      // Channels ans Ende — nach Gruppen
      set({ conversations: [...convs, ...channels], loading: false })
    } catch (_err) {
      set({ loading: false })
    }
  },

  fetchMessages: async (conversationId: string) => {
    // Verhindert doppeltes Laden
    if (get().loadingMessages[conversationId]) return

    set(s => ({
      loadingMessages: { ...s.loadingMessages, [conversationId]: true },
      // Sicherstellen dass der Eintrag existiert (leeres Array statt undefined)
      messages: {
        ...s.messages,
        [conversationId]: s.messages[conversationId] ?? [],
      },
    }))

    try {
      const { data } = await api.get(`/api/messages/${conversationId}`)
      set(s => ({
        messages:        { ...s.messages, [conversationId]: data ?? [] },
        loadingMessages: { ...s.loadingMessages, [conversationId]: false },
      }))
    } catch (_err) {
      set(s => ({
        loadingMessages: { ...s.loadingMessages, [conversationId]: false },
      }))
    }
  },

  sendMessage: async (conversationId, content, type = 'text', timer, replyToId) => {
    await api.post('/api/messages', { conversationId, content, type, timer, replyToId })
  },

  forwardMessage: async (messageId, targetConversationId) => {
    await api.post('/api/messages/forward', { messageId, targetConversationId })
  },

  addMessage: (message: Message) => {
    set(s => {
      const existing = s.messages[message.conversationId] ?? []
      if (existing.some(m => m._id === message._id)) return s
      // Event nur wenn Chat nicht gerade initial geladen wird
      // (verhindert Sound nach F5 für bereits vorhandene Nachrichten)
      const isLoading = s.loadingMessages?.[message.conversationId]
      if (!isLoading) {
        window.dispatchEvent(new CustomEvent('pingr_new_message', {
          detail: {
            senderName:     (message.sender as any)?.username || 'Jemand',
            content:        message.content || '',
            conversationId: message.conversationId,
          }
        }))
      }
      return {
        messages: {
          ...s.messages,
          [message.conversationId]: [...existing, message],
        },
      }
    })
  },

  editMessage: async (messageId, _conversationId, content) => {
    await api.patch(`/api/messages/${messageId}/edit`, { content })
  },

  deleteConversation: async (conversationId) => {
    try {
      await api.delete(`/api/conversations/${conversationId}`)
      set(s => ({
        conversations: s.conversations.filter(c => c._id !== conversationId),
        activeConversationId: s.activeConversationId === conversationId ? null : s.activeConversationId,
        messages: { ...s.messages, [conversationId]: [] },
      }))
    } catch (err: any) {
      throw new Error(err?.response?.data?.error || 'Fehler beim Löschen')
    }
  },

  deleteMessage: async (messageId, _conversationId) => {
    await api.delete(`/api/messages/${messageId}`)
  },

  updateMessage: (message: Message) => {
    set(s => ({
      messages: {
        ...s.messages,
        [message.conversationId]: (s.messages[message.conversationId] ?? []).map(m =>
          m._id === message._id ? message : m
        ),
      },
    }))
  },

  markMessageDeleted: (messageId: string, conversationId: string) => {
    set(s => ({
      messages: {
        ...s.messages,
        [conversationId]: (s.messages[conversationId] ?? []).map(m =>
          m._id === messageId ? { ...m, deleted: true, content: '' } : m
        ),
      },
    }))
  },

  updateConversation: (conversationId: string, lastMessage: Message) => {
    set(s => ({
      conversations: s.conversations
        .map(c => c._id === conversationId
          ? { ...c, lastMessage, updatedAt: lastMessage.createdAt }
          : c
        )
        .sort((a, b) =>
          new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime()
        ),
    }))
  },

  markRead: (conversationId: string, messageId: string, userId: string) => {
    set(s => ({
      messages: {
        ...s.messages,
        [conversationId]: (s.messages[conversationId] ?? []).map(m =>
          m._id === messageId && !m.readBy.includes(userId)
            ? { ...m, readBy: [...m.readBy, userId] }
            : m
        ),
      },
    }))
  },

  setActiveConversation: (id: string | null) => {
    set({ activeConversationId: id })
    // Nachrichten sofort laden wenn noch nicht da
    if (id && !get().messages[id]) {
      get().fetchMessages(id)
    }
  },

  createConversation: async (participantId: string) => {
    const { data } = await api.post('/api/conversations', { participantId })
    set(s => ({
      conversations: [data, ...s.conversations.filter(c => c._id !== data._id)],
    }))
    return data._id as string
  },

  setChatBackground: (conversationId: string, bg: string) => {
    set(s => {
      const newBg = { ...s.chatBackground, [conversationId]: bg }
      localStorage.setItem('pingr_bg', JSON.stringify(newBg))
      return { chatBackground: newBg }
    })
  },

  searchMessages: async (q: string, conversationId?: string) => {
    let url = `/api/messages/search?q=${encodeURIComponent(q)}`
    if (conversationId) url += `&conversationId=${conversationId}`
    const { data } = await api.get(url)
    return data ?? []
  },

  // Beim Identity-Wechsel: State komplett zurücksetzen
  resetForIdentitySwitch: () => {
    set({
      conversations:        [],
      activeConversationId: null,
      messages:             {},
      loadingMessages:      {},
      loading:              false,
    })
  },
}))