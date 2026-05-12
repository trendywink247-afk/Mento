import ky, { type KyInstance } from 'ky'
import type {
  AuthSession,
  AuthTokens,
  AvatarColor,
  AvatarLetter,
  ConversationSummary,
  Message,
  OtpRequestResponse,
  Profile,
  Role,
  User,
} from '@mento/types'

export interface ApiClientOptions {
  baseUrl: string
  getAccessToken?: () => string | null | Promise<string | null>
  onUnauthorized?: () => void
  /** Called when a 402 Payment Required response is received. */
  onPaymentRequired?: (requiredTier: string, currentTier: string) => void
}

export class ApiClient {
  private readonly http: KyInstance

  constructor(private readonly opts: ApiClientOptions) {
    this.http = ky.create({
      prefixUrl: opts.baseUrl,
      timeout: 15_000,
      retry: { limit: 1, methods: ['get'] },
      hooks: {
        beforeRequest: [
          async (req) => {
            const token = (await opts.getAccessToken?.()) ?? null
            if (token) req.headers.set('Authorization', `Bearer ${token}`)
          },
        ],
        afterResponse: [
          async (_req, _opts, res) => {
            if (res.status === 401) {
              opts.onUnauthorized?.()
            } else if (res.status === 402) {
              try {
                const body = (await res.clone().json()) as {
                  requiredTier?: string
                  currentTier?: string
                }
                opts.onPaymentRequired?.(
                  body.requiredTier ?? 'BASIC',
                  body.currentTier ?? 'FREE',
                )
              } catch {
                opts.onPaymentRequired?.('BASIC', 'FREE')
              }
            }
          },
        ],
      },
    })
  }

  health(): Promise<{ status: 'ok'; uptime: number }> {
    return this.http.get('healthz').json()
  }

  auth = {
    requestOtp: (phone: string): Promise<OtpRequestResponse> =>
      this.http.post('auth/otp/request', { json: { phone } }).json(),

    verifyOtp: (phone: string, code: string): Promise<AuthSession> =>
      this.http.post('auth/otp/verify', { json: { phone, code } }).json(),

    googleSignin: (idToken: string): Promise<AuthSession> =>
      this.http.post('auth/google', { json: { idToken } }).json(),

    refresh: (refreshToken: string): Promise<AuthTokens> =>
      this.http.post('auth/refresh', { json: { refreshToken } }).json(),

    logout: (refreshToken: string): Promise<void> =>
      this.http.post('auth/logout', { json: { refreshToken } }).json(),
  }

  users = {
    me: (): Promise<{ user: User; profile: Profile | null }> => this.http.get('me').json(),
  }

  mentors = {
    listMentees: (): Promise<
      Array<{
        conversationId: string
        lastMessageAt: string
        unreadCount: number
        sharedJournalId: string | null
        aspirant: {
          id: string
          displayHandle: string
          avatarLetter: AvatarLetter
          avatarColor: AvatarColor
          hasPurpleTick: boolean
        }
        lastMessage: {
          id: string
          body: string | null
          senderId: string
          createdAt: string
        } | null
      }>
    > => this.http.get('mentors/mentees').json(),

    list: (filters?: {
      prelimsCleared?: boolean
      mainsAttempts?: number
      interviewAttempted?: boolean
      language?: string
      optionalSubject?: string
      guidanceCategory?: string
      maxRateInr?: number
      isVerified?: boolean
    }): Promise<
      Array<{
        userId: string
        displayHandle: string
        avatarLetter: AvatarLetter
        avatarColor: AvatarColor
        hasPurpleTick: boolean
        isVerified: boolean
        isFoundingPartner: boolean
        prelimsCleared: boolean
        mainsAttempts: number
        interviewAttempts: number
        optionalSubject: string | null
        guidanceCategories: string[]
        languages: string[]
        hourlyRateInr: number
        rankAchieved: number | null
      }>
    > => {
      const params: Record<string, string | number | boolean> = {}
      if (filters) {
        for (const [k, v] of Object.entries(filters)) {
          if (v !== undefined && v !== null && v !== '') params[k] = v as string | number | boolean
        }
      }
      return this.http.get('mentors', { searchParams: params }).json()
    },

    detail: (
      id: string,
    ): Promise<{
      userId: string
      displayHandle: string
      avatarLetter: AvatarLetter
      avatarColor: AvatarColor
      hasPurpleTick: boolean
      isVerified: boolean
      isFoundingPartner: boolean
      prelimsCleared: boolean
      mainsAttempts: number
      interviewAttempts: number
      attemptHistory: unknown
      rankAchieved: number | null
      optionalSubject: string | null
      guidanceCategories: string[]
      languages: string[]
      hourlyRateInr: number
      metrics: { chats: number; mentees: number; sessions: number }
      reviews: Array<{
        id: string
        body: string
        createdAt: string
        author: { displayHandle: string; avatarLetter: AvatarLetter; avatarColor: AvatarColor }
      }>
    }> => this.http.get(`mentors/${id}`).json(),
  }

  journals = {
    list: () =>
      this.http.get('journals').json<
        Array<{
          id: string
          category: string
          title: string | null
          isShared: boolean
          isLocked: boolean
          conversationId: string | null
          entryCount: number
          updatedAt: string
          sharedWith: {
            id: string
            displayHandle: string
            avatarLetter: AvatarLetter
            avatarColor: AvatarColor
          } | null
        }>
      >(),

    upsert: (category: string, opts?: { title?: string; conversationId?: string }) =>
      this.http
        .post('journals', { json: { category, ...opts } })
        .json<{ id: string; category: string }>(),

    detail: (id: string) =>
      this.http.get(`journals/${id}`).json<{
        id: string
        category: string
        title: string | null
        isShared: boolean
        isLocked: boolean
        canEdit: boolean
        entries: Array<{
          id: string
          type: string
          content: string
          sourceMessageId: string | null
          createdAt: string
          updatedAt: string
          author: {
            id: string
            displayHandle: string
            avatarLetter: AvatarLetter
            avatarColor: AvatarColor
          }
        }>
      }>(),

    addEntry: (id: string, content: string, type: string = 'MANUAL_TEXT') =>
      this.http.post(`journals/${id}/entries`, { json: { type, content } }).json<{ id: string }>(),

    updateEntry: (entryId: string, content: string) =>
      this.http.patch(`journals/entries/${entryId}`, { json: { content } }).json<{ id: string }>(),

    deleteEntry: (entryId: string) =>
      this.http.delete(`journals/entries/${entryId}`).then(() => undefined),

    saveFromChat: (messageId: string, category: string) =>
      this.http
        .post('journals/save-from-chat', { json: { messageId, category } })
        .json<{ id: string }>(),
  }

  chatRequests = {
    create: (mentorId: string, intro: string) =>
      this.http.post('chat-requests', { json: { mentorId, intro } }).json<{
        id: string
        menteeId: string
        mentorId: string
        intro: string
        status: string
        createdAt: string
      }>(),

    list: () =>
      this.http.get('chat-requests').json<
        Array<{
          id: string
          intro: string
          status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'ARCHIVED' | 'EXPIRED'
          createdAt: string
          respondedAt: string | null
          expiresAt: string | null
          conversationId: string | null
          counterpart: {
            id: string
            displayHandle: string
            avatarLetter: AvatarLetter
            avatarColor: AvatarColor
            hasPurpleTick: boolean
          }
        }>
      >(),

    accept: (id: string) => this.http.patch(`chat-requests/${id}/accept`).json<unknown>(),

    decline: (id: string) => this.http.patch(`chat-requests/${id}/decline`).json<unknown>(),

    archive: (id: string) => this.http.patch(`chat-requests/${id}/archive`).json<unknown>(),
  }

  pushTokens = {
    register: (token: string, platform: 'IOS' | 'ANDROID' | 'WEB'): Promise<void> =>
      this.http.post('push-tokens', { json: { token, platform } }).then(() => undefined),

    unregister: (token: string): Promise<void> =>
      this.http.delete(`push-tokens/${encodeURIComponent(token)}`).then(() => undefined),
  }

  sessions = {
    getAvailability: (mentorId: string): Promise<{ availability: Record<string, unknown> | null; hourlyRateInr: number }> =>
      this.http.get(`sessions/availability/${mentorId}`).json(),

    createRequest: (body: {
      mentorId: string
      scheduledAt: string
      durationMin?: number
      message?: string
    }): Promise<{ id: string; status: string; paymentStatus: string; amountInr: number }> =>
      this.http.post('sessions/requests', { json: body }).json(),

    listRequests: () =>
      this.http.get('sessions/requests').json<
        Array<{
          id: string
          scheduledAt: string
          durationMin: number
          hourlyRateInr: number
          amountInr: number
          status: string
          paymentStatus: string
          message: string | null
          createdAt: string
          respondedAt: string | null
          expiresAt: string | null
          session: { id: string } | null
          counterpart: {
            id: string
            displayHandle: string
            avatarLetter: AvatarLetter
            avatarColor: AvatarColor
            hasPurpleTick: boolean
          }
        }>
      >(),

    acceptRequest: (id: string): Promise<{ id: string; status: string }> =>
      this.http.patch(`sessions/requests/${id}/accept`).json(),

    declineRequest: (id: string, reason?: string): Promise<{ id: string; status: string }> =>
      this.http.patch(`sessions/requests/${id}/decline`, { json: { reason } }).json(),

    cancelRequest: (id: string): Promise<{ id: string; status: string }> =>
      this.http.patch(`sessions/requests/${id}/cancel`).json(),

    setAvailability: (availability: Record<string, unknown>): Promise<{ availability: Record<string, unknown> | null; hourlyRateInr: number }> =>
      this.http.patch('me/mentor/availability', { json: { availability } }).json(),
  }

  wallet = {
    list: (): Promise<
      Array<{
        id: string
        type: string
        amountInr: number
        status: string
        reference: string | null
        sessionId: string | null
        metadata: Record<string, unknown> | null
        createdAt: string
      }>
    > =>
      this.http.get('wallet').json(),
  }

  storage = {
    presignUpload: (body: {
      kind: 'aadhaar' | 'hall_ticket' | 'marks_sheet' | 'avatar'
      mime: string
      sizeBytes: number
    }): Promise<{ uploadUrl: string; publicKey: string; expiresIn: number }> =>
      this.http.post('storage/presign', { json: body }).json(),
  }

  onboarding = {
    pickRole: (sessionId: string, role: Role): Promise<void> =>
      this.http.post('onboarding/role', { json: { sessionId, role } }).then(() => undefined),

    trackEvent: (
      sessionId: string,
      step: string,
      metadata?: Record<string, unknown>,
    ): Promise<void> =>
      this.http
        .post('onboarding/event', { json: { sessionId, step, metadata } })
        .then(() => undefined),

    state: (): Promise<{
      role: Role
      mirrorComplete: boolean
      mentorOnboardingSubmitted: boolean
      mentorVerified: boolean
      verificationDocsSubmitted: boolean
      nextStep: string | null
    } | null> => this.http.get('onboarding/state').json(),

    submitMirror: (body: {
      journeyStage: string
      background?: string
      knowledge?: Record<string, number>
      challenges: string[]
    }) => this.http.post('onboarding/mirror', { json: body }).json(),

    submitMentor: (body: {
      journeyType: string
      prelimsCleared: boolean
      mainsAttempts: number
      interviewAttempts: number
      attemptHistory: Array<{ year: number; prelims: boolean; mains: boolean; interview: boolean }>
      rankAchieved?: number
      optionalSubject?: string
      guidanceCategories: string[]
      languages: string[]
      hourlyRateInr?: number
    }) => this.http.post('onboarding/mentor', { json: body }).json(),

    submitVerification: (body: {
      aadhaarKey: string
      hallTicketKey: string
      marksSheetKey?: string
      aadhaarLast4: string
      bankAccount: {
        accountNumber: string
        ifsc: string
        beneficiaryName: string
        upiId?: string
      }
    }): Promise<{ status: string; nextStep: string }> =>
      this.http.post('onboarding/mentor/verification', { json: body }).json(),
  }

  subscriptions = {
    me: () =>
      this.http.get('subscriptions/me').json<{
        tier: 'FREE' | 'BASIC' | 'PRO' | 'MAX'
        status?: string
        currentPeriodEnd?: string | null
        razorpaySubscriptionId?: string | null
      }>(),

    checkout: (tier: 'BASIC' | 'PRO' | 'MAX') =>
      this.http.post('subscriptions/checkout', { json: { tier } }).json<{
        orderId: string
        checkoutUrl: string
        simulated: boolean
        tier: string
      }>(),

    cancel: () =>
      this.http.post('subscriptions/cancel').json<{ status: string }>(),

    simulateSuccess: (tier: 'BASIC' | 'PRO' | 'MAX') =>
      this.http
        .post('subscriptions/simulate-success', { json: { tier } })
        .json<{ tier: string; status: string; currentPeriodEnd: string; simulated: boolean }>(),
  }

  chat = {
    listConversations: (): Promise<ConversationSummary[]> =>
      this.http.get('conversations').json(),

    getMessages: (
      conversationId: string,
      params?: { limit?: number; before?: string },
    ): Promise<Message[]> =>
      this.http
        .get(`conversations/${conversationId}/messages`, {
          searchParams: {
            ...(params?.limit ? { limit: params.limit } : {}),
            ...(params?.before ? { before: params.before } : {}),
          },
        })
        .json(),

    reportMessage: (messageId: string, reason: string, details?: string): Promise<{ id: string }> =>
      this.http
        .post(`chat/messages/${messageId}/report`, { json: { reason, details } })
        .json(),
  }

  admin = {
    // ─── Moderation ──────────────────────────────────────────────────────

    moderation: {
      list: (params?: {
        status?: 'PENDING' | 'REVIEWED_NO_ACTION' | 'REVIEWED_BANNED'
        limit?: number
        cursor?: string
      }) =>
        this.http
          .get('admin/moderation/reports', {
            searchParams: {
              ...(params?.status ? { status: params.status } : {}),
              ...(params?.limit ? { limit: params.limit } : {}),
              ...(params?.cursor ? { cursor: params.cursor } : {}),
            },
          })
          .json<{
            items: Array<{
              id: string
              createdAt: string
              status: string
              reason: string
              reporter: { id: string; displayHandle: string; avatarLetter: string; avatarColor: string }
              target: { id: string; displayHandle: string; avatarLetter: string; avatarColor: string }
              messageSnippet: string
              conversationId: string
            }>
            nextCursor: string | null
          }>(),

      detail: (id: string) =>
        this.http.get(`admin/moderation/reports/${id}`).json<{
          id: string
          createdAt: string
          status: string
          reason: string
          outcome: string | null
          reviewedAt: string | null
          reporter: { id: string; displayHandle: string; avatarLetter: string; avatarColor: string }
          target: { id: string; displayHandle: string; avatarLetter: string; avatarColor: string }
          targetUserId: string
          message: { id: string; body: string | null; type: string; createdAt: string }
          conversationId: string
          contextMessages: Array<{ id: string; body: string | null; type: string; createdAt: string }>
        }>(),

      resolve: (id: string, action: 'DISMISS' | 'WARN' | 'SUSPEND' | 'BAN', notes?: string) =>
        this.http
          .patch(`admin/moderation/reports/${id}/resolve`, { json: { action, notes } })
          .json<{ ok: boolean; action: string }>(),
    },

    users: {
      get: (id: string) =>
        this.http.get(`admin/users/${id}`).json<{
          id: string
          phone: string | null
          email: string | null
          role: string
          status: string
          createdAt: string
          bannedAt: string | null
          profile: {
            displayHandle: string
            avatarLetter: string
            avatarColor: string
            hasPurpleTick: boolean
          } | null
          mentorProfile: { isVerified: boolean; journeyType: string } | null
          verification: {
            submittedAt: string
            reviewedAt: string | null
            aadhaarHashSuffix: string | null
            hasAadhaar: boolean
          } | null
          actionHistory: Array<{ id: string; action: string; reason: string; createdAt: string }>
        }>(),

      setStatus: (id: string, status: string, reason?: string) =>
        this.http
          .patch(`admin/users/${id}/status`, { json: { status, reason } })
          .json<{ ok: boolean; status: string }>(),
    },

    // ─── Existing ────────────────────────────────────────────────────────

    listUsers: (filters?: { role?: Role; status?: string }) =>
      this.http
        .get('admin/users', {
          searchParams: {
            ...(filters?.role ? { role: filters.role } : {}),
            ...(filters?.status ? { status: filters.status } : {}),
          },
        })
        .json<
          Array<{
            id: string
            phone: string | null
            email: string | null
            role: Role
            status: string
            createdAt: string
            displayHandle: string | null
            avatarLetter: AvatarLetter | null
            avatarColor: AvatarColor | null
            hasPurpleTick: boolean
            mentorVerified: boolean
          }>
        >(),

    setUserRole: (userId: string, role: Role) =>
      this.http.patch(`admin/users/${userId}/role`, { json: { role } }).json(),

    listPendingMentors: () =>
      this.http
        .get('admin/mentors/pending')
        .json<
          Array<{
            id: string
            displayHandle: string | null
            avatarLetter: AvatarLetter | null
            avatarColor: AvatarColor | null
            hasPurpleTick: boolean
            status: string
            createdAt: string
            mentorProfile: {
              journeyType: string
              prelimsCleared: boolean
              mainsAttempts: number
              interviewAttempts: number
              isVerified: boolean
            } | null
            verification: {
              submittedAt: string
              reviewedAt: string | null
              reviewNote: string | null
              aadhaarSignedUrl: string | null
              hallTicketSignedUrl: string | null
              marksSheetSignedUrl: string | null
              hasBankAccount: boolean
              hasMarksSheet: boolean
            } | null
          }>
        >(),

    approveMentor: (userId: string, reviewNote?: string) =>
      this.http.post(`admin/mentors/${userId}/approve`, { json: { reviewNote } }).json(),

    rejectMentor: (userId: string, reason: string) =>
      this.http.post(`admin/mentors/${userId}/reject`, { json: { reason } }).json(),

    banMentor: (userId: string, reason: string) =>
      this.http.post(`admin/mentors/${userId}/ban`, { json: { reason } }).json(),

    listAuditLogs: (limit = 50) =>
      this.http
        .get('admin/audit-logs', { searchParams: { limit } })
        .json<
          Array<{
            id: string
            actorId: string | null
            action: string
            targetType: string | null
            targetId: string | null
            metadata: Record<string, unknown> | null
            createdAt: string
          }>
        >(),

    createAssignment: (mentorId: string, aspirantId: string) =>
      this.http.post('assignments', { json: { mentorId, aspirantId } }).json<{
        assignment: { id: string; mentorId: string; aspirantId: string; status: string }
        conversation: { id: string; mentorId: string; aspirantId: string }
      }>(),

    listAssignments: () => this.http.get('assignments').json(),

    endAssignment: (id: string) => this.http.delete(`assignments/${id}`).json(),
  }
}

export { createSocketClient } from './socket'
export type { SocketClient } from './socket'
