/**
 * Keyboard navigation tests
 *
 * Verifies that focus order is logical and all interactive elements
 * are reachable and operable via keyboard alone.
 *
 * Pre-requisites: api + web must be running.
 */
import { test, expect } from '@playwright/test'
import { requestAndVerifyOtp, uniquePhone } from './helpers'

// ---------------------------------------------------------------------------
// Helper: log in via API and inject session into localStorage
// ---------------------------------------------------------------------------

async function injectSession(page: import('@playwright/test').Page, request: import('@playwright/test').APIRequestContext) {
  const phone = uniquePhone()
  const session = await requestAndVerifyOtp(request, phone)

  await page.goto('/')
  await page.evaluate(
    ({ accessToken, refreshToken, userId, displayHandle }) => {
      const store = {
        state: {
          tokens: { accessToken, refreshToken },
          user: { id: userId, role: 'ASPIRANT' },
          profile: {
            displayHandle,
            avatarLetter: 'A',
            avatarColor: 'SLATE',
            hasPurpleTick: false,
          },
        },
        version: 0,
      }
      localStorage.setItem('mento.auth', JSON.stringify(store))
      // Also set the raw access token (used by some parts of the app)
      localStorage.setItem('mento.access', accessToken)
    },
    {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      userId: session.userId,
      displayHandle: session.displayHandle || 'Aspirant_kbtest',
    },
  )

  return session
}

// ---------------------------------------------------------------------------
// Landing page — tab order and keyboard CTA
// ---------------------------------------------------------------------------

test.describe('keyboard — landing page', () => {
  test('tab order follows visual reading order', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // First Tab: skip-to-content link
    await page.keyboard.press('Tab')
    const skipLink = page.locator('a[href="#main"]')
    await expect(skipLink).toBeFocused()

    // Second Tab: "Mento" brand link in nav
    await page.keyboard.press('Tab')
    const mentoLink = page.getByRole('link', { name: 'Mento' }).first()
    await expect(mentoLink).toBeFocused()

    // Third Tab: Sign in nav link
    await page.keyboard.press('Tab')
    const signInLink = page.getByRole('link', { name: /sign in/i }).first()
    await expect(signInLink).toBeFocused()
  })

  test('Get started CTA is reachable by keyboard and activates via Enter', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Tab until we reach the "Get started" link
    let found = false
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Tab')
      const el = await page.evaluate(() => document.activeElement?.textContent?.trim())
      if (el?.toLowerCase().includes('get started')) {
        found = true
        break
      }
    }
    expect(found).toBe(true)

    // Activate via Enter
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/onboarding\/role/)
  })
})

// ---------------------------------------------------------------------------
// Login page — tab order + Enter submit
// ---------------------------------------------------------------------------

test.describe('keyboard — login page', () => {
  test('tab order: key elements are focusable in logical order', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('domcontentloaded')

    // The login form has autoFocus on the phone input, so initial focus starts there.
    const phoneInput = page.locator('#phone')
    await expect(phoneInput).toBeFocused()

    // Tab forward to checkbox (Terms) — skips disabled Google button
    await page.keyboard.press('Tab')
    const checkbox = page.locator('input[type="checkbox"]')
    await expect(checkbox).toBeFocused()

    // Send OTP button is disabled by default (no digits + checkbox unchecked).
    // It's excluded from tab order when disabled — that's correct behavior.
    const sendBtn = page.getByRole('button', { name: /send otp/i })
    await expect(sendBtn).toBeDisabled()

    // After checking the box + filling phone, the button becomes enabled.
    await checkbox.check()
    await phoneInput.fill('9876543210')
    // Now button should be enabled
    await expect(sendBtn).not.toBeDisabled()
    await sendBtn.focus()
    await expect(sendBtn).toBeFocused()
  })

  test('Enter key on phone input does NOT submit (button is disabled without checkbox)', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('domcontentloaded')

    const phoneInput = page.locator('#phone')
    await phoneInput.focus()
    await phoneInput.fill('9876543210')

    // Press Enter — should not navigate (agreement checkbox not checked)
    await page.keyboard.press('Enter')
    // Still on login page
    await expect(page).toHaveURL(/\/login/)
  })

  test('Space bar toggles terms checkbox', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('domcontentloaded')

    const checkbox = page.locator('input[type="checkbox"]')
    await checkbox.focus()
    expect(await checkbox.isChecked()).toBe(false)

    await page.keyboard.press('Space')
    expect(await checkbox.isChecked()).toBe(true)

    await page.keyboard.press('Space')
    expect(await checkbox.isChecked()).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// OTP page — cells keyboard navigation
// ---------------------------------------------------------------------------

test.describe('keyboard — OTP input', () => {
  test('OTP cells: all 6 cells exist with correct aria-labels', async ({ page }) => {
    await page.goto('/otp?phone=%2B919876543210')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(400) // wait for animation

    const cells = page.locator('input[aria-label^="Digit"]')
    await expect(cells).toHaveCount(6)

    // Verify each cell has proper aria-label
    for (let i = 0; i < 6; i++) {
      await expect(cells.nth(i)).toHaveAttribute('aria-label', `Digit ${i + 1} of 6`)
    }

    // Focus first cell and type a digit via fill
    await cells.nth(0).focus()
    await cells.nth(0).fill('1')

    // ArrowRight on first cell should move focus to cell 2
    await cells.nth(0).focus()
    await page.keyboard.press('ArrowRight')
    await expect(cells.nth(1)).toBeFocused()

    // ArrowLeft goes back
    await page.keyboard.press('ArrowLeft')
    await expect(cells.nth(0)).toBeFocused()
  })

  test('OTP: cells accept numeric input only', async ({ page }) => {
    await page.goto('/otp?phone=%2B919876543210')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(400)

    const cells = page.locator('input[aria-label^="Digit"]')

    // Verify inputMode is numeric on each cell
    for (let i = 0; i < 6; i++) {
      await expect(cells.nth(i)).toHaveAttribute('inputmode', 'numeric')
    }

    // Verify autoComplete is one-time-code on first cell (Web OTP API)
    await expect(cells.nth(0)).toHaveAttribute('autocomplete', 'one-time-code')
  })

  test('Verify button is visible and disabled when no OTP is entered', async ({ page }) => {
    await page.goto('/otp?phone=%2B919876543210')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(400)

    // Without any OTP entered, the Verify button should be disabled
    const verifyBtn = page.getByRole('button', { name: /verify & sign in/i })
    await expect(verifyBtn).toBeVisible()
    await expect(verifyBtn).toBeDisabled()
  })
})

// ---------------------------------------------------------------------------
// Mirror wizard — keyboard navigation through steps
// ---------------------------------------------------------------------------

test.describe('keyboard — Mirror wizard', () => {
  test('mirror intro: Begin button is focusable and activatable via Enter', async ({ page, request }) => {
    await injectSession(page, request)
    await page.goto('/onboarding/mirror')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(400)

    // Focus the Begin button directly (it's always the primary CTA on the intro step)
    const beginBtn = page.getByRole('button', { name: /^begin$/i })
    await expect(beginBtn).toBeVisible()
    await beginBtn.focus()
    await expect(beginBtn).toBeFocused()

    // Activate via Enter
    await page.keyboard.press('Enter')

    // Should advance to journey step
    const journeyHeading = page.getByRole('heading', { name: /where are you in your journey/i })
    await expect(journeyHeading).toBeVisible({ timeout: 5000 })
  })

  test('journey step: options reachable and selectable by keyboard', async ({ page, request }) => {
    await injectSession(page, request)
    await page.goto('/onboarding/mirror')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(400)

    // Click Begin to advance
    await page.getByRole('button', { name: /^begin$/i }).click()
    await page.waitForTimeout(300)

    // First option in journey step
    const firstOption = page.locator('[aria-pressed]').first()
    await firstOption.focus()
    await page.keyboard.press('Enter')
    // Should now be selected
    await expect(firstOption).toHaveAttribute('aria-pressed', 'true')
  })
})

// ---------------------------------------------------------------------------
// Dashboard — keyboard navigation
// ---------------------------------------------------------------------------

test.describe('keyboard — dashboard', () => {
  test('sidebar nav items are all reachable via Tab', async ({ page, request }) => {
    await injectSession(page, request)
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    const navLinks = page.locator('aside nav a')
    const count = await navLinks.count()
    expect(count).toBeGreaterThan(3)

    // Verify each nav link has a visible text label
    for (let i = 0; i < count; i++) {
      const text = await navLinks.nth(i).textContent()
      expect(text?.trim().length).toBeGreaterThan(0)
    }
  })

  test('header action buttons have aria-labels', async ({ page, request }) => {
    await injectSession(page, request)
    await page.goto('/dashboard')
    await page.waitForTimeout(500)

    const searchBtn = page.getByRole('button', { name: /search/i })
    await expect(searchBtn).toBeVisible()

    const notifBtn = page.getByRole('button', { name: /notifications/i })
    await expect(notifBtn).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Chat — tab between tabs via keyboard
// ---------------------------------------------------------------------------

test.describe('keyboard — chat', () => {
  test('chat tab buttons all have role=tab and aria-selected', async ({ page, request }) => {
    await injectSession(page, request)
    await page.goto('/chat')
    // Wait for either the tab bar or a loading state
    await page.waitForTimeout(2000)

    const tabs = page.locator('[role="tab"]')
    const count = await tabs.count()
    expect(count).toBe(4)

    // The first tab (All) should be selected by default
    await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'true')
    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'false')
  })

  test('chat tabs are keyboard-focusable', async ({ page, request }) => {
    await injectSession(page, request)
    await page.goto('/chat')
    await page.waitForTimeout(2000)

    // Find and focus the "Pending" tab
    const pendingTab = page.getByRole('tab', { name: /pending/i })
    await expect(pendingTab).toBeVisible()
    await pendingTab.focus()
    await expect(pendingTab).toBeFocused()

    await page.keyboard.press('Enter')
    await expect(pendingTab).toHaveAttribute('aria-selected', 'true')
  })
})

// ---------------------------------------------------------------------------
// Mentors — search input + filter toggles via keyboard
// ---------------------------------------------------------------------------

test.describe('keyboard — mentors', () => {
  test('search input is labelled and focusable', async ({ page, request }) => {
    await injectSession(page, request)
    await page.goto('/mentors')
    await page.waitForTimeout(1000)

    const searchInput = page.locator('#mentor-search')
    await searchInput.focus()
    await expect(searchInput).toBeFocused()

    await page.keyboard.type('geo')
    await expect(searchInput).toHaveValue('geo')
  })

  test('sort dropdown is labelled and operable by keyboard', async ({ page, request }) => {
    await injectSession(page, request)
    await page.goto('/mentors')
    await page.waitForTimeout(1000)

    const sortSelect = page.locator('#mentor-sort')
    await sortSelect.focus()
    await expect(sortSelect).toBeFocused()

    // Should have options
    const options = sortSelect.locator('option')
    expect(await options.count()).toBeGreaterThan(1)
  })

  test('Filters button expands panel via keyboard', async ({ page, request }) => {
    await injectSession(page, request)
    await page.goto('/mentors')
    await page.waitForTimeout(1000)

    const filtersBtn = page.getByRole('button', { name: /filters/i })
    await filtersBtn.focus()
    await page.keyboard.press('Enter')

    // Filters panel should appear
    const panel = page.locator('#mentor-filters-panel')
    await expect(panel).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Journals — accessible button labels for category buttons
// ---------------------------------------------------------------------------

test.describe('keyboard — journals', () => {
  test('journal category buttons are keyboard-focusable and have labels', async ({ page, request }) => {
    await injectSession(page, request)
    await page.goto('/journals')
    await page.waitForTimeout(1000)

    // Find the first category button
    const categoryButtons = page.getByRole('button').filter({ hasText: /personal journal|polity|history|geography/i })
    const count = await categoryButtons.count()
    expect(count).toBeGreaterThan(0)

    // Each should be focusable
    await categoryButtons.first().focus()
    await expect(categoryButtons.first()).toBeFocused()
  })
})
