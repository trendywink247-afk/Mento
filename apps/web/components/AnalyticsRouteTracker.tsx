'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { capture, initAnalytics } from '@/lib/analytics'

/**
 * Fires a $pageview event on every client-side route change.
 * Include this component once, inside the root layout.
 * Autocapture is disabled — we track explicitly to stay anonymity-safe.
 */
export function AnalyticsRouteTracker() {
  const pathname = usePathname()

  // Initialise PostHog on first mount (no-op when key not set).
  useEffect(() => {
    initAnalytics()
  }, [])

  // Fire $pageview on every pathname change.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (process.env.NODE_ENV === 'test') return
    // Defer slightly so PostHog has time to finish lazy-init on first load.
    const t = setTimeout(() => {
      capture('$pageview', { $current_url: window.location.href })
    }, 50)
    return () => clearTimeout(t)
  }, [pathname])

  return null
}
