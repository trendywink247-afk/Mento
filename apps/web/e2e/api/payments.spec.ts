/**
 * API spec: Payments / Subscription tier paywall
 *
 * Covers:
 *  - GET /subscriptions/me → FREE for new user
 *  - POST /subscriptions/simulate-success → activates PRO tier (dev mode)
 *  - POST /journals/save-from-chat as FREE → 402 with requiredTier/currentTier
 *  - POST /journals/save-from-chat as PRO → passes tier guard (200 or 404/400 on missing data)
 *  - POST /subscriptions/cancel → CANCELLED, GET /subscriptions/me → FREE again
 *
 * Preconditions:
 *  - API running on API_BASE_URL (default http://localhost:4000)
 *  - RAZORPAY_KEY_ID unset (dev mode) so simulate-success is permitted
 */

import { expect, test } from '@playwright/test'
import { authHeader, createAspirant, requestOtpAndVerify, uniquePhone } from '../helpers/auth'

const API = process.env.API_BASE_URL ?? 'http://localhost:4000'

test.describe('Payments: subscription tier paywall', () => {
  test('PAY-1: new user starts on FREE tier', async ({ request }) => {
    const session = await requestOtpAndVerify(request, uniquePhone())

    const res = await request.get(`${API}/subscriptions/me`, {
      headers: authHeader(session),
    })

    expect(res.status(), `GET /subscriptions/me body: ${await res.text()}`).toBe(200)
    const body = (await res.json()) as { tier: string }
    expect(body.tier).toBe('FREE')
  })

  test('PAY-2: simulate-success activates PRO subscription', async ({ request }) => {
    const session = await requestOtpAndVerify(request, uniquePhone())

    const simRes = await request.post(`${API}/subscriptions/simulate-success`, {
      headers: authHeader(session),
      data: { tier: 'PRO' },
    })
    expect(simRes.status(), `simulate-success body: ${await simRes.text()}`).toBe(201)

    const body = (await simRes.json()) as { tier: string; status: string; simulated: boolean }
    expect(body.tier).toBe('PRO')
    expect(body.status).toBe('ACTIVE')
    expect(body.simulated).toBe(true)

    // Confirm GET /subscriptions/me reflects the new tier.
    const meRes = await request.get(`${API}/subscriptions/me`, {
      headers: authHeader(session),
    })
    expect(meRes.ok()).toBeTruthy()
    const me = (await meRes.json()) as { tier: string; status: string }
    expect(me.tier).toBe('PRO')
    expect(me.status).toBe('ACTIVE')
  })

  test('PAY-3: FREE user gets 402 on POST /journals/save-from-chat', async ({ request }) => {
    // createAspirant completes Mirror so user is a proper aspirant.
    const session = await createAspirant(request)

    // This endpoint requires PRO tier — a FREE user gets 402.
    const res = await request.post(`${API}/journals/save-from-chat`, {
      headers: authHeader(session),
      data: {
        messageId: '00000000-0000-0000-0000-000000000001',
        category: 'PERSONAL',
      },
    })

    expect(res.status(), `Expected 402 for FREE tier, got: ${await res.text()}`).toBe(402)
    const body = (await res.json()) as { requiredTier?: string; currentTier?: string }
    expect(body.requiredTier).toBe('PRO')
    expect(body.currentTier).toBe('FREE')
  })

  test('PAY-4: PRO user passes tier guard on POST /journals/save-from-chat', async ({
    request,
  }) => {
    const session = await createAspirant(request)

    // Activate PRO first.
    const simRes = await request.post(`${API}/subscriptions/simulate-success`, {
      headers: authHeader(session),
      data: { tier: 'PRO' },
    })
    expect(simRes.status()).toBe(201)

    // POST /journals/save-from-chat should now pass the tier guard.
    // The messageId is a dummy UUID so the service will return 404 (message not found),
    // NOT 402 — which proves the tier guard was passed.
    const res = await request.post(`${API}/journals/save-from-chat`, {
      headers: authHeader(session),
      data: {
        messageId: '00000000-0000-0000-0000-000000000001',
        category: 'PERSONAL',
      },
    })

    // 404 = tier guard passed, message just doesn't exist. Anything except 402 = PRO gate opened.
    expect(
      res.status(),
      `PRO user should not get 402; got ${res.status()}: ${await res.text()}`,
    ).not.toBe(402)
  })

  test('PAY-5: cancel subscription → status CANCELLED, GET /me shows FREE', async ({
    request,
  }) => {
    const phone = uniquePhone()
    const session = await requestOtpAndVerify(request, phone)

    // Activate PRO.
    const sim = await request.post(`${API}/subscriptions/simulate-success`, {
      headers: authHeader(session),
      data: { tier: 'PRO' },
    })
    expect(sim.status()).toBe(201)

    // Cancel.
    const cancelRes = await request.post(`${API}/subscriptions/cancel`, {
      headers: authHeader(session),
    })
    expect(cancelRes.status(), `cancel body: ${await cancelRes.text()}`).toBe(201)
    const cancelBody = (await cancelRes.json()) as { status: string }
    expect(cancelBody.status).toBe('cancelled')

    // After cancellation, GET /subscriptions/me should show FREE (no active sub).
    const meRes = await request.get(`${API}/subscriptions/me`, {
      headers: authHeader(session),
    })
    expect(meRes.ok()).toBeTruthy()
    const me = (await meRes.json()) as { tier: string }
    expect(me.tier).toBe('FREE')
  })

  test('PAY-6: unauthenticated GET /subscriptions/me → 401', async ({ request }) => {
    const res = await request.get(`${API}/subscriptions/me`)
    expect(res.status()).toBe(401)
  })
})
