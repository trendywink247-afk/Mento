import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Only enable when a DSN is present — keeps local dev quiet.
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN && process.env.NODE_ENV !== 'test',
  tracesSampleRate: 0.1,
  // Don't ship source maps in dev — keep production source maps only.
  debug: false,
})
