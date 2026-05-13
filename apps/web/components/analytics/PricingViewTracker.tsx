'use client'

import { useEffect } from 'react'
import { capture } from '@/lib/analytics'
import { ANALYTICS_EVENTS } from '@/lib/events'

/** Fire-and-forget client component that captures a pricing_viewed event on mount. */
export function PricingViewTracker() {
  useEffect(() => {
    capture(ANALYTICS_EVENTS.PRICING_VIEWED)
  }, [])
  return null
}
