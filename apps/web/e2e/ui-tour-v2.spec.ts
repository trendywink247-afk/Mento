/*
 * Wave-1 visual review — just visit each page and screenshot. No clicks.
 */
import { test, type Page } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'

const OUT = path.join(__dirname, 'ui-screenshots-v2')

test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }))

async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true })
}

test.describe.configure({ mode: 'serial' })

test.describe('Wave-1 visual review', () => {
  test('landing', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(2000)
    await shot(page, '01-landing')
  })

  test('role pick', async ({ page }) => {
    await page.goto('/onboarding/role')
    await page.waitForTimeout(800)
    await shot(page, '02-role-pick')
  })

  test('welcome flash', async ({ page }) => {
    await page.goto('/onboarding/welcome')
    await page.waitForTimeout(800)
    await shot(page, '03-welcome-flash')
  })

  test('login', async ({ page }) => {
    await page.goto('/login?role=ASPIRANT')
    await page.waitForTimeout(800)
    await shot(page, '04-login')
  })

  test('otp', async ({ page }) => {
    await page.goto('/otp?phone=%2B919876543210&role=ASPIRANT')
    await page.waitForTimeout(800)
    await shot(page, '05-otp')
  })

  test('mentor welcome', async ({ page }) => {
    await page.goto('/onboarding/mentor-welcome')
    await page.waitForTimeout(800)
    await shot(page, '06-mentor-welcome')
  })

  test('get-app', async ({ page }) => {
    await page.goto('/get-app')
    await page.waitForTimeout(800)
    await shot(page, '07-get-app')
  })

  test('authenticated screens', async ({ page, request }) => {
    const phone = `+91${String(Math.floor(Math.random() * 1e10)).padStart(10, '0')}`
    const r1 = await request.post('http://localhost:4000/auth/otp/request', { data: { phone } })
    const { devCode } = (await r1.json()) as { devCode: string }
    const r2 = await request.post('http://localhost:4000/auth/otp/verify', {
      data: { phone, code: devCode },
    })
    const session = (await r2.json()) as {
      tokens: { accessToken: string; refreshToken: string }
      user: { id: string }
      profile: unknown
    }
    // Submit Mirror via API so we land on dashboard
    await request.post('http://localhost:4000/onboarding/mirror', {
      headers: { Authorization: `Bearer ${session.tokens.accessToken}` },
      data: { journeyStage: 'ONE_YEAR_IN', background: 'coaching', knowledge: {}, challenges: ['Distraction'] },
    })

    // Seed localStorage with proper Zustand persist shape including hasHydrated
    await page.goto('/get-app')
    await page.evaluate(
      ({ a, r, u, p }) => {
        window.localStorage.setItem(
          'mento.auth',
          JSON.stringify({
            state: {
              user: { id: u, role: 'ASPIRANT', status: 'ACTIVE', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
              profile: p,
              tokens: { accessToken: a, refreshToken: r, expiresIn: 900 },
            },
            version: 0,
          }),
        )
        window.localStorage.setItem('mento.access', a)
      },
      { a: session.tokens.accessToken, r: session.tokens.refreshToken, u: session.user.id, p: session.profile },
    )

    await page.goto('/dashboard')
    await page.waitForTimeout(2000)
    await shot(page, '10-dashboard')

    await page.goto('/journals')
    await page.waitForTimeout(1500)
    await shot(page, '11-journals')

    await page.goto('/chat')
    await page.waitForTimeout(1500)
    await shot(page, '12-chat-empty')

    await page.goto('/mentors')
    await page.waitForTimeout(2000)
    await shot(page, '13-mentors')
  })
})
