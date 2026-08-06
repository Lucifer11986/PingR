export interface User {
  _id:                  string
  uin:                  string
  username:             string
  email:                string
  avatar?:              string
  bio?:                 string
  status:               'online' | 'away' | 'offline'
  statusMessage?:       string
  statusExpiresAt?:     string
  lastSeen?:            string
  privacyShowStatus:    'everyone' | 'contacts' | 'nobody'
  privacyShowLastSeen:  'everyone' | 'contacts' | 'nobody'
  privacyShowAvatar:    'everyone' | 'contacts' | 'nobody'
  twoFactorEnabled?:    boolean
  createdAt:            string
}

export interface Message {
  _id:            string
  conversationId: string
  sender:         User
  content:        string
  type:           'text' | 'image' | 'file' | 'voice'
  fileUrl?:       string
  fileName?:      string
  duration?:      number
  expiresAt?:     string
  timer?:         string
  edited:         boolean
  editedAt?:      string
  deleted:        boolean
  flagged?:       boolean
  replyTo?:       Message
  readBy:         string[]
  reactions:      Reaction[]
  createdAt:      string
}

export interface Reaction {
  emoji:    string
  userId:   string
  username: string
}

export interface Conversation {
  _id:          string
  participants: User[]
  lastMessage?: Message
  isGroup:      boolean
  groupName?:   string
  groupAvatar?: string
  isPublic?:    boolean
  joinCode?:    string
  admins?:      string[]
  bots?:        Array<string | {
    _id:     string
    name?:   string
    botId?:  string
    status?: string
  }>
  unreadCount:  number
  updatedAt:    string
}

export interface Contact {
  _id:       string
  user:      User
  nickname?: string
  addedAt:   string
}

export type SocketEvent =
  | 'new_message' | 'message_read' | 'message_edited'
  | 'message_deleted' | 'user_status' | 'user_typing'
  | 'user_stop_typing' | 'reaction_added' | 'incoming_ping'
  | 'system_broadcast'
