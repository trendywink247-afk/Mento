import { expect, test } from '@playwright/test'
import { authHeader, requestAndVerifyOtp, uniquePhone } from './helpers'

const API = process.env.API_BASE_URL ?? 'http://localhost:4000'

test.describe('API: onboarding flows', () => {
  test('mentee Mirror submit advances onboarding state', async ({ request }) => {
    const session = await requestAndVerifyOtp(request, uniquePhone())

    // Before Mirror: nextStep must be mentee.mirror
    let state = await request
      .get(`${API}/onboarding/state`, { headers: authHeader(session) })
      .then((r) => r.json() as Promise<{ nextStep: string | null }>)
    expect(state.nextStep).toBe('mentee.mirror')

    // Submit Mirror
    const submit = await request.post(`${API}/onboarding/mirror`, {
      headers: authHeader(session),
      data: {
        journeyStage: 'ONE_YEAR_IN',
        background: 'coaching',
        knowledge: { Polity: 0.3, History: 0.5 },
        challenges: ['Inconsistency', 'Distraction'],
      },
    })
    expect(submit.ok(), await submit.text()).toBeTruthy()

    // After Mirror: nextStep null (mentee is done)
    state = await request
      .get(`${API}/onboarding/state`, { headers: authHeader(session) })
      .then((r) => r.json() as Promise<{ nextStep: string | null }>)
    expect(state.nextStep).toBeNull()
  })

  test('mentor submit auto-promotes role and routes to waiting verification', async ({
    request,
  }) => {
    const session = await requestAndVerifyOtp(request, uniquePhone())

    const submit = await request.post(`${API}/onboarding/mentor`, {
      headers: authHeader(session),
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
    expect(submit.ok(), await submit.text()).toBeTruthy()

    const state = await request
      .get(`${API}/onboarding/state`, { headers: authHeader(session) })
      .then((r) => r.json() as Promise<{ role: string; nextStep: string | null }>)
    expect(state.role).toBe('MENTOR')
    // Mentor needs verification docs uploaded; absent that → waiting on credentials/verification.
    expect(['mentor.credentials', 'mentor.waiting_verification']).toContain(state.nextStep)
  })

  test('GET /me returns anonymized profile shape only', async ({ request }) => {
    const session = await requestAndVerifyOtp(request, uniquePhone())
    const res = await request.get(`${API}/me`, { headers: authHeader(session) })
    expect(res.ok()).toBeTruthy()
    const body = (await res.json()) as {
      user: { phone: string | null; role: string }
      profile: {
        displayHandle: string
        avatarLetter: string
        avatarColor: string
        hasPurpleTick: boolean
      } | null
    }
    // /me may include phone for the user themselves — that's OK (it's THEIR phone).
    expect(body.profile?.displayHandle).toMatch(/^Aspirant_/)
    expect(body.profile?.avatarLetter).toBe('B')
    expect(body.profile?.avatarColor).toBe('SLATE')
  })
})
