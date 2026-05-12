'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Check, Loader2, AlertCircle } from 'lucide-react'
import { getApiClient } from '@/lib/api'

type Tier = 'FREE' | 'BASIC' | 'PRO' | 'MAX'
type PaidTier = 'BASIC' | 'PRO' | 'MAX'

const TIER_META: Record<
  PaidTier,
  { label: string; priceLabel: string; description: string; features: string[] }
> = {
  BASIC: {
    label: 'Basic',
    priceLabel: '₹399/month',
    description: 'Personal journals, open chat, mentor discovery',
    features: [
      'Anonymous mentor discovery',
      '160-char intro chat request',
      'Personal journals',
      'Open chat after acceptance',
    ],
  },
  PRO: {
    label: 'Pro',
    priceLabel: '₹599/month',
    description: 'Everything in Basic, plus broadcast requests and chat-to-journal',
    features: [
      'Everything in Basic',
      'Broadcast mentor requests',
      'Saved chat-to-journal',
      'Priority in mentor feed',
    ],
  },
  MAX: {
    label: 'Max',
    priceLabel: '₹999/month',
    description: 'Full access including 1:1 session credits (v1.1) and group sessions',
    features: [
      'Everything in Pro',
      '1:1 session credits (v1.1)',
      'Group session access',
      'Verified-mentor priority',
    ],
  },
}

const PAID_TIERS: PaidTier[] = ['BASIC', 'PRO', 'MAX']

function isBrowser(): boolean {
  return typeof window !== 'undefined'
}

function isDevMode(): boolean {
  return !process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
}

export default function UpgradePage() {
  const params = useSearchParams()
  const initialTier = (params?.get('tier') as PaidTier | null) ?? 'PRO'

  const [currentTier, setCurrentTier] = useState<Tier>('FREE')
  const [selectedTier, setSelectedTier] = useState<PaidTier>(
    PAID_TIERS.includes(initialTier) ? initialTier : 'PRO',
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const rzpScriptLoaded = useRef(false)

  // Fetch current subscription on mount
  useEffect(() => {
    getApiClient()
      .subscriptions.me()
      .then((sub) => setCurrentTier(sub.tier))
      .catch(() => {})
  }, [])

  // Lazily load Razorpay checkout.js only in prod
  useEffect(() => {
    if (isDevMode() || rzpScriptLoaded.current) return
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    script.onload = () => {
      rzpScriptLoaded.current = true
    }
    document.body.appendChild(script)
  }, [])

  async function handleUpgrade() {
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const result = await getApiClient().subscriptions.checkout(selectedTier)

      if (result.simulated) {
        // Dev mode — call simulate-success immediately
        const sim = await getApiClient().subscriptions.simulateSuccess(selectedTier)
        setCurrentTier(sim.tier as Tier)
        setSuccess(
          `[Dev] Activated ${sim.tier} until ${new Date(sim.currentPeriodEnd).toLocaleDateString()}`,
        )
      } else {
        // Prod — open Razorpay checkout
        openRazorpay(result.orderId, selectedTier)
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function openRazorpay(subscriptionId: string, tier: PaidTier) {
    if (!isBrowser()) return
    const key = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
    if (!key) return

    const Razorpay = (window as unknown as { Razorpay?: new (opts: Record<string, unknown>) => { open: () => void } }).Razorpay
    if (!Razorpay) {
      setError('Payment SDK failed to load. Please refresh and try again.')
      return
    }

    const rzp = new Razorpay({
      key,
      subscription_id: subscriptionId,
      name: 'Mento',
      description: `${TIER_META[tier].label} — ${TIER_META[tier].priceLabel}`,
      handler: (response: { razorpay_payment_id: string }) => {
        setSuccess(`Payment successful. Your ${tier} plan is now active.`)
        setCurrentTier(tier)
        // In production Razorpay webhook fires subscription.activated which
        // updates the DB. The UI optimistically reflects the new tier.
        void response.razorpay_payment_id
      },
      prefill: {},
      theme: { color: '#7c3aed' },
    })
    rzp.open()
  }

  const dev = isDevMode()

  return (
    <div className="mx-auto max-w-2xl py-10">
      <h1 className="text-2xl font-bold">Upgrade your plan</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Your current tier:{' '}
        <span className="font-semibold capitalize text-foreground">
          {currentTier.toLowerCase()}
        </span>
      </p>

      {dev && (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
          Dev mode — payments are simulated. No real charge will occur.
        </div>
      )}

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
          {success}
        </div>
      )}

      {/* Tier selector */}
      <div className="mt-8 space-y-3">
        {PAID_TIERS.map((tier) => {
          const meta = TIER_META[tier]
          const isSelected = selectedTier === tier
          const isCurrent = currentTier === tier

          return (
            <button
              key={tier}
              onClick={() => setSelectedTier(tier)}
              className={[
                'group w-full rounded-xl border p-4 text-left transition-all',
                isSelected
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                  : 'border-border hover:border-primary/30 hover:bg-accent',
              ].join(' ')}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{meta.label}</span>
                    {isCurrent && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                        Current
                      </span>
                    )}
                    {tier === 'PRO' && !isCurrent && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                        Popular
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">{meta.description}</p>
                  <ul className="mt-2 space-y-1">
                    {meta.features.map((f) => (
                      <li key={f} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Check size={12} className="shrink-0 text-emerald-500" strokeWidth={2.5} />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="shrink-0 text-right">
                  <span className="font-bold">{meta.priceLabel}</span>
                  <div
                    className={[
                      'mt-1 h-4 w-4 rounded-full border-2 ml-auto',
                      isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/30',
                    ].join(' ')}
                  />
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Action button */}
      <button
        onClick={handleUpgrade}
        disabled={loading || currentTier === selectedTier}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading && <Loader2 size={16} className="animate-spin" />}
        {currentTier === selectedTier
          ? 'Already on this plan'
          : dev
          ? `Activate ${TIER_META[selectedTier].label} (simulated)`
          : `Pay ${TIER_META[selectedTier].priceLabel}`}
      </button>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Payments processed securely by Razorpay. Cancel anytime.
      </p>

      {/* Cancel current subscription */}
      {currentTier !== 'FREE' && (
        <div className="mt-8 border-t pt-6">
          <p className="text-sm font-medium">Cancel subscription</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Your access continues until the end of the current billing period.
          </p>
          <CancelButton onCancelled={() => setCurrentTier('FREE')} />
        </div>
      )}
    </div>
  )
}

function CancelButton({ onCancelled }: { onCancelled: () => void }) {
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function handleCancel() {
    if (!confirm('Are you sure you want to cancel your subscription?')) return
    setLoading(true)
    setErr(null)
    try {
      await getApiClient().subscriptions.cancel()
      onCancelled()
    } catch {
      setErr('Failed to cancel. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-3">
      <button
        onClick={handleCancel}
        disabled={loading}
        className="rounded-lg border border-destructive/30 px-4 py-2 text-sm text-destructive hover:bg-destructive/5 disabled:opacity-50"
      >
        {loading ? <Loader2 size={14} className="inline animate-spin" /> : 'Cancel subscription'}
      </button>
      {err && <p className="mt-1 text-xs text-destructive">{err}</p>}
    </div>
  )
}
