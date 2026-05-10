// Shared types used across api, web, and mobile.

export type Role = 'ADMIN' | 'MENTOR' | 'ASPIRANT'
export type UserStatus = 'PENDING_VERIFICATION' | 'ACTIVE' | 'SUSPENDED' | 'DELETED'
export type Platform = 'IOS' | 'ANDROID' | 'WEB'
export type MessageType = 'TEXT' | 'IMAGE' | 'VOICE' | 'FILE' | 'SYSTEM'
export type AssignmentStatus = 'ACTIVE' | 'PAUSED' | 'ENDED'

export interface User {
  id: string
  phone: string | null
  email: string | null
  role: Role
  status: UserStatus
  createdAt: string
  updatedAt: string
}

export interface Profile {
  userId: string
  displayName: string
  avatarUrl: string | null
  bio: string | null
  city: string | null
  state: string | null
  language: string
}

export interface Conversation {
  id: string
  mentorId: string
  aspirantId: string
  lastMessageAt: string | null
  createdAt: string
}

export interface ConversationSummary extends Conversation {
  counterpart: {
    id: string
    displayName: string
    avatarUrl: string | null
  }
  lastMessage: {
    id: string
    type: MessageType
    body: string | null
    createdAt: string
    senderId: string
  } | null
}

export interface Message {
  id: string
  conversationId: string
  senderId: string
  type: MessageType
  body: string | null
  attachmentUrl: string | null
  attachmentMeta: Record<string, unknown> | null
  deliveredAt: string | null
  readAt: string | null
  createdAt: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface OtpRequestResponse {
  phone: string
  expiresIn: number
  // In dev mode the api may include the code for testing.
  devCode?: string
}

export interface AuthSession {
  user: User
  profile: Profile | null
  tokens: AuthTokens
}

// Socket.IO events
export type ServerToClientEvents = {
  'message:new': (msg: Message) => void
  'message:status': (update: { messageId: string; deliveredAt?: string; readAt?: string }) => void
  'typing:start': (data: { conversationId: string; userId: string }) => void
  'typing:stop': (data: { conversationId: string; userId: string }) => void
  'presence:online': (data: { userId: string }) => void
  'presence:offline': (data: { userId: string }) => void
  'conversation:created': (conv: Conversation) => void
}

export type ClientToServerEvents = {
  'message:send': (
    payload: {
      conversationId: string
      type: MessageType
      body?: string
      attachmentUrl?: string
      clientMessageId: string
    },
    ack: (res: { ok: true; message: Message } | { ok: false; error: string }) => void,
  ) => void
  'message:delivered': (payload: { messageId: string }) => void
  'message:read': (payload: { messageId: string }) => void
  'typing:start': (payload: { conversationId: string }) => void
  'typing:stop': (payload: { conversationId: string }) => void
  'conversation:join': (payload: { conversationId: string }) => void
  'conversation:leave': (payload: { conversationId: string }) => void
}
