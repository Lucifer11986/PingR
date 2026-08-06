import { useEffect, useRef } from 'react'
import { getSocket, disconnectSocket } from '../services/socket'
import { useChatStore } from '../store/chatStore'
import { useContactStore } from '../store/contactStore'
import { useSound } from './useSound'
import type { Message, User } from '../types'

export function useWebSocket(userId: string | undefined) {
  const { play }           = useSound()
  const addMessage         = useChatStore(s => s.addMessage)
  const updateConversation = useChatStore(s => s.updateConversation)
  const updateMessage      = useChatStore(s => s.updateMessage)
  const markMessageDeleted = useChatStore(s => s.markMessageDeleted)
  const setUserStatus         = useContactStore(s => s.setUserStatus)
  const fetchConversations    = useChatStore(s => s.fetchConversations)
  const activeConvId       = useChatStore(s => s.activeConversationId)
  const connected          = useRef(false)

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  useEffect(() => {
    if (!userId) return
    const socket = getSocket()
    connected.current = true

    socket.on('connect', () => console.log('✅ Socket verbunden'))
    socket.on('disconnect', (reason) => console.log('🔌 Socket getrennt:', reason))

    // ── Neue Nachricht ──
    socket.on('new_message', (message: Message) => {
      addMessage(message)
      updateConversation(message.conversationId, message)
      // Wenn die Nachricht in einer Conversation ist die wir noch nicht kennen -> neu laden
      const knownConvIds = useChatStore.getState().conversations.map(c => c._id)
      if (!knownConvIds.includes(message.conversationId)) {
        fetchConversations()
      }
      const senderId = typeof message.sender === 'string' ? message.sender : message.sender?._id
      if (senderId !== userId) {
        const activeConvId = useChatStore.getState().activeConversationId
        const sName = typeof message.sender === 'string' ? 'Nachricht' : (message.sender?.username ?? 'Jemand')
        const body  = message.type === 'voice' ? '🎤 Sprachnachricht'
                    : message.type === 'file'  ? '📎 Datei'
                    : (message.content || '…')

        // Sound immer abspielen wenn nicht im aktiven Chat
        if (activeConvId !== message.conversationId) {
          play('ding')
        }

        // Browser-Notification: wenn Fenster versteckt ODER nicht im richtigen Chat
        const shouldNotify = document.hidden || activeConvId !== message.conversationId
        if (shouldNotify && 'Notification' in window && Notification.permission === 'granted') {
          const n = new Notification(`💬 ${sName}`, {
            body,
            icon:   '/favicon.svg',
            tag:    message.conversationId,
            silent: false,
          })
          // Klick auf Notification → Chat öffnen
          n.onclick = () => {
            window.focus()
            useChatStore.getState().setActiveConversation(message.conversationId)
            n.close()
          }
        }

        // In-App Toast: immer wenn nicht im aktiven Chat
        if (activeConvId !== message.conversationId) {
          window.dispatchEvent(new CustomEvent('new_message_toast', {
            detail: {
              senderName:     sName,
              body,
              conversationId: message.conversationId,
              avatar:         typeof message.sender !== 'string' ? message.sender?.avatar : undefined,
            }
          }))
        }
      }
    })



    // ── Eingehender Anruf ──
    socket.on('webrtc_offer', ({ from, callerName }: { from: string; callerName: string; conversationId: string }) => {
      // Toast-Notification
      window.dispatchEvent(new CustomEvent('incoming_call', {
        detail: { from, callerName }
      }))
    })

    // ── Neue Conversation (Gruppen-Beitritt, neue DM) ──
    socket.on('new_conversation', () => {
      fetchConversations()
    })
    socket.on('conversation_updated', () => {
      fetchConversations()
    })
    socket.on('group_joined', () => {
      fetchConversations()
    })

    socket.on('message_edited',  (message: Message) => { updateMessage(message) })
    socket.on('message_deleted', ({ messageId, conversationId }: { messageId: string; conversationId: string }) => {
      markMessageDeleted(messageId, conversationId)
    })
    socket.on('message_read',    ({ messageId, conversationId, userId: readBy }: { messageId: string; conversationId: string; userId: string }) => {
      useChatStore.getState().markRead(conversationId, messageId, readBy)
    })

    // ── User-Status ──
    socket.on('user_status', ({ userId: uid, status, lastSeen }: { userId: string; status: User['status']; lastSeen?: string }) => {
      setUserStatus(uid, status)
      useChatStore.setState(s => ({
        conversations: s.conversations.map(conv => ({
          ...conv,
          participants: conv.participants.map((p: any) =>
            p._id === uid ? { ...p, status, lastSeen } : p
          ),
        })),
      }))
    })

    // ── Ping — NUR der EMPFÄNGER hört den Sound ──
    // Der Sender schickt ping_user via Socket → Server schickt incoming_ping NUR an Empfänger
    socket.on('incoming_ping', ({ senderName }: { fromUserId: string; senderName: string }) => {
      // NUR hier spielt der Sound ab — beim Empfänger!
      play('ding')
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(`📣 ${senderName} pingt dich!`, { icon: '/favicon.svg' })
      }
      // Toast-Notification im UI
      const event = new CustomEvent('pingr_incoming_ping', { detail: { senderName } })
      window.dispatchEvent(event)
    })

    // ── 🆕 Broadcast vom Admin ──
    socket.on('system_broadcast', ({ content, timestamp }: { content: string; timestamp: string }) => {
      console.log('📢 Broadcast empfangen:', content)
      // Toast anzeigen
      const event = new CustomEvent('pingr_broadcast', { detail: { content, timestamp } })
      window.dispatchEvent(event)
      // Systemklang
      play('ding')
    })

    // ── Reaktion ──
    socket.on('reaction_added', (message: Message) => { updateMessage(message) })

    return () => {
      if (connected.current) {
        ['connect','disconnect','new_message','message_edited','message_deleted',
         'message_read','user_status','incoming_ping','system_broadcast','reaction_added'
        ].forEach(ev => socket.off(ev))
        disconnectSocket()
        connected.current = false
      }
    }
  }, [userId, addMessage, updateConversation, updateMessage, markMessageDeleted, setUserStatus, play])

  useEffect(() => {
    if (!userId || !activeConvId) return
    const socket = getSocket()
    socket.emit('join_conversation', activeConvId)
    return () => { socket.emit('leave_conversation', activeConvId) }
  }, [userId, activeConvId])
}