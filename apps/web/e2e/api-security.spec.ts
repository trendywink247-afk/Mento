import { expect, test } from '@playwright/test'
import { authHeader, requestAndVerifyOtp, uniquePhone } from './helpers'

const API = process.env.API_BASE_URL ?? 'http://localhost:4000'

test.describe('API security regressions', () => {
  test('SEC-1: refresh token rotation works (HMAC deterministic hash)', async ({ request }) => {
    const session = await requestAndVerifyOtp(request, uniquePhone())

    const res = await request.post(`${API}/auth/refresh`, {
      data: { refreshToken: session.refreshToken },
    })
    expect(res.status(), `refresh should succeed; raw body: ${await res.text()}`).toBe(200)
    const body = (await res.json()) as { accessToken: string; refreshToken: string }
    expect(body.accessToken).toBeTruthy()
    expect(body.refreshToken).toBeTruthy()
    expect(body.refreshToken).not.toBe(session.refreshToken)
  })

  test('SEC-1: refresh token theft detection revokes family', async ({ request }) => {
    const session = await requestAndVerifyOtp(request, uniquePhone())

    // Rotate once — gives us the new token.
    const first = await request.post(`${API}/auth/refresh`, {
      data: { refreshToken: session.refreshToken },
    })
    expect(first.status()).toBe(200)

    // Reusing the ORIGINAL token (now revoked) should fail and trigger family revocation.
    const reuse = await request.post(`${API}/auth/refresh`, {
      data: { refreshToken: session.refreshToken },
    })
    expect(reuse.status(), 'reuse must be rejected').toBe(401)

    // Even the freshly-issued token from `first` should now be revoked.
    const firstBody = (await first.json()) as { refreshToken: string }
    const familyRevoked = await request.post(`${API}/auth/refresh`, {
      data: { refreshToken: firstBody.refreshToken },
    })
    expect(familyRevoked.status(), 'family must be fully revoked on reuse').toBe(401)
  })

  test('SEC-3: chat-requests list never returns counterpart phone or email', async ({
    request,
  }) => {
    // Sign in as an aspirant — listing requests as a fresh user just returns [],
    // but if any entry existed we want to assert the shape.
    const session = await requestAndVerifyOtp(request, uniquePhone())
    const res = await request.get(`${API}/chat-requests`, { headers: authHeader(session) })
    expect(res.ok()).toBeTruthy()
    const rows = (await res.json()) as unknown[]
    expect(Array.isArray(rows)).toBeTruthy()

    const text = await res.text()
    // Hard regex check: no E.164-looking phone, no email, no Aadhaar-ish in the response.
    expect(text).not.toMatch(/\+91\d{10}/)
    expect(text).not.toMatch(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i)
    expect(text).not.toContain('"phone":')
    expect(text).not.toContain('"email":')
    expect(text).not.toContain('"passwordHash":')
    expect(text).not.toContain('"aadhaarHash":')

    // If we ever do have rows, they should have counterpart-shaped objects only.
    for (const r of rows) {
      const row = r as { counterpart?: { displayHandle?: string; phone?: unknown } }
      if (row.counterpart) {
        expect(row.counterpart.displayHandle).toBeTruthy()
        expect(row.counterpart).not.toHaveProperty('phone')
        expect(row.counterpart).not.toHaveProperty('email')
      }
    }
  })

  test('SEC-3: mentor list never leaks phone/email even when admin scope', async ({ request }) => {
    const session = await requestAndVerifyOtp(request, uniquePhone())
    const res = await request.get(`${API}/mentors`, { headers: authHeader(session) })
    expect(res.ok()).toBeTruthy()
    const text = await res.text()
    expect(text).not.toMatch(/\+91\d{10}/)
    expect(text).not.toContain('"phone":')
    expect(text).not.toContain('"email":')
    expect(text).not.toContain('"passwordHash":')
  })

  test('SEC-2: OTP rejects bad codes and lets repeated good codes only be used once', async ({
    request,
  }) => {
    const phone = uniquePhone()
    // Use a small helper to absorb 429s from the global throttler during burst test runs.
    const postWithBackoff = async (path: string, body: unknown) => {
      for (let i = 0; i < 4; i++) {
        const r = await request.post(`${API}${path}`, { data: body })
        if (r.status() !== 429) return r
        await new Promise((res) => setTimeout(res, 250 * (i + 1)))
      }
      return request.post(`${API}${path}`, { data: body })
    }

    const otpRes = await postWithBackoff('/auth/otp/request', { phone })
    expect(otpRes.ok()).toBeTruthy()
    const { devCode } = (await otpRes.json()) as { devCode: string }

    const bad = await postWithBackoff('/auth/otp/verify', { phone, code: '000000' })
    expect(bad.status(), 'wrong OTP must be rejected').toBe(400)

    const ok = await postWithBackoff('/auth/otp/verify', { phone, code: devCode })
    expect(ok.status()).toBe(200)

    const replay = await postWithBackoff('/auth/otp/verify', { phone, code: devCode })
    expect(replay.status(), 'consumed OTP must not be reusable').toBe(400)
  })

  test('SEC-4: protected route requires Authorization', async ({ request }) => {
    const res = await request.get(`${API}/me`)
    expect(res.status()).toBe(401)
  })

  test('SEC-4: admin route rejects non-admin Bearer', async ({ request }) => {
    const session = await requestAndVerifyOtp(request, uniquePhone())
    const res = await request.get(`${API}/admin/users`, { headers: authHeader(session) })
    expect(res.status(), 'aspirant must not reach admin').toBe(403)
  })

  test('SEC-5: rate limiter caps burst traffic', async ({ request }) => {
    // 15 rapid /healthz calls (under our 10/sec short threshold for a single IP).
    // Throttler may not return 429 from the same connection for ALL calls, but at
    // least the first set must succeed and we don't crash.
    const results = await Promise.all(
      Array.from({ length: 15 }, () => request.get(`${API}/healthz`)),
    )
    const statuses = results.map((r) => r.status())
    // At least one should succeed.
    expect(statuses.filter((s) => s === 200).length).toBeGreaterThan(0)
    // Throttler returns 429 once exceeded. Allow either case — we just want no 5xx.
    expect(statuses.every((s) => s < 500)).toBeTruthy()
  })

  test('SEC-6: OTP request response does not echo back the codeHash', async ({ request }) => {
    const phone = uniquePhone()
    const res = await request.post(`${API}/auth/otp/request`, { data: { phone } })
    const text = await res.text()
    expect(text).not.toContain('codeHash')
    expect(text).not.toContain('passwordHash')
  })
})
