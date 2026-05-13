// Shared types used across api, web, and mobile.

export type Role = 'ADMIN' | 'MENTOR' | 'ASPIRANT' | 'COORDINATOR'
export type UserStatus =
  | 'PENDING_VERIFICATION'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'BANNED'
  | 'DELETED'
export type Platform = 'IOS' | 'ANDROID' | 'WEB'
export type MessageType = 'TEXT' | 'IMAGE' | 'VOICE' | 'FILE' | 'SYSTEM'
export type AssignmentStatus = 'ACTIVE' | 'PAUSED' | 'ENDED'

// Letter taxonomy from spec section 1.17
export type AvatarLetter = 'B' | 'A' | 'P' | 'M' | 'I' | 'F'
export type AvatarColor =
  | 'SLATE'
  | 'AMBER'
  | 'SKY'
  | 'FOREST'
  | 'PURPLE'
  | 'GOLD'

export type JourneyStage =
  | 'ABOUT_TO_START'
  | 'ONE_YEAR_IN'
  | 'TWO_YEARS_IN_NO_PRELIMS'
  | 'ONE_PRELIMS_ATTEMPT'
  | 'MULTI_PRELIMS_NO_CLEAR'
  | 'PRELIMS_CLEARED'
  | 'MAINS_WRITTEN'
  | 'INTERVIEW_ATTEMPTED'
  | 'MULTI_INTERVIEW'

export type SubscriptionTier = 'FREE' | 'BASIC' | 'PRO' | 'MAX'

/**
 * Exhaustive union of all feature flag keys shipped with Mento.
 * Pass to useFeatureFlag() for compile-time safety.
 */
export type FeatureFlagKey =
  | 'broadcast-requests'
  | 'voice-calls'
  | 'group-sessions'
  | 'mentor-self-onboarding-v2'
  | 'chat-search'
  | 'i18n-hindi'

export type ChatRequestStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'ARCHIVED' | 'EXPIRED'

export type JournalCategory =
  | 'PERSONAL'
  | 'PRELIMS_POLITY'
  | 'PRELIMS_HISTORY'
  | 'PRELIMS_GEOGRAPHY'
  | 'PRELIMS_ECONOMY'
  | 'PRELIMS_ENVIRONMENT'
  | 'PRELIMS_SCI_TECH'
  | 'PRELIMS_CSAT'
  | 'PRELIMS_CURRENT_AFFAIRS'
  | 'MAINS_GS1'
  | 'MAINS_GS2'
  | 'MAINS_GS3'
  | 'MAINS_GS4'
  | 'MAINS_ESSAY'
  | 'MAINS_OPTIONAL'
  | 'INTERVIEW'
  | 'SHARED_WITH_MENTOR'

export type SessionRequestStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'EXPIRED'
  | 'COMPLETED'
  | 'CANCELLED'

export interface User {
  id: string
  role: Role
  status: UserStatus
  createdAt: string
  updatedAt: string
  // The following fields are admin-only — present only in /admin/users/:id responses.
  // Removed from /auth/otp/verify, /auth/google, /me, and all public/self endpoints
  // to enforce the anonymity invariant. Never render these in non-admin UI.
  phone?: string | null
  email?: string | null
  googleSub?: string | null
}

export interface Profile {
  userId: string
  displayHandle: string
  avatarLetter: AvatarLetter
  avatarColor: AvatarColor
  hasPurpleTick: boolean
  bio: string | null
  city: string | null
  state: string | null
  language: string
}

// Anonymized counterpart info shown in chat list / mentor profile cards.
export interface AnonymousIdentity {
  id: string
  displayHandle: string
  avatarLetter: AvatarLetter
  avatarColor: AvatarColor
  hasPurpleTick: boolean
}

export interface Conversation {
  id: string
  mentorId: string
  aspirantId: string
  lastMessageAt: string | null
  createdAt: string
}

export interface ConversationSummary extends Conversation {
  counterpart: AnonymousIdentity
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
  expiresIn: number
  // In dev mode the api may include the code for testing.
  devCode?: string
}

export interface AuthSession {
  user: User
  profile: Profile | null
  tokens: AuthTokens
}

// ─── Admin Analytics ────────────────────────────────────────────────────────

export interface AdminAnalyticsSummary {
  users: {
    total: number
    byRole: { ASPIRANT: number; MENTOR: number; COORDINATOR: number; ADMIN: number }
    byStatus: { ACTIVE: number; SUSPENDED: number; BANNED: number; PENDING_VERIFICATION: number }
  }
  signups: {
    /** Daily signup counts ordered oldest → newest, covering the last 7 days. */
    last7d: number[]
    /** Daily signup counts ordered oldest → newest, covering the last 30 days. */
    last30d: number[]
  }
  onboarding: {
    mirrorCompletionRate: number
    mentorApplicationRate: number
    mentorApprovalRate: number
  }
  chats: {
    pendingRequests: number
    acceptedRequests: number
    /** Daily message counts ordered oldest → newest, covering the last 7 days. */
    last7dMessages: number[]
  }
  subscriptions: {
    free: number
    basic: number
    pro: number
    max: number
    mrrInr: number
  }
  moderation: {
    openReports: number
    last30dActions: { WARN: number; DISMISS: number; SUSPEND: number; BAN: number }
  }
  verification: {
    pendingDocs: number
    approvedLast7d: number
    rejectedLast7d: number
  }
  generatedAt: string
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
