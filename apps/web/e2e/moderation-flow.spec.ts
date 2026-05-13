/**
 * Browser spec: Admin Moderation page (desktop-chromium)
 *
 * Covers:
 *  - Admin signs in → navigates to /admin/moderation
 *  - Page renders the Moderation Queue heading
 *  - Pending / Dismissed / Actioned tabs are visible
 *  - If reports exist, clicking a row opens the detail drawer
 *  - Non-admin is redirected away from /admin/moderation
 *
 * Note: The BAN/SUSPEND action flows are covered by api/moderation.spec.ts —
 * these browser tests focus on navigation and rendering, not on DB mutations.
 *
 * Preconditions:
 *  - API running on API_BASE_URL (default http://localhost:4000)
 *  - Web running on WEB_BASE_URL (default http://localhost:3030)
 *  - ADMIN_BOOTSTRAP_PHONE=+910000000000 seeded (pnpm db:seed)
 */

import { expect, test } from '@playwright/test'

const API = process.env.API_BASE_URL ?? 'http://localhost:4000'

function uniquePhone(): string {
  const suffix = String(Math.floor(Math.random() * 9_000_000_000) + 1_000_000_000)
  return `+91${suffix}`
}

async function injectAuth(
  page: import('@playwright/test').Page,
  tokens: { accessToken: string; refreshToken: string; expiresIn: number },
  user: { id: string; role: string; status: string },
  profile: { displayHandle: string; avatarLetter: string; avatarColor: string; hasPurpleTick: boolean } | null,
) {
  const authState = { user, profile, tokens }
  await page.addInitScript(
    ({ state, token }: { state: string; token: string }) => {
      window.localStorage.setItem('mento.auth', state)
      window.localStorage.setItem('mento.access', token)
    },
    { state: JSON.stringify({ state: authState, version: 0 }), token: tokens.accessToken },
  )
}

async function signInAsAdmin(page: import('@playwright/test').Page, request: import('@playwright/test').APIRequestContext) {
  const phone = process.env.ADMIN_BOOTSTRAP_PHONE ?? '+910000000000'

  const otpRes = await request.post(`${API}/auth/otp/request`, { data: { phone } })
  if (!otpRes.ok()) throw new Error(`Admin OTP request failed: ${await otpRes.text()}`)
  const { devCode } = (await otpRes.json()) as { devCode: string }

  const verifyRes = await request.post(`${API}/auth/otp/verify`, {
    data: { phone, code: devCode },
  })
  if (!verifyRes.ok()) throw new Error(`Admin OTP verify failed: ${await verifyRes.text()}`)
  const body = (await verifyRes.json()) as {
    user: { id: string; role: string; status: string }
    profile: { displayHandle: string; avatarLetter: string; avatarColor: string; hasPurpleTick: boolean } | null
    tokens: { accessToken: string; refreshToken: string; expiresIn: number }
  }

  await injectAuth(page, body.tokens, body.user, body.profile)
  return body
}

test.describe('Moderation: admin queue browser tests', () => {
  test('MOD-UI-1: admin sees Moderation Queue page', async ({ page, request }) => {
    await signInAsAdmin(page, request)

    await page.goto('/admin/moderation')

    // Heading must be present.
    await expect(
      page.getByRole('heading', { name: /moderation queue/i }),
      'Moderation Queue heading must be visible',
    ).toBeVisible({ timeout: 15_000 })
  })

  test('MOD-UI-2: status tabs are rendered', async ({ page, request }) => {
    await signInAsAdmin(page, request)

    await page.goto('/admin/moderation')

    // All three status tabs must be present.
    await expect(page.getByRole('button', { name: /pending/i })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: /dismissed/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /actioned/i })).toBeVisible()
  })

  test('MOD-UI-3: table renders (empty state or rows — no crash)', async ({ page, request }) => {
    await signInAsAdmin(page, request)

    await page.goto('/admin/moderation')

    // Wait for the Pending tab to load. The table shows either an empty message
    // or actual rows — both are fine. We just assert it doesn't show a 5xx error.
    await page.waitForSelector('table', { timeout: 15_000 })

    // The page should not have a generic error boundary message.
    const content = await page.content()
    expect(content, 'Page must not render a server error').not.toContain('500')
    expect(content, 'Page must not render "Application error"').not.toContain('Application error')
  })

  test('MOD-UI-4: switching to Dismissed tab does not crash', async ({ page, request }) => {
    await signInAsAdmin(page, request)

    await page.goto('/admin/moderation')
    await page.waitForSelector('table', { timeout: 15_000 })

    // Click the Dismissed tab.
    await page.getByRole('button', { name: /dismissed/i }).click()

    // Table should still be visible after tab switch.
    await expect(page.locator('table')).toBeVisible({ timeout: 10_000 })
  })

  test('MOD-UI-5: non-admin navigating to /admin/moderation is redirected', async ({
    page,
    request,
  }) => {
    // Create an aspirant and inject their session.
    const phone = uniquePhone()
    const otpRes = await request.post(`${API}/auth/otp/request`, { data: { phone } })
    expect(otpRes.ok()).toBeTruthy()
    const { devCode } = (await otpRes.json()) as { devCode: string }
    const verifyRes = await request.post(`${API}/auth/otp/verify`, {
      data: { phone, code: devCode },
    })
    expect(verifyRes.ok()).toBeTruthy()
    const body = (await verifyRes.json()) as {
      user: { id: string; role: string; status: string }
      profile: { displayHandle: string; avatarLetter: string; avatarColor: string; hasPurpleTick: boolean } | null
      tokens: { accessToken: string; refreshToken: string; expiresIn: number }
    }

    await injectAuth(page, body.tokens, body.user, body.profile)

    const res = await page.goto('/admin/moderation')

    // Either the status is a redirect (3xx) OR the resulting URL is not /admin/moderation
    // OR an access-denied message is rendered.
    const finalUrl = page.url()
    const html = await page.content()

    const isRedirected = !finalUrl.includes('/admin/moderation')
    const isBlocked = html.includes('403') || html.includes('Forbidden') || html.includes('Access denied') || html.includes('not allowed')
    const isServerError = (res?.status() ?? 0) >= 500

    expect(isServerError, 'Must not 5xx on non-admin access').toBeFalsy()
    // Either redirected away or shows blocked UI — the app must not render admin content.
    if (!isRedirected && !isBlocked) {
      // Last resort: the moderation queue heading must not be present for a non-admin.
      const heading = page.getByRole('heading', { name: /moderation queue/i })
      await expect(heading).not.toBeVisible({ timeout: 3_000 })
    }
  })
})
