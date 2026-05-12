import { test, type Page } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'

const OUT_DIR = path.join(__dirname, 'ui-screenshots')

async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), fullPage: true })
}

test.describe('final captures', () => {
  test('get-app desktop', async ({ page }) => {
    await page.goto('/get-app')
    await page.waitForTimeout(800)
    await shot(page, '40-get-app-desktop')
  })

  test('mentor philosophy intro', async ({ page }) => {
    await page.goto('/onboarding/mentor-welcome')
    await page.waitForTimeout(800)
    await shot(page, '30-mentor-welcome')
  })

  test('mentor wizard initial', async ({ page, request }) => {
    const phone = `+91${String(Math.floor(Math.random() * 1e10)).padStart(10, '0')}`
    const reqRes = await request.post('http://localhost:4000/auth/otp/request', { data: { phone } })
    const { devCode } = (await reqRes.json()) as { devCode: string }
    const verifyRes = await request.post('http://localhost:4000/auth/otp/verify', {
      data: { phone, code: devCode },
    })
    const v = (await verifyRes.json()) as { tokens: { accessToken: string; refreshToken: string }; user: { id: string }; profile: unknown }

    // Pre-populate localStorage BEFORE navigating to /onboarding/mentor.
    // Avoid auth-store hydration race by landing on a page that doesn't gate first.
    await page.goto('/get-app')
    await page.evaluate(
      ({ a, r, p, u }) => {
        window.localStorage.setItem(
          'mento.auth',
          JSON.stringify({
            state: {
              user: { id: u, phone: null, email: null, role: 'ASPIRANT', status: 'ACTIVE', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
              profile: p,
              tokens: { accessToken: a, refreshToken: r, expiresIn: 900 },
            },
            version: 0,
          }),
        )
        window.localStorage.setItem('mento.access', a)
      },
      { a: v.tokens.accessToken, r: v.tokens.refreshToken, u: v.user.id, p: v.profile },
    )

    await page.goto('/onboarding/mentor')
    await page.waitForTimeout(1500)
    await shot(page, '31-mentor-journey')
  })

  test('mobile redirect', async ({ browser }) => {
    const ctx = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      viewport: { width: 393, height: 852 },
    })
    const page = await ctx.newPage()
    await page.goto('http://localhost:3030/')
    await page.waitForTimeout(800)
    await shot(page, '50-mobile-get-app')
    await ctx.close()
  })
})
