export const EVENTS = {
  // Client → Server
  JOIN_CONVERSATION:   'join_conversation',
  LEAVE_CONVERSATION:  'leave_conversation',
  TYPING_START:        'typing_start',
  TYPING_STOP:         'typing_stop',
  USER_ONLINE:         'user_online',
  PING_USER:           'ping_user',
  READ_SILENT:         'read_silent',

  // Server → Client
  NEW_MESSAGE:          'new_message',
  MESSAGE_READ:         'message_read',
  MESSAGE_EDITED:       'message_edited',
  MESSAGE_DELETED:      'message_deleted',
  USER_STATUS:          'user_status',
  USER_TYPING:          'user_typing',
  USER_STOP_TYPING:     'user_stop_typing',
  REACTION_ADDED:       'reaction_added',
  CONVERSATION_UPDATED: 'conversation_updated',
  INCOMING_PING:        'incoming_ping',
  SYSTEM_BROADCAST:     'system_broadcast',  // 🆕 Admin-Broadcast
  NEW_CONVERSATION:     'new_conversation',    // 🆕 Neue Conversation
  GROUP_JOINED:         'group_joined',         // 🆕 Gruppe beigetreten
} as const