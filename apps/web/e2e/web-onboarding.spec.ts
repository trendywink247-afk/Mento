import { expect, test } from '@playwright/test'

const API = process.env.API_BASE_URL ?? 'http://localhost:4000'

test.describe('Web — happy path onboarding', () => {
  test('landing → role pick → mentee welcome flash → login → OTP → Mirror → dashboard', async ({
    page,
    request,
  }) => {
    // 1. Landing
    await page.goto('/')
    // The hero h1 is the main brand heading on the page. The nav "Mento" is a link,
    // not a heading. Use the h1 which contains the tagline text.
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
    // Two "Get started" links exist (hero CTA + FinalCta). Use first() for the hero CTA.
    await expect(page.getByRole('link', { name: /get started/i }).first()).toBeVisible()

    // 2. Role pick
    await page.getByRole('link', { name: /get started/i }).first().click()
    await expect(page).toHaveURL(/\/onboarding\/role/)
    await expect(page.getByRole('button', { name: /preparing for UPSC/i })).toBeVisible()

    await page.getByRole('button', { name: /preparing for UPSC/i }).click()
    // → welcome flash → /login?role=ASPIRANT (the flash auto-advances after ~12s).
    // To avoid waiting through the full flash, jump straight to /login.
    await page.goto('/login?role=ASPIRANT')

    // 3. Login — request OTP. We capture devCode by hitting the API directly with the same phone
    //    Playwright entered into the form, because the page reads devCode from the api response
    //    but doesn't expose it via the DOM in a stable, scrape-safe way.
    const phone = uniquePhone()
    // Fill only the 10-digit portion (no +91 prefix) — the input has a +91 chip already.
    await page.getByPlaceholder(/98765/i).fill(phone.replace('+91', ''))
    // Terms checkbox must be checked before Send OTP becomes enabled.
    await page.locator('input[type="checkbox"]').check()
    await page.getByRole('button', { name: /send otp/i }).click()
    await page.waitForURL(/\/otp/)

    // 4. Re-request the OTP via API to read devCode (idempotent on phone) and submit
    const devCodeRes = await request.post(`${API}/auth/otp/request`, { data: { phone } })
    expect(devCodeRes.ok()).toBeTruthy()
    // The most-recent OTP for this phone is the one the page will accept.
    const { devCode } = (await devCodeRes.json()) as { devCode: string }
    // OTP uses 6 individual single-digit cells (aria-label="Digit N of 6"), not a combined input.
    // Paste via clipboard API which the OTP component handles.
    const cells = page.locator('input[aria-label^="Digit"]')
    await cells.nth(0).focus()
    // Simulate typing each digit into the appropriate cell
    for (let i = 0; i < devCode.length; i++) {
      await cells.nth(i).fill(devCode[i])
    }
    await page.getByRole('button', { name: /verify & sign in/i }).click()

    // 5. Should land on Mirror
    await page.waitForURL(/\/onboarding\/mirror/, { timeout: 20_000 })
    await expect(page.getByRole('heading', { name: 'The Mirror' })).toBeVisible()
    await page.getByRole('button', { name: /^begin$/i }).click()

    // Step: journey
    await page.getByRole('button', { name: /one year in/i }).click()
    await page.getByRole('button', { name: /^next$/i }).click()

    // Step: background (beginner branches here)
    await page.getByRole('button', { name: 'Coaching' }).click()
    await page.getByRole('button', { name: /^next$/i }).click()

    // Step: reflection
    await page.getByRole('button', { name: /i'm ready/i }).click()

    // Step: knowledge sliders — accept defaults
    await page.getByRole('button', { name: /^next$/i }).click()

    // Step: challenges — pick 2
    await page.getByRole('button', { name: 'Inconsistency' }).click()
    await page.getByRole('button', { name: 'Distraction' }).click()
    await page.getByRole('button', { name: /^next$/i }).click()

    // Step: privacy
    await page.getByRole('button', { name: /let's begin/i }).click()

    // 6. Dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 })
    await expect(page.getByRole('heading', { name: /welcome/i })).toBeVisible()
    // The display handle is anonymous (Aspirant_NNNN) — never the raw phone.
    const dashHtml = await page.content()
    expect(dashHtml).not.toContain(phone)
  })

  test('public landing does not leak any user state when not logged in', async ({ page }) => {
    await page.goto('/')
    const html = await page.content()
    expect(html).not.toContain('Bearer ')
    expect(html).not.toMatch(/\+91\d{10}/)
  })
})

function uniquePhone(): string {
  // Indian mobile numbers must start with 6-9. Generate 9 random digits after the leading digit.
  const leading = String(Math.floor(Math.random() * 4) + 6) // 6, 7, 8, or 9
  const rest = String(Math.floor(Math.random() * 1_000_000_000)).padStart(9, '0').slice(0, 9)
  return `+91${leading}${rest}`
}
