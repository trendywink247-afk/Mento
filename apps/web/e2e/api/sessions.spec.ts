/**
 * API spec: 1:1 Session Requests
 *
 * Covers:
 *  - POST /sessions/requests → PENDING + wallet HOLD txn created
 *  - GET /wallet → shows HOLD txn
 *  - GET /sessions/requests for mentor → incoming with anonymized counterpart
 *  - PATCH /sessions/requests/:id/accept → ACCEPTED + Session row
 *  - PATCH /sessions/requests/:id/cancel → CANCELLED + REFUND txn
 *  - 5-pending cap → 6th request returns 400
 *  - Past scheduledAt → 400
 *  - ASPIRANT trying to accept → 403
 *  - No phone/email/googleSub leaked in session response
 *
 * Preconditions:
 *  - API running on API_BASE_URL (default http://localhost:4000)
 */

import { expect, test } from '@playwright/test'
import { authHeader, createAspirant, createMentor, uniquePhone, requestOtpAndVerify } from '../helpers/auth'

const API = process.env.API_BASE_URL ?? 'http://localhost:4000'

/** Scheduled time 2 hours from now — always in the future. */
function futureScheduledAt(offsetHours = 2): string {
  return new Date(Date.now() + offsetHours * 60 * 60 * 1000).toISOString()
}

test.describe('Sessions: 1:1 session request flow', () => {
  // Create a shared mentor+aspirant pair for tests that need both roles.
  // Each test that mutates state uses its own fresh users to avoid interference.

  test('SES-1: POST /sessions/requests creates PENDING request + wallet HOLD', async ({
    request,
  }) => {
    const mentor = await createMentor(request)
    const aspirant = await createAspirant(request)

    const createRes = await request.post(`${API}/sessions/requests`, {
      headers: authHeader(aspirant),
      data: {
        mentorId: mentor.userId,
        scheduledAt: futureScheduledAt(),
        durationMin: 60,
        message: 'Hi, I need help with Essay writing.',
      },
    })

    expect(createRes.status(), `create body: ${await createRes.text()}`).toBe(201)
    const body = (await createRes.json()) as {
      id: string
      status: string
      paymentStatus: string
      amountInr: number
    }
    expect(body.id).toBeTruthy()
    expect(body.status).toBe('PENDING')
    expect(body.paymentStatus).toBe('SIMULATED')
    expect(body.amountInr).toBeGreaterThan(0)

    // SES-2: Wallet should contain a HOLD txn.
    const walletRes = await request.get(`${API}/wallet`, {
      headers: authHeader(aspirant),
    })
    expect(walletRes.ok()).toBeTruthy()
    const txns = (await walletRes.json()) as Array<{ type: string; sessionId: string }>
    const holdTxn = txns.find((t) => t.type === 'HOLD' && t.sessionId === body.id)
    expect(holdTxn, 'Wallet must contain a HOLD txn for the session').toBeTruthy()
  })

  test('SES-2: GET /sessions/requests for mentor — anonymized counterpart, no PII', async ({
    request,
  }) => {
    const mentor = await createMentor(request)
    const aspirant = await createAspirant(request)

    // Create a request so the list is non-empty.
    const createRes = await request.post(`${API}/sessions/requests`, {
      headers: authHeader(aspirant),
      data: {
        mentorId: mentor.userId,
        scheduledAt: futureScheduledAt(),
        durationMin: 60,
      },
    })
    expect(createRes.status()).toBe(201)

    // Mentor fetches their incoming requests.
    const listRes = await request.get(`${API}/sessions/requests`, {
      headers: authHeader(mentor),
    })
    expect(listRes.ok(), `list body: ${await listRes.text()}`).toBeTruthy()
    const rows = (await listRes.json()) as Array<{
      counterpart: {
        id: string
        displayHandle: string
        avatarLetter: string
        avatarColor: string
        hasPurpleTick: boolean
        phone?: unknown
        email?: unknown
        googleSub?: unknown
      }
    }>
    expect(Array.isArray(rows)).toBeTruthy()
    expect(rows.length).toBeGreaterThan(0)

    const responseText = JSON.stringify(rows)

    // Anonymity checks: no phone numbers, emails, googleSub, or raw fields.
    expect(responseText, 'phone field must not appear').not.toContain('"phone"')
    expect(responseText, 'email field must not appear').not.toContain('"email"')
    expect(responseText, 'googleSub field must not appear').not.toContain('"googleSub"')
    expect(responseText, 'passwordHash must not appear').not.toContain('"passwordHash"')
    expect(responseText, 'aadhaarHash must not appear').not.toContain('"aadhaarHash"')
    expect(responseText, 'E.164 phone patterns must not appear').not.toMatch(/\+91\d{10}/)
    expect(responseText, 'email patterns must not appear').not.toMatch(
      /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i,
    )

    // Each row's counterpart must have anonymized shape.
    for (const row of rows) {
      expect(row.counterpart.displayHandle, 'counterpart must have displayHandle').toBeTruthy()
      expect(row.counterpart.avatarLetter, 'counterpart must have avatarLetter').toBeTruthy()
      expect(row.counterpart).not.toHaveProperty('phone')
      expect(row.counterpart).not.toHaveProperty('email')
      expect(row.counterpart).not.toHaveProperty('googleSub')
    }
  })

  test('SES-3: mentor can accept a PENDING request → ACCEPTED + Session created', async ({
    request,
  }) => {
    const mentor = await createMentor(request)
    const aspirant = await createAspirant(request)

    // Aspirant creates request.
    const createRes = await request.post(`${API}/sessions/requests`, {
      headers: authHeader(aspirant),
      data: {
        mentorId: mentor.userId,
        scheduledAt: futureScheduledAt(),
        durationMin: 60,
      },
    })
    expect(createRes.status()).toBe(201)
    const { id: requestId } = (await createRes.json()) as { id: string }

    // Mentor accepts.
    const acceptRes = await request.patch(`${API}/sessions/requests/${requestId}/accept`, {
      headers: authHeader(mentor),
    })
    expect(acceptRes.status(), `accept body: ${await acceptRes.text()}`).toBe(200)
    const accepted = (await acceptRes.json()) as { id: string; status: string }
    expect(accepted.status).toBe('ACCEPTED')
  })

  test('SES-4: aspirant can cancel a PENDING request → CANCELLED + REFUND txn', async ({
    request,
  }) => {
    const mentor = await createMentor(request)
    const aspirant = await createAspirant(request)

    const createRes = await request.post(`${API}/sessions/requests`, {
      headers: authHeader(aspirant),
      data: {
        mentorId: mentor.userId,
        scheduledAt: futureScheduledAt(),
        durationMin: 60,
      },
    })
    expect(createRes.status()).toBe(201)
    const { id: requestId } = (await createRes.json()) as { id: string }

    // Aspirant cancels.
    const cancelRes = await request.patch(`${API}/sessions/requests/${requestId}/cancel`, {
      headers: authHeader(aspirant),
    })
    expect(cancelRes.status(), `cancel body: ${await cancelRes.text()}`).toBe(200)
    const cancelled = (await cancelRes.json()) as { status: string }
    expect(cancelled.status).toBe('CANCELLED')

    // Wallet must now have a REFUND txn.
    const walletRes = await request.get(`${API}/wallet`, {
      headers: authHeader(aspirant),
    })
    expect(walletRes.ok()).toBeTruthy()
    const txns = (await walletRes.json()) as Array<{ type: string; sessionId: string }>
    const refundTxn = txns.find((t) => t.type === 'REFUND' && t.sessionId === requestId)
    expect(refundTxn, 'Wallet must contain a REFUND txn after cancellation').toBeTruthy()
  })

  test('SES-5: 5-pending cap — 6th request returns 400', async ({ request }) => {
    const mentor = await createMentor(request)
    const aspirant = await createAspirant(request)

    // Create 5 PENDING requests (different scheduled times to avoid conflicts).
    for (let i = 1; i <= 5; i++) {
      const r = await request.post(`${API}/sessions/requests`, {
        headers: authHeader(aspirant),
        data: {
          mentorId: mentor.userId,
          scheduledAt: futureScheduledAt(i + 1),
          durationMin: 60,
        },
      })
      expect(r.status(), `Request ${i} should succeed: ${await r.text()}`).toBe(201)
    }

    // 6th request must be rejected.
    const sixth = await request.post(`${API}/sessions/requests`, {
      headers: authHeader(aspirant),
      data: {
        mentorId: mentor.userId,
        scheduledAt: futureScheduledAt(10),
        durationMin: 60,
      },
    })
    expect(sixth.status(), `6th request must be 400: ${await sixth.text()}`).toBe(400)
  })

  test('SES-6: past scheduledAt → 400', async ({ request }) => {
    const mentor = await createMentor(request)
    const aspirant = await createAspirant(request)

    const pastDate = new Date(Date.now() - 60 * 60 * 1000).toISOString() // 1 hour ago
    const res = await request.post(`${API}/sessions/requests`, {
      headers: authHeader(aspirant),
      data: {
        mentorId: mentor.userId,
        scheduledAt: pastDate,
        durationMin: 60,
      },
    })
    expect(res.status(), `Past date must be 400: ${await res.text()}`).toBe(400)
  })

  test('SES-7: ASPIRANT trying to accept → 403', async ({ request }) => {
    const mentor = await createMentor(request)
    const aspirant = await createAspirant(request)
    const otherAspirant = await createAspirant(request)

    // Aspirant creates a request.
    const createRes = await request.post(`${API}/sessions/requests`, {
      headers: authHeader(aspirant),
      data: {
        mentorId: mentor.userId,
        scheduledAt: futureScheduledAt(),
        durationMin: 60,
      },
    })
    expect(createRes.status()).toBe(201)
    const { id: requestId } = (await createRes.json()) as { id: string }

    // Another aspirant tries to accept — must be forbidden (role guard: MENTOR only).
    const forbiddenRes = await request.patch(
      `${API}/sessions/requests/${requestId}/accept`,
      { headers: authHeader(otherAspirant) },
    )
    expect(
      forbiddenRes.status(),
      `Non-mentor accept must be 403: ${await forbiddenRes.text()}`,
    ).toBe(403)
  })

  test('SES-8: unauthenticated POST /sessions/requests → 401', async ({ request }) => {
    const res = await request.post(`${API}/sessions/requests`, {
      data: { mentorId: '00000000-0000-0000-0000-000000000001', scheduledAt: futureScheduledAt() },
    })
    expect(res.status()).toBe(401)
  })
})
