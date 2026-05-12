'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * Global error boundary for the web app.
 * Captures unhandled runtime errors into Sentry (when DSN is set).
 * Users see a calm, branded error screen rather than a blank crash.
 */
export default function GlobalError({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN && process.env.NODE_ENV !== 'test') {
      Sentry.captureException(error)
    }
  }, [error])

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 font-sans antialiased">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="max-w-sm text-center text-sm text-gray-500">
          We've noted the issue and will look into it. Please try again.
        </p>
        <button
          onClick={reset}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Try again
        </button>
      </body>
    </html>
  )
}
