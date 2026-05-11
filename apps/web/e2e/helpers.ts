import type { APIRequestContext } from '@playwright/test'

const API = process.env.API_BASE_URL ?? 'http://localhost:4000'

export interface DevSession {
  accessToken: string
  refreshToken: string
  userId: string
  displayHandle: string
}

/** Generate a unique phone number per test run to avoid OTP rate-limit collisions. */
export function uniquePhone(): string {
  const suffix = String(Math.floor(Math.random() * 1_000_000_000)).padStart(10, '0')
  return `+91${suffix.slice(0, 10)}`
}

async function withBackoff<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let last: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      last = err
      // Linear backoff: 200ms, 400ms, 800ms
      await new Promise((r) => setTimeout(r, 200 * (i + 1)))
    }
  }
  throw last instanceof Error ? last : new Error(String(last))
}

export async function requestAndVerifyOtp(
  req: APIRequestContext,
  phone: string,
): Promise<DevSession> {
  const otpRes = await withBackoff(async () => {
    const r = await req.post(`${API}/auth/otp/request`, { data: { phone } })
    if (r.status() === 429) throw new Error('throttled')
    return r
  })
  if (!otpRes.ok()) throw new Error(`OTP request failed: ${otpRes.status()} ${await otpRes.text()}`)
  const otpBody = (await otpRes.json()) as { devCode: string }
  const code = otpBody.devCode
  if (!code) throw new Error('Dev mode did not return devCode — is MSG91_ENABLED=true?')

  const verifyRes = await withBackoff(async () => {
    const r = await req.post(`${API}/auth/otp/verify`, { data: { phone, code } })
    if (r.status() === 429) throw new Error('throttled')
    return r
  })
  if (!verifyRes.ok())
    throw new Error(`OTP verify failed: ${verifyRes.status()} ${await verifyRes.text()}`)
  const session = (await verifyRes.json()) as {
    user: { id: string }
    profile: { displayHandle: string } | null
    tokens: { accessToken: string; refreshToken: string }
  }
  return {
    accessToken: session.tokens.accessToken,
    refreshToken: session.tokens.refreshToken,
    userId: session.user.id,
    displayHandle: session.profile?.displayHandle ?? '',
  }
}

export function authHeader(s: DevSession) {
  return { Authorization: `Bearer ${s.accessToken}` }
}
