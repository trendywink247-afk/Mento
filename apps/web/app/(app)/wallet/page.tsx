'use client'

import { useEffect, useState } from 'react'
import { getApiClient } from '@/lib/api'

type WalletTxn = {
  id: string
  type: string
  amountInr: number
  status: string
  reference: string | null
  sessionId: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
}

const TYPE_LABELS: Record<string, string> = {
  HOLD: 'Hold',
  CAPTURE: 'Capture',
  REFUND: 'Refund',
  CREDIT: 'Credit',
  DEBIT: 'Debit',
}

const TYPE_COLORS: Record<string, string> = {
  HOLD: 'text-amber-700 dark:text-amber-300',
  CAPTURE: 'text-red-600 dark:text-red-400',
  REFUND: 'text-emerald-700 dark:text-emerald-300',
  CREDIT: 'text-emerald-700 dark:text-emerald-300',
  DEBIT: 'text-red-600 dark:text-red-400',
}

function typeSign(type: string): string {
  return type === 'REFUND' || type === 'CREDIT' ? '+' : '−'
}

export default function WalletPage() {
  const [txns, setTxns] = useState<WalletTxn[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getApiClient()
      .wallet.list()
      .then(setTxns)
      .catch(() => setError('Failed to load wallet transactions'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Wallet</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Transaction history. All payments are simulated in MVP — no card is charged.
        </p>
      </div>

      <div className="rounded-xl border bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
        Simulated payment for MVP. Real Razorpay escrow arrives in v1.1 (August).
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : txns.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">No transactions yet.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            When you book a 1-on-1 session, a simulated hold will appear here.
          </p>
        </div>
      ) : (
        <div className="divide-y rounded-xl border bg-card">
          {txns.map((t) => (
            <div key={t.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className={['text-sm font-medium', TYPE_COLORS[t.type] ?? ''].join(' ')}>
                    {TYPE_LABELS[t.type] ?? t.type}
                  </span>
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {t.status}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {new Date(t.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}{' '}
                  · {new Date(t.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </p>
                {t.reference && (
                  <p className="mt-0.5 text-[10px] text-muted-foreground/70 font-mono">
                    {t.reference}
                  </p>
                )}
              </div>
              <span className={['text-sm font-semibold', TYPE_COLORS[t.type] ?? ''].join(' ')}>
                {typeSign(t.type)}₹{t.amountInr}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
