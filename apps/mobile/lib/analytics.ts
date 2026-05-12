/**
 * Thin mobile analytics wrapper.
 * - No-op when env keys are absent.
 * - Never passes PII (phone, email, displayHandle) — user UUID only.
 * - Disabled in test environments.
 */

import { PostHog } from 'posthog-react-native'

let _client: PostHog | null = null

/**
 * Call once at app startup (RootLayout).
 * Returns the client so callers can await client.ready() if needed.
 */
export function initAnalytics(): PostHog | null {
  if (process.env.NODE_ENV === 'test') return null
  const key = process.env.EXPO_PUBLIC_POSTHOG_KEY
  if (!key) return null
  if (_client) return _client
  _client = new PostHog(key, {
    host: process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.posthog.com',
    // Autocapture off — explicit events only (anonymity-safe).
    captureNativeAppLifecycleEvents: false,
  })
  return _client
}

/** Identify a logged-in user. UUID only — no PII. */
export function identify(userId: string, props?: Record<string, string>): void {
  _client?.identify(userId, props)
}

/** Capture a named event with optional safe props. */
export function capture(event: string, props?: Record<string, string | number | boolean | null>): void {
  _client?.capture(event, props as Record<string, string | number | boolean | null>)
}

/** Reset identity on sign-out. */
export function reset(): void {
  _client?.reset()
}
