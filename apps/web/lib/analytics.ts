/**
 * Thin wrapper around posthog-js.
 * - Lazy-initialised: no-op when NEXT_PUBLIC_POSTHOG_KEY is unset.
 * - SSR-safe: guards every call with `typeof window !== 'undefined'`.
 * - Never sends PII: callers MUST pass only user UUID, never phone/email/handle.
 * - Disabled in test environments.
 */

import type { PostHogInterface } from 'posthog-js'

let _posthog: PostHogInterface | null = null

function getPostHog(): PostHogInterface | null {
  if (typeof window === 'undefined') return null
  if (process.env.NODE_ENV === 'test') return null
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!key) return null

  if (!_posthog) {
    // Dynamic import keeps posthog-js out of the server bundle entirely.
    // This function is only ever called from client components, so the
    // synchronous posthog singleton is available on next tick after init.
    // We return null on the very first call while the module loads —
    // subsequent calls (after the effect fires) will have _posthog set.
    void import('posthog-js').then(({ default: posthog }) => {
      posthog.init(key, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.posthog.com',
        autocapture: false, // explicit events only — anonymity-safe
        capture_pageview: false, // we fire $pageview manually via AnalyticsRouteTracker
        capture_pageleave: false,
        persistence: 'localStorage+cookie',
        loaded: (ph) => {
          _posthog = ph
        },
      })
    })
    return null
  }

  return _posthog
}

/**
 * Initialise PostHog eagerly.
 * Call once from a client component's useEffect (e.g. Providers).
 */
export function initAnalytics(): void {
  getPostHog()
}

/**
 * Identify a logged-in user.
 * @param userId  The user's UUID — no PII.
 * @param props   Safe properties: role, etc. Never phone/email/displayHandle.
 */
export function identify(userId: string, props?: Record<string, string>): void {
  getPostHog()?.identify(userId, props)
}

/**
 * Capture a named event with optional safe properties.
 */
export function capture(event: string, props?: Record<string, unknown>): void {
  getPostHog()?.capture(event, props)
}

/**
 * Reset the PostHog identity (call on sign-out).
 */
export function reset(): void {
  getPostHog()?.reset()
}
