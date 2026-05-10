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
            if (res.status === 401) opts.onUnauthorized?.()
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

    refresh: (refreshToken: string): Promise<AuthTokens> =>
      this.http.post('auth/refresh', { json: { refreshToken } }).json(),

    logout: (refreshToken: string): Promise<void> =>
      this.http.post('auth/logout', { json: { refreshToken } }).json(),
  }

  users = {
    me: (): Promise<{ user: User; profile: Profile | null }> => this.http.get('me').json(),
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
  }

  admin = {
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

    approveMentor: (userId: string) =>
      this.http.post(`admin/mentors/${userId}/approve`).json(),

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

export { createSocketClient } from './socket.js'
export type { SocketClient } from './socket.js'
