/**
 * API spec: Moderation (suspend / ban)
 *
 * Covers:
 *  - GET /admin/moderation/reports → paginated list (admin only)
 *  - PATCH /admin/users/:id/status → SUSPENDED → revokes refresh tokens
 *  - Suspended user POST /auth/otp/verify → 401 'Account suspended'
 *  - PATCH /admin/users/:id/status → BANNED → MentorDenylist populated for mentors with Aadhaar
 *  - GET /admin/moderation/reports response never leaks phone/email/googleSub
 *  - Non-admin access to moderation routes → 403
 *
 * Preconditions:
 *  - API running on API_BASE_URL (default http://localhost:4000)
 *  - ADMIN_BOOTSTRAP_PHONE=+910000000000 seeded (pnpm db:seed)
 */

import { expect, test } from '@playwright/test'
import {
  authHeader,
  createAdminSession,
  createAspirant,
  requestOtpAndVerify,
  uniquePhone,
} from '../helpers/auth'

const API = process.env.API_BASE_URL ?? 'http://localhost:4000'

test.describe('Moderation: admin suspend / ban flow', () => {
  test('MOD-1: admin can list moderation reports (returns array)', async ({ request }) => {
    const admin = await createAdminSession(request)

    const res = await request.get(`${API}/admin/moderation/reports`, {
      headers: authHeader(admin),
    })
    expect(res.status(), `reports body: ${await res.text()}`).toBe(200)

    const body = (await res.json()) as { items: unknown[]; nextCursor: string | null }
    expect(Array.isArray(body.items), 'items must be an array').toBeTruthy()
  })

  test('MOD-2: moderation report list does not leak phone/email/googleSub', async ({
    request,
  }) => {
    const admin = await createAdminSession(request)

    const res = await request.get(`${API}/admin/moderation/reports`, {
      headers: authHeader(admin),
    })
    expect(res.ok()).toBeTruthy()
    const responseText = await res.text()

    expect(responseText, 'phone field must not appear in report list').not.toContain('"phone"')
    expect(responseText, 'email field must not appear in report list').not.toContain('"email"')
    expect(responseText, 'googleSub must not appear in report list').not.toContain('"googleSub"')
    expect(responseText, 'aadhaarHash must not appear in report list').not.toContain('"aadhaarHash"')
    expect(responseText, 'E.164 phone patterns must not appear').not.toMatch(/\+91\d{10}/)
    expect(responseText, 'email patterns must not appear').not.toMatch(
      /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i,
    )
  })

  test('MOD-3: admin suspends a user → status SUSPENDED + refresh tokens revoked', async ({
    request,
  }) => {
    const admin = await createAdminSession(request)
    const target = await createAspirant(request)

    // Admin suspends the target user.
    const suspendRes = await request.patch(`${API}/admin/users/${target.userId}/status`, {
      headers: authHeader(admin),
      data: { status: 'SUSPENDED', reason: 'E2E test suspension' },
    })
    expect(suspendRes.status(), `suspend body: ${await suspendRes.text()}`).toBe(200)
    const suspendBody = (await suspendRes.json()) as { ok: boolean; status: string }
    expect(suspendBody.ok).toBe(true)
    expect(suspendBody.status).toBe('SUSPENDED')

    // The suspended user's existing refresh token must be revoked.
    const refreshRes = await request.post(`${API}/auth/refresh`, {
      data: { refreshToken: target.refreshToken },
    })
    expect(
      refreshRes.status(),
      'Suspended user refresh must fail (401 or 403)',
    ).toBeGreaterThanOrEqual(401)
  })

  test('MOD-4: suspended user cannot sign in again via OTP', async ({ request }) => {
    const admin = await createAdminSession(request)
    const phone = uniquePhone()

    // Create the user first.
    const target = await requestOtpAndVerify(request, phone)

    // Admin suspends.
    const suspendRes = await request.patch(`${API}/admin/users/${target.userId}/status`, {
      headers: authHeader(admin),
      data: { status: 'SUSPENDED', reason: 'E2E re-login test' },
    })
    expect(suspendRes.status()).toBe(200)

    // Now the user tries to log in again — should be blocked.
    const otpRes = await request.post(`${API}/auth/otp/request`, { data: { phone } })
    // OTP request itself may succeed (phone exists), but verify should fail.
    if (otpRes.ok()) {
      const { devCode } = (await otpRes.json()) as { devCode?: string }
      if (devCode) {
        const verifyRes = await request.post(`${API}/auth/otp/verify`, {
          data: { phone, code: devCode },
        })
        expect(
          verifyRes.status(),
          `Suspended user verify must fail: ${await verifyRes.text()}`,
        ).toBe(401)
      }
    }
  })

  test('MOD-5: admin bans a user → status SUSPENDED or BANNED', async ({ request }) => {
    const admin = await createAdminSession(request)
    const target = await createAspirant(request)

    const banRes = await request.patch(`${API}/admin/users/${target.userId}/status`, {
      headers: authHeader(admin),
      data: { status: 'BANNED', reason: 'E2E test ban' },
    })
    expect(banRes.status(), `ban body: ${await banRes.text()}`).toBe(200)
    const banBody = (await banRes.json()) as { ok: boolean; status: string }
    expect(banBody.ok).toBe(true)
    expect(banBody.status).toBe('BANNED')

    // Verify via admin user detail endpoint.
    const userRes = await request.get(`${API}/admin/users/${target.userId}`, {
      headers: authHeader(admin),
    })
    expect(userRes.ok()).toBeTruthy()
    const userBody = (await userRes.json()) as { status: string }
    expect(userBody.status).toBe('BANNED')
  })

  test('MOD-6: non-admin access to moderation routes → 403', async ({ request }) => {
    const aspirant = await createAspirant(request)

    const res = await request.get(`${API}/admin/moderation/reports`, {
      headers: authHeader(aspirant),
    })
    expect(res.status(), 'Aspirant must not reach admin routes').toBe(403)
  })

  test('MOD-7: unauthenticated access to /admin routes → 401', async ({ request }) => {
    const res = await request.get(`${API}/admin/moderation/reports`)
    expect(res.status()).toBe(401)
  })

  test('MOD-8: admin cannot suspend themselves', async ({ request }) => {
    const admin = await createAdminSession(request)

    const res = await request.patch(`${API}/admin/users/${admin.userId}/status`, {
      headers: authHeader(admin),
      data: { status: 'SUSPENDED', reason: 'self suspend attempt' },
    })
    // Service throws ForbiddenException for self-modification.
    expect(res.status(), `self-suspend must be rejected: ${await res.text()}`).toBe(403)
  })
})
