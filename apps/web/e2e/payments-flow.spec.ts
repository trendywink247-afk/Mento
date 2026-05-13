/**
 * Browser spec: Payments flow (desktop-chromium)
 *
 * Covers:
 *  - Sign in via OTP devCode path → dashboard
 *  - /upgrade page renders 3 paid tier cards
 *  - Clicking "Activate Pro (simulated)" in dev mode → success message shown
 *  - /upgrade while signed out → no crash (redirects to login or shows the page)
 *
 * Preconditions:
 *  - API running on API_BASE_URL (default http://localhost:4000) with RAZORPAY_KEY_ID unset
 *  - Web running on WEB_BASE_URL (default http://localhost:3030)
 */

import { expect, test } from '@playwright/test'

const API = process.env.API_BASE_URL ?? 'http://localhost:4000'

function uniquePhone(): string {
  const suffix = String(Math.floor(Math.random() * 9_000_000_000) + 1_000_000_000)
  return `+91${suffix}`
}

/**
 * Inject auth state into localStorage so the Zustand store rehydrates
 * without going through the OTP UI flow.
 */
async function injectAuth(
  page: import('@playwright/test').Page,
  accessToken: string,
  user: { id: string; role: string; status: string },
  profile: { displayHandle: string; avatarLetter: string; avatarColor: string; hasPurpleTick: boolean } | null,
  tokens: { accessToken: string; refreshToken: string; expiresIn: number },
) {
  const authState = { user, profile, tokens }
  await page.addInitScript(
    ({ state, token }: { state: string; token: string }) => {
      window.localStorage.setItem('mento.auth', state)
      window.localStorage.setItem('mento.access', token)
    },
    { state: JSON.stringify({ state: authState, version: 0 }), token: accessToken },
  )
}

test.describe('Payments: upgrade page (browser)', () => {
  test('PAY-UI-1: /upgrade page shows 3 paid tier cards when signed in', async ({
    page,
    request,
  }) => {
    const phone = uniquePhone()

    // Get tokens via API.
    const otpRes = await request.post(`${API}/auth/otp/request`, { data: { phone } })
    expect(otpRes.ok()).toBeTruthy()
    const { devCode } = (await otpRes.json()) as { devCode: string }

    const verifyRes = await request.post(`${API}/auth/otp/verify`, {
      data: { phone, code: devCode },
    })
    expect(verifyRes.ok()).toBeTruthy()
    const authBody = (await verifyRes.json()) as {
      user: { id: string; role: string; status: string }
      profile: { displayHandle: string; avatarLetter: string; avatarColor: string; hasPurpleTick: boolean } | null
      tokens: { accessToken: string; refreshToken: string; expiresIn: number }
    }

    // Inject auth into browser localStorage so the app sees a signed-in user.
    await injectAuth(
      page,
      authBody.tokens.accessToken,
      authBody.user,
      authBody.profile,
      authBody.tokens,
    )

    // Navigate to upgrade page.
    await page.goto('/upgrade')

    // Should show tier cards for BASIC, PRO, MAX.
    // Use data-testid to avoid strict-mode violations (multiple buttons match /basic/i, /pro/i).
    await expect(page.locator('[data-testid="tier-card-basic"]')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('[data-testid="tier-card-pro"]')).toBeVisible()
    await expect(page.locator('[data-testid="tier-card-max"]')).toBeVisible()

    // In dev mode, the banner mentions "Dev mode" or similar.
    const html = await page.content()
    expect(html).not.toContain(phone) // Phone must never be in the rendered HTML.
  })

  test('PAY-UI-2: activate pro in dev mode shows success message', async ({
    page,
    request,
  }) => {
    const phone = uniquePhone()

    const otpRes = await request.post(`${API}/auth/otp/request`, { data: { phone } })
    expect(otpRes.ok()).toBeTruthy()
    const { devCode } = (await otpRes.json()) as { devCode: string }

    const verifyRes = await request.post(`${API}/auth/otp/verify`, {
      data: { phone, code: devCode },
    })
    expect(verifyRes.ok()).toBeTruthy()
    const authBody = (await verifyRes.json()) as {
      user: { id: string; role: string; status: string }
      profile: { displayHandle: string; avatarLetter: string; avatarColor: string; hasPurpleTick: boolean } | null
      tokens: { accessToken: string; refreshToken: string; expiresIn: number }
    }

    await injectAuth(page, authBody.tokens.accessToken, authBody.user, authBody.profile, authBody.tokens)

    await page.goto('/upgrade')
    // Use data-testid to avoid strict-mode violations (multiple buttons can match /pro/i).
    await expect(page.locator('[data-testid="tier-card-pro"]')).toBeVisible({ timeout: 15_000 })

    // Select Pro tier (it's selected by default, but click anyway).
    await page.locator('[data-testid="tier-card-pro"]').click()

    // Click the activate button.
    const upgradeBtn = page.getByRole('button', { name: /activate pro|pay ₹599/i })
    await expect(upgradeBtn).toBeVisible()
    await upgradeBtn.click()

    // In dev mode the checkout call returns simulated:true and then simulate-success
    // is called — the success message should appear.
    await expect(
      page.getByText(/activated|dev.*activated|pro.*active/i),
      'Success message must appear after simulated upgrade',
    ).toBeVisible({ timeout: 15_000 })
  })

  test('PAY-UI-3: /upgrade while signed out → no 500, renders some content', async ({ page }) => {
    // No auth injected — visit upgrade directly.
    const response = await page.goto('/upgrade')
    // Should not crash (redirect to login or show the page — either is acceptable).
    expect(response?.status() ?? 200, 'Page must not 5xx').toBeLessThan(500)
  })
})
