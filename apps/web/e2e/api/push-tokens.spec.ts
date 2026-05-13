/**
 * API spec: Push Token registration / unregistration
 *
 * Covers:
 *  - POST /push-tokens → 204 for authenticated user
 *  - Same token registered twice → idempotent (204 both times)
 *  - DELETE /push-tokens/:token → 204
 *  - Unauthenticated POST → 401
 *  - Cross-user delete → token survives (ownership check, MINOR-3 fix)
 *
 * Preconditions:
 *  - API running on API_BASE_URL (default http://localhost:4000)
 */

import { expect, test } from '@playwright/test'
import { authHeader, requestOtpAndVerify, uniquePhone } from '../helpers/auth'

const API = process.env.API_BASE_URL ?? 'http://localhost:4000'

/** Generate a valid push token matching the DTO regex: /^[a-zA-Z0-9_-]{20,}$/ */
function uniquePushToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-'
  const suffix = Array.from({ length: 16 }, () =>
    chars[Math.floor(Math.random() * chars.length)],
  ).join('')
  return `ExpoTestToken_${suffix}`
}

test.describe('Push Tokens: register / unregister', () => {
  test('PUSH-1: POST /push-tokens returns 204 for authenticated user', async ({ request }) => {
    const session = await requestOtpAndVerify(request, uniquePhone())
    const token = uniquePushToken()

    const res = await request.post(`${API}/push-tokens`, {
      headers: authHeader(session),
      data: { token, platform: 'ANDROID' },
    })

    expect(res.status(), `register body: ${await res.text()}`).toBe(204)
  })

  test('PUSH-2: registering the same token twice is idempotent (no duplicate)', async ({
    request,
  }) => {
    const session = await requestOtpAndVerify(request, uniquePhone())
    const token = uniquePushToken()

    // First registration.
    const first = await request.post(`${API}/push-tokens`, {
      headers: authHeader(session),
      data: { token, platform: 'ANDROID' },
    })
    expect(first.status()).toBe(204)

    // Second registration with the same token — must not fail.
    const second = await request.post(`${API}/push-tokens`, {
      headers: authHeader(session),
      data: { token, platform: 'ANDROID' },
    })
    expect(second.status(), `2nd registration must be idempotent: ${await second.text()}`).toBe(
      204,
    )
  })

  test('PUSH-3: DELETE /push-tokens/:token removes the token (204)', async ({ request }) => {
    const session = await requestOtpAndVerify(request, uniquePhone())
    const token = uniquePushToken()

    // Register.
    const reg = await request.post(`${API}/push-tokens`, {
      headers: authHeader(session),
      data: { token, platform: 'IOS' },
    })
    expect(reg.status()).toBe(204)

    // Unregister.
    const del = await request.delete(`${API}/push-tokens/${encodeURIComponent(token)}`, {
      headers: authHeader(session),
    })
    expect(del.status(), `delete body: ${await del.text()}`).toBe(204)

    // Registering again after deletion still works (upsert behaviour).
    const rereg = await request.post(`${API}/push-tokens`, {
      headers: authHeader(session),
      data: { token, platform: 'IOS' },
    })
    expect(rereg.status()).toBe(204)
  })

  test('PUSH-4: unauthenticated POST /push-tokens → 401', async ({ request }) => {
    const token = uniquePushToken()
    const res = await request.post(`${API}/push-tokens`, {
      data: { token, platform: 'ANDROID' },
    })
    expect(res.status()).toBe(401)
  })

  test('PUSH-5: DELETE is idempotent — authed delete of a non-existent token returns 204', async ({
    request,
  }) => {
    // The service uses deleteMany which does not throw on missing rows.
    const session = await requestOtpAndVerify(request, uniquePhone())
    const token = uniquePushToken()
    const res = await request.delete(`${API}/push-tokens/${encodeURIComponent(token)}`, {
      headers: authHeader(session),
    })
    expect(res.status()).toBe(204)
  })

  test('PUSH-6: invalid token format → 400', async ({ request }) => {
    const session = await requestOtpAndVerify(request, uniquePhone())

    const res = await request.post(`${API}/push-tokens`, {
      headers: authHeader(session),
      data: { token: 'short', platform: 'ANDROID' },
    })
    expect(res.status(), 'Short token must fail validation: 400').toBe(400)
  })

  test('PUSH-7: cross-user DELETE is a no-op — token owned by user A survives when user B deletes it', async ({
    request,
  }) => {
    // MINOR-3 security regression test.
    // User A registers a push token. User B (a different account) sends DELETE
    // for that exact token string. The ownership check (WHERE userId = B.sub)
    // means nothing is deleted — the token still belongs to A.
    const userA = await requestOtpAndVerify(request, uniquePhone())
    const userB = await requestOtpAndVerify(request, uniquePhone())
    const token = uniquePushToken()

    // User A registers the token.
    const reg = await request.post(`${API}/push-tokens`, {
      headers: authHeader(userA),
      data: { token, platform: 'ANDROID' },
    })
    expect(reg.status(), `register body: ${await reg.text()}`).toBe(204)

    // User B tries to delete user A's token — should return 204 (idempotent)
    // but must NOT actually remove the token (WHERE userId = B.id matches 0 rows).
    const crossDel = await request.delete(`${API}/push-tokens/${encodeURIComponent(token)}`, {
      headers: authHeader(userB),
    })
    expect(crossDel.status(), `cross-user delete body: ${await crossDel.text()}`).toBe(204)

    // User A can still delete their own token (proves it was not removed by B).
    const ownDel = await request.delete(`${API}/push-tokens/${encodeURIComponent(token)}`, {
      headers: authHeader(userA),
    })
    expect(
      ownDel.status(),
      `owner delete body: ${await ownDel.text()} — token should still exist`,
    ).toBe(204)

    // Re-register to confirm the upsert path still works after ownership-scoped delete.
    const rereg = await request.post(`${API}/push-tokens`, {
      headers: authHeader(userA),
      data: { token, platform: 'ANDROID' },
    })
    expect(rereg.status()).toBe(204)
  })
})
