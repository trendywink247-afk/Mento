/*
 * Companion tour — capture the remaining screens (post-Mirror dashboard, journals
 * detail, chat empty, mentors empty, mentor onboarding wizard, get-app, mobile UA).
 * Uses real OTP login and avoids networkidle waits.
 */
import { test, type Page } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'

const OUT_DIR = path.join(__dirname, 'ui-screenshots')
const API = process.env.API_BASE_URL ?? 'http://localhost:4000'

function uniquePhone(): string {
  // Indian mobile numbers must start with 6-9. Generate 9 random digits after the leading digit.
  const leading = String(Math.floor(Math.random() * 4) + 6) // 6, 7, 8, or 9
  const rest = String(Math.floor(Math.random() * 1_000_000_000)).padStart(9, '0').slice(0, 9)
  return `+91${leading}${rest}`
}

async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), fullPage: true })
}

async function loginAsAspirant(page: Page, request: import('@playwright/test').APIRequestContext) {
  const phone = uniquePhone()
  await page.goto('/login?role=ASPIRANT')
  // Fill only the 10-digit portion (no +91 prefix) — the input has a +91 chip already.
  await page.getByPlaceholder(/98765/i).fill(phone.replace('+91', ''))
  // Terms checkbox must be checked before Send OTP becomes enabled.
  await page.locator('input[type="checkbox"]').check()
  await page.getByRole('button', { name: /send otp/i }).click()
  await page.waitForURL(/\/otp/, { timeout: 15_000 })
  const otpRes = await request.post(`${API}/auth/otp/request`, { data: { phone } })
  const { devCode } = (await otpRes.json()) as { devCode: string }
  // OTP uses 6 individual single-digit cells (aria-label="Digit N of 6"), not a combined input.
  const aspirantCells = page.locator('input[aria-label^="Digit"]')
  await aspirantCells.nth(0).focus()
  for (let i = 0; i < devCode.length; i++) {
    await aspirantCells.nth(i).fill(devCode[i])
  }
  await page.getByRole('button', { name: /verify & sign in/i }).click()
  await page.waitForURL(/\/onboarding\/mirror/, { timeout: 15_000 })
  const access = await page.evaluate(() => window.localStorage.getItem('mento.access'))
  // Submit Mirror via API so we land on dashboard.
  await request.post(`${API}/onboarding/mirror`, {
    headers: { Authorization: `Bearer ${access ?? ''}` },
    data: { journeyStage: 'ONE_YEAR_IN', background: 'coaching', knowledge: {}, challenges: ['Distraction'] },
  })
  return { phone, access: access ?? '' }
}

test.beforeAll(() => fs.mkdirSync(OUT_DIR, { recursive: true }))

test.describe.configure({ mode: 'serial' })

test.describe('UI tour extras @desktop', () => {
  test('dashboard + journals + chat + mentors empty states', async ({ page, request }) => {
    await loginAsAspirant(page, request)

    await page.goto('/dashboard')
    await page.waitForTimeout(800)
    await shot(page, '20-dashboard-loaded')

    await page.goto('/journals')
    await page.waitForTimeout(800)
    await shot(page, '21-journals-categories')

    // Click Personal journal — uses window.location.href in current code
    await page.getByRole('button', { name: /personal journal/i }).first().click()
    await page.waitForTimeout(1500)
    await shot(page, '22-journal-detail-empty')

    const textarea = page.getByPlaceholder(/write a reflection/i)
    if (await textarea.count()) {
      await textarea.fill('First reflection. Day one of preparation. Anxious but hopeful.')
      await page.getByRole('button', { name: /add entry/i }).click()
      await page.waitForTimeout(1500)
      await shot(page, '23-journal-with-entry')
    }

    await page.goto('/chat')
    await page.waitForTimeout(800)
    await shot(page, '24-chat-empty')

    await page.goto('/mentors')
    await page.waitForTimeout(800)
    await shot(page, '25-mentors-empty')
  })

  test('mentor onboarding wizard', async ({ page, request }) => {
    const phone = uniquePhone()
    await page.goto('/login?role=MENTOR')
    // Fill only the 10-digit portion (no +91 prefix) — the input has a +91 chip already.
    await page.getByPlaceholder(/98765/i).fill(phone.replace('+91', ''))
    // Terms checkbox must be checked before Send OTP becomes enabled.
    await page.locator('input[type="checkbox"]').check()
    await page.getByRole('button', { name: /send otp/i }).click()
    await page.waitForURL(/\/otp/)
    const otpRes = await request.post(`${API}/auth/otp/request`, { data: { phone } })
    const { devCode } = (await otpRes.json()) as { devCode: string }
    // OTP uses 6 individual single-digit cells (aria-label="Digit N of 6"), not a combined input.
    const mentorCells = page.locator('input[aria-label^="Digit"]')
    await mentorCells.nth(0).focus()
    for (let i = 0; i < devCode.length; i++) {
      await mentorCells.nth(i).fill(devCode[i])
    }
    await page.getByRole('button', { name: /verify & sign in/i }).click()
    await page.waitForURL(/\/onboarding\/mentor/, { timeout: 15_000 })
    await page.waitForTimeout(800)
    await shot(page, '31-mentor-journey')

    await page.goto('/onboarding/mentor-welcome')
    await page.waitForTimeout(800)
    await shot(page, '30-mentor-welcome')

    await page.goto('/onboarding/mentor')
    await page.waitForTimeout(600)
    await page.getByRole('button', { name: /mains written once/i }).click()
    await page.getByRole('button', { name: /^next$/i }).click()
    await page.waitForTimeout(400)
    await shot(page, '32-mentor-history')

    const checks = page.getByRole('checkbox')
    await checks.nth(0).check()
    await checks.nth(1).check()
    await page.waitForTimeout(200)
    await shot(page, '32b-mentor-history-filled')
    await page.getByRole('button', { name: /^next$/i }).click()
    await page.waitForTimeout(400)
    await shot(page, '33-mentor-subjects')

    await page.getByRole('button', { name: 'Mains' }).click()
    await page.getByRole('button', { name: 'Essay' }).click()
    await shot(page, '33b-mentor-subjects-selected')

    await page.getByRole('button', { name: /^next$/i }).click()
    await page.waitForTimeout(400)
    await shot(page, '34-mentor-reach')

    await page.getByRole('button', { name: /submit for verification/i }).click()
    // After mentor journey form, the flow routes to /onboarding/credentials for file upload,
    // then to /onboarding/submitted after credentials are provided.
    await page.waitForURL(/\/onboarding\/(credentials|submitted)/, { timeout: 10_000 })
    await page.waitForTimeout(800)
    await shot(page, '35-mentor-submitted')
  })

  test('public get-app + mobile UA hard redirect', async ({ page, browser }) => {
    await page.goto('/get-app')
    await page.waitForTimeout(600)
    await shot(page, '40-get-app-desktop')

    const mobile = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      viewport: { width: 393, height: 852 },
    })
    const mp = await mobile.newPage()
    await mp.goto('http://localhost:3030/')
    await mp.waitForTimeout(800)
    await shot(mp, '50-mobile-get-app')
    await mobile.close()
  })
})
