/*
 * UI tour — drives every page in the app and captures full-viewport screenshots.
 * Output goes to apps/web/e2e/ui-screenshots/<slug>.png
 *
 * Uses the real OTP flow (dev mode echoes devCode in the API response) so the
 * authenticated routes don't have hydration-timing issues with a seeded store.
 */
import { test, type APIRequestContext, type Page } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'

const OUT_DIR = path.join(__dirname, 'ui-screenshots')
const API = process.env.API_BASE_URL ?? 'http://localhost:4000'

function uniquePhone(): string {
  const suffix = String(Math.floor(Math.random() * 1_000_000_000)).padStart(10, '0')
  return `+91${suffix.slice(0, 10)}`
}

test.beforeAll(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true })
})

async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), fullPage: true })
}

async function loginViaUi(page: Page, request: APIRequestContext, role: 'ASPIRANT' | 'MENTOR' = 'ASPIRANT') {
  const phone = uniquePhone()
  // The first call goes through the page so localStorage gets populated correctly.
  await page.goto(`/login?role=${role}`)
  await page.getByPlaceholder(/91987/i).fill(phone)
  await page.getByRole('button', { name: /send otp/i }).click()
  await page.waitForURL(/\/otp/)

  // Pull the dev code via API (same phone — most recent OTP wins).
  const otpRes = await request.post(`${API}/auth/otp/request`, { data: { phone } })
  const { devCode } = (await otpRes.json()) as { devCode: string }

  await page.getByPlaceholder('123456').fill(devCode)
  await page.getByRole('button', { name: /verify & sign in/i }).click()
  return { phone }
}

test.describe.configure({ mode: 'serial' })

test.describe('UI tour @desktop', () => {
  test('public surfaces', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await shot(page, '01-landing')

    await page.getByRole('link', { name: /get started/i }).click()
    await page.waitForURL(/\/onboarding\/role/)
    await shot(page, '02-role-pick')

    await page.getByRole('button', { name: /preparing for UPSC/i }).click()
    await page.waitForURL(/\/onboarding\/welcome/)
    await page.waitForTimeout(500)
    await shot(page, '03-welcome-flash-1')
    await page.waitForTimeout(1500)
    await shot(page, '03-welcome-flash-2')

    await page.goto('/login?role=ASPIRANT')
    await page.waitForLoadState('networkidle')
    await shot(page, '04-login-empty')

    await page.getByPlaceholder(/91987/i).fill('+91')
    await page.getByRole('button', { name: /send otp/i }).click()
    await page.waitForTimeout(500)
    await shot(page, '05-login-error-bad-phone')

    // OTP screen (just empty)
    await page.goto('/otp?phone=%2B919999988888')
    await page.waitForLoadState('networkidle')
    await shot(page, '05b-otp-empty')
  })

  test('aspirant onboarding — Mirror, every step', async ({ page, request }) => {
    await loginViaUi(page, request, 'ASPIRANT')
    // After OTP verify, the app redirects to /onboarding/mirror (state.nextStep)
    await page.waitForURL(/\/onboarding\/mirror/, { timeout: 20_000 })
    await page.waitForLoadState('networkidle')
    await shot(page, '06-mirror-intro')

    await page.getByRole('button', { name: /^begin$/i }).click()
    await page.waitForTimeout(300)
    await shot(page, '07-mirror-journey')

    await page.getByRole('button', { name: /one year in/i }).click()
    await page.waitForTimeout(150)
    await shot(page, '07b-mirror-journey-selected')

    await page.getByRole('button', { name: /^next$/i }).click()
    await page.waitForTimeout(300)
    await shot(page, '08-mirror-background')

    await page.getByRole('button', { name: 'Coaching' }).click()
    await page.getByRole('button', { name: /^next$/i }).click()
    await page.waitForTimeout(300)
    await shot(page, '09-mirror-reflection')

    await page.getByRole('button', { name: /i'm ready/i }).click()
    await page.waitForTimeout(300)
    await shot(page, '10-mirror-knowledge')

    await page.getByRole('button', { name: /^next$/i }).click()
    await page.waitForTimeout(300)
    await shot(page, '11-mirror-challenges')

    await page.getByRole('button', { name: 'Inconsistency' }).click()
    await page.getByRole('button', { name: 'Fear of failure' }).click()
    await page.getByRole('button', { name: 'Burnout' }).click()
    await page.waitForTimeout(150)
    await shot(page, '11b-mirror-challenges-selected')

    await page.getByRole('button', { name: /^next$/i }).click()
    await page.waitForTimeout(300)
    await shot(page, '12-mirror-privacy')

    await page.getByRole('button', { name: /let's begin/i }).click()
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 })
    await page.waitForLoadState('networkidle')
    await shot(page, '13-dashboard')
  })

  test('authenticated app surfaces', async ({ page, request }) => {
    await loginViaUi(page, request, 'ASPIRANT')
    await page.waitForURL(/\/onboarding\/mirror/, { timeout: 20_000 })

    // Skip Mirror via api to land on dashboard
    const access = await page.evaluate(() => window.localStorage.getItem('mento.access'))
    await request.post(`${API}/onboarding/mirror`, {
      headers: { Authorization: `Bearer ${access ?? ''}` },
      data: {
        journeyStage: 'ONE_YEAR_IN',
        background: 'coaching',
        knowledge: {},
        challenges: ['Distraction'],
      },
    })

    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    await shot(page, '20-dashboard-loaded')

    await page.goto('/journals')
    await page.waitForLoadState('networkidle')
    await shot(page, '21-journals-categories')

    // Open Personal journal
    await page.getByRole('button', { name: /personal journal/i }).first().click()
    await page.waitForURL(/\/journals\//)
    await page.waitForLoadState('networkidle')
    await shot(page, '22-journal-empty-detail')

    await page.getByPlaceholder(/write a reflection/i).fill(
      'First reflection: today I committed to the journey. Mixed feelings — anxious, hopeful.',
    )
    await page.getByRole('button', { name: /add entry/i }).click()
    await page.waitForTimeout(1200)
    await shot(page, '23-journal-with-entry')

    await page.goto('/chat')
    await page.waitForLoadState('networkidle')
    await shot(page, '24-chat-empty')

    await page.goto('/mentors')
    await page.waitForLoadState('networkidle')
    await shot(page, '25-mentors-empty')
  })

  test('mentor onboarding screens', async ({ page, request }) => {
    await loginViaUi(page, request, 'MENTOR')
    await page.waitForURL(/\/onboarding\/mentor/, { timeout: 20_000 })
    await page.waitForLoadState('networkidle')
    await shot(page, '31-mentor-journey')

    // Mentor welcome (philosophy) — visited via direct URL since flow skips it post-OTP
    await page.goto('/onboarding/mentor-welcome')
    await page.waitForLoadState('networkidle')
    await shot(page, '30-mentor-welcome')

    await page.goto('/onboarding/mentor')
    await page.getByRole('button', { name: /mains written once/i }).click()
    await page.getByRole('button', { name: /^next$/i }).click()
    await page.waitForTimeout(300)
    await shot(page, '32-mentor-history')

    // Tick prelims + mains for the seeded year
    const checks = page.getByRole('checkbox')
    await checks.nth(0).check()
    await checks.nth(1).check()
    await page.waitForTimeout(150)
    await shot(page, '32b-mentor-history-filled')

    await page.getByRole('button', { name: /^next$/i }).click()
    await page.waitForTimeout(300)
    await shot(page, '33-mentor-subjects')

    await page.getByRole('button', { name: 'Mains' }).click()
    await page.getByRole('button', { name: 'Essay' }).click()
    await page.waitForTimeout(150)
    await shot(page, '33b-mentor-subjects-selected')

    await page.getByRole('button', { name: /^next$/i }).click()
    await page.waitForTimeout(300)
    await shot(page, '34-mentor-reach')

    await page.getByRole('button', { name: /submit for verification/i }).click()
    await page.waitForURL(/\/onboarding\/submitted/, { timeout: 10_000 })
    await page.waitForLoadState('networkidle')
    await shot(page, '35-mentor-submitted')
  })

  test('public get-app page', async ({ page }) => {
    await page.goto('/get-app')
    await page.waitForLoadState('networkidle')
    await shot(page, '40-get-app')
  })
})

test.describe('UI tour @mobile-pixel', () => {
  test('mobile UA shows get-app screen', async ({ browser }) => {
    const ctx = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      viewport: { width: 393, height: 852 },
    })
    const page = await ctx.newPage()
    await page.goto('http://localhost:3030/')
    await page.waitForLoadState('networkidle')
    await shot(page, '50-mobile-get-app')
    await ctx.close()
  })
})
