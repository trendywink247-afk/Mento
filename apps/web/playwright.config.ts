import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright config — runs against a locally-running stack.
 *
 * Pre-requisites before `pnpm test:e2e`:
 *   pnpm db:up                            # postgres :5433, redis :6380
 *   cd apps/api && pnpm prisma db push --accept-data-loss
 *   pnpm dev                              # in another terminal (api + web + mobile-expo)
 *
 * Alternatively, the `webServer` block below lets Playwright spawn web+api itself
 * (set CI=1 to use it). We keep both API and web on their dev ports.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // OTP state is shared per phone; serialise to keep tests sane
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.WEB_BASE_URL ?? 'http://localhost:3030',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    extraHTTPHeaders: {
      Accept: 'application/json',
    },
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
      // Mobile-only specs are exclusive to the mobile-android project.
      testIgnore: [/mobile-redirect\.spec\.ts/, /api-.*\.spec\.ts/],
    },
    {
      name: 'mobile-android',
      use: { ...devices['Pixel 5'] },
      testMatch: /mobile-redirect\.spec\.ts/,
    },
    {
      name: 'api',
      // Hits the api directly; baseURL is overridden in each request.
      use: { baseURL: process.env.API_BASE_URL ?? 'http://localhost:4000' },
      testMatch: /api-.*\.spec\.ts/,
    },
  ],
})
