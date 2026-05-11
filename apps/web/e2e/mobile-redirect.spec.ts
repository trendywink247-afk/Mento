import { expect, test } from '@playwright/test'

test.describe('Mobile UA hard redirect', () => {
  test('Pixel viewport hitting / is redirected to /get-app', async ({ page }) => {
    const res = await page.goto('/')
    // Either we end up on /get-app (full client redirect) or the response was a 3xx to it.
    await expect(page).toHaveURL(/\/get-app/, { timeout: 5_000 })
    await expect(page.getByRole('heading', { name: /works best as an app/i })).toBeVisible()

    // The redirect should not have leaked the landing content.
    const html = await page.content()
    expect(html).not.toMatch(/get started/i)
    void res
  })

  test('Pixel viewport /onboarding/role also redirects', async ({ page }) => {
    await page.goto('/onboarding/role')
    await expect(page).toHaveURL(/\/get-app/)
  })

  test('Googlebot UA bypasses mobile redirect (SEO)', async ({ browser }) => {
    const ctx = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/W.X.Y.Z Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    })
    const page = await ctx.newPage()
    await page.goto('/')
    await expect(page).not.toHaveURL(/\/get-app/)
    await ctx.close()
  })
})
