'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { X, Lock } from 'lucide-react'

type Tier = 'FREE' | 'BASIC' | 'PRO' | 'MAX'

interface PaywallEvent extends CustomEvent {
  detail: { requiredTier: Tier; currentTier: Tier }
}

const TIER_LABEL: Record<Tier, string> = {
  FREE: 'Free',
  BASIC: 'Basic (₹399/mo)',
  PRO: 'Pro (₹599/mo)',
  MAX: 'Max (₹999/mo)',
}

const TIER_UPGRADE_LABEL: Record<Tier, string> = {
  FREE: 'Free',
  BASIC: 'Basic',
  PRO: 'Pro',
  MAX: 'Max',
}

/**
 * Global paywall modal. Listens for a custom `mento:paywall` event dispatched
 * by the API client when a 402 Payment Required response is received.
 *
 * Mount once inside (app)/layout.tsx.
 */
export function PaywallModal() {
  const [open, setOpen] = useState(false)
  const [required, setRequired] = useState<Tier>('BASIC')
  const [current, setCurrent] = useState<Tier>('FREE')

  useEffect(() => {
    function handler(e: Event) {
      const detail = (e as PaywallEvent).detail
      setRequired(detail.requiredTier)
      setCurrent(detail.currentTier)
      setOpen(true)
    }

    window.addEventListener('mento:paywall', handler)
    return () => window.removeEventListener('mento:paywall', handler)
  }, [])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false)
      }}
    >
      <div className="relative w-full max-w-sm rounded-2xl bg-background p-6 shadow-2xl">
        <button
          onClick={() => setOpen(false)}
          className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:bg-accent"
          aria-label="Close"
        >
          <X size={16} />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Lock size={22} className="text-primary" />
          </div>

          <h2 className="mt-4 text-lg font-bold">
            {TIER_UPGRADE_LABEL[required]} plan required
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This feature is available on the{' '}
            <span className="font-semibold text-foreground">
              {TIER_LABEL[required]}
            </span>{' '}
            plan. You are currently on{' '}
            <span className="font-semibold text-foreground">
              {TIER_LABEL[current]}
            </span>
            .
          </p>

          <Link
            href={`/upgrade?tier=${required}`}
            onClick={() => setOpen(false)}
            className="mt-5 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Upgrade to {TIER_UPGRADE_LABEL[required]}
          </Link>

          <button
            onClick={() => setOpen(false)}
            className="mt-2 w-full rounded-xl px-4 py-2.5 text-sm text-muted-foreground hover:bg-accent transition-colors"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  )
}
