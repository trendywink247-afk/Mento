/**
 * Shared auth helpers for Mento E2E tests.
 *
 * All functions talk directly to the API (no browser) and return typed objects
 * so callers can pass tokens directly in request headers.
 *
 * Preconditions:
 *  - API is running on API_BASE_URL (default: http://localhost:4000)
 *  - MSG91_ENABLED=false (dev mode — devCode is returned in OTP response)
 *  - ADMIN_BOOTSTRAP_PHONE=+910000000000 must be seeded (pnpm db:seed)
 */

import type { APIRequestContext } from '@playwright/test'

const API = process.env.API_BASE_URL ?? 'http://localhost:4000'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DevSession {
  accessToken: string
  refreshToken: string
  userId: string
  displayHandle: string
  role: string
}

// ─── Unique phone generator ───────────────────────────────────────────────────

/**
 * Generate a unique +91 phone for test isolation.
 * Uses Math.random to avoid needing Node's crypto module in browsers.
 */
export function uniquePhone(): string {
  const suffix = String(Math.floor(Math.random() * 9_000_000_000) + 1_000_000_000)
  return `+91${suffix}`
}

// ─── OTP flow ─────────────────────────────────────────────────────────────────

async function withBackoff<T>(fn: () => Promise<T>, attempts = 5): Promise<T> {
  let last: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      last = err
      await new Promise((r) => setTimeout(r, 200 * (i + 1)))
    }
  }
  throw last instanceof Error ? last : new Error(String(last))
}

/**
 * Request OTP and verify using devCode (dev-mode only).
 * Returns a full DevSession including accessToken, refreshToken, userId, role.
 */
export async function requestOtpAndVerify(
  request: APIRequestContext,
  phone: string,
): Promise<DevSession> {
  const otpRes = await withBackoff(async () => {
    const r = await request.post(`${API}/auth/otp/request`, { data: { phone } })
    if (r.status() === 429) throw new Error('throttled')
    return r
  })
  if (!otpRes.ok()) {
    throw new Error(`OTP request failed: ${otpRes.status()} ${await otpRes.text()}`)
  }
  const otpBody = (await otpRes.json()) as { devCode?: string }
  const code = otpBody.devCode
  if (!code) {
    throw new Error('devCode not returned — is MSG91_ENABLED=false?')
  }

  const verifyRes = await withBackoff(async () => {
    const r = await request.post(`${API}/auth/otp/verify`, { data: { phone, code } })
    if (r.status() === 429) throw new Error('throttled')
    return r
  })
  if (!verifyRes.ok()) {
    throw new Error(`OTP verify failed: ${verifyRes.status()} ${await verifyRes.text()}`)
  }

  const body = (await verifyRes.json()) as {
    user: { id: string; role: string }
    profile: { displayHandle: string } | null
    tokens: { accessToken: string; refreshToken: string }
  }

  return {
    accessToken: body.tokens.accessToken,
    refreshToken: body.tokens.refreshToken,
    userId: body.user.id,
    displayHandle: body.profile?.displayHandle ?? '',
    role: body.user.role,
  }
}

// ─── Admin session ────────────────────────────────────────────────────────────

/**
 * Return a session for the bootstrap admin account.
 * Requires ADMIN_BOOTSTRAP_PHONE to be set in .env and seeded.
 */
export async function createAdminSession(request: APIRequestContext): Promise<DevSession> {
  const phone = process.env.ADMIN_BOOTSTRAP_PHONE ?? '+910000000000'
  return requestOtpAndVerify(request, phone)
}

// ─── Role-specific helpers ────────────────────────────────────────────────────

/**
 * Create a fresh ASPIRANT user and complete the mentee Mirror onboarding via API.
 * Returns a DevSession with role=ASPIRANT.
 */
export async function createAspirant(
  request: APIRequestContext,
  phone?: string,
): Promise<DevSession> {
  const p = phone ?? uniquePhone()
  const session = await requestOtpAndVerify(request, p)

  // Complete Mirror onboarding so the user reaches the dashboard (nextStep = null).
  const mirror = await authedRequest(request, session).post(`${API}/onboarding/mirror`, {
    data: {
      journeyStage: 'ONE_YEAR_IN',
      background: 'coaching',
      knowledge: { Polity: 0.3, History: 0.5 },
      challenges: ['Inconsistency', 'Distraction'],
    },
  })
  if (!mirror.ok()) {
    // May already be completed if reusing a phone — that is fine.
    const txt = await mirror.text()
    if (!txt.includes('already')) {
      throw new Error(`Mirror submit failed: ${mirror.status()} ${txt}`)
    }
  }

  return session
}

/**
 * Create a fresh MENTOR user and complete mentor onboarding via API.
 * Returns a DevSession with role=MENTOR.
 *
 * Note: the mentor is created but may not be verified (isVerified=false).
 * That is fine for sessions tests — the mentor can still accept requests.
 */
export async function createMentor(
  request: APIRequestContext,
  phone?: string,
): Promise<DevSession> {
  const p = phone ?? uniquePhone()
  const session = await requestOtpAndVerify(request, p)

  const onboard = await authedRequest(request, session).post(`${API}/onboarding/mentor`, {
    data: {
      journeyType: 'MAINS_ONCE',
      prelimsCleared: true,
      mainsAttempts: 1,
      interviewAttempts: 0,
      attemptHistory: [{ year: 2024, prelims: true, mains: true, interview: false }],
      guidanceCategories: ['Mains', 'Essay'],
      languages: ['en', 'hi'],
      hourlyRateInr: 500,
    },
  })
  if (!onboard.ok()) {
    throw new Error(`Mentor onboarding failed: ${onboard.status()} ${await onboard.text()}`)
  }

  // After onboarding, re-read the session to get the updated role token.
  // The token from verifyOtp still has role=ASPIRANT — we need to re-auth so
  // the JWT reflects MENTOR. Re-request OTP using the same phone.
  return requestOtpAndVerify(request, p)
}

// ─── Convenience wrappers ─────────────────────────────────────────────────────

/**
 * Return a request context pre-configured with Authorization header.
 * Usage: authedRequest(request, session).get('/subscriptions/me')
 */
export function authedRequest(request: APIRequestContext, session: DevSession) {
  const headers = { Authorization: `Bearer ${session.accessToken}` }
  return {
    get: (url: string, opts?: Parameters<APIRequestContext['get']>[1]) =>
      request.get(url, { ...opts, headers: { ...headers, ...opts?.headers } }),
    post: (url: string, opts?: Parameters<APIRequestContext['post']>[1]) =>
      request.post(url, { ...opts, headers: { ...headers, ...opts?.headers } }),
    patch: (url: string, opts?: Parameters<APIRequestContext['patch']>[1]) =>
      request.patch(url, { ...opts, headers: { ...headers, ...opts?.headers } }),
    delete: (url: string, opts?: Parameters<APIRequestContext['delete']>[1]) =>
      request.delete(url, { ...opts, headers: { ...headers, ...opts?.headers } }),
  }
}

/** Shorthand for Authorization header object — use when passing headers directly. */
export function authHeader(session: DevSession): Record<string, string> {
  return { Authorization: `Bearer ${session.accessToken}` }
}
