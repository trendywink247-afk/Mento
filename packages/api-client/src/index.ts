import ky, { type KyInstance } from 'ky'
import type {
  AuthSession,
  AuthTokens,
  Conversation,
  Message,
  OtpRequestResponse,
  Profile,
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

  chat = {
    listConversations: (): Promise<Conversation[]> => this.http.get('conversations').json(),

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
}

export { createSocketClient } from './socket.js'
export type { SocketClient } from './socket.js'
