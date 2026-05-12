'use client'

import { useEffect, useState } from 'react'
import { getApiClient } from '@/lib/api'
import { LetterAvatar } from '@/components/LetterAvatar'
import type { AvatarColor, AvatarLetter } from '@mento/types'
import { useAuthStore } from '@/lib/auth-store'

type SessionRequest = {
  id: string
  scheduledAt: string
  durationMin: number
  hourlyRateInr: number
  amountInr: number
  status: string
  paymentStatus: string
  message: string | null
  createdAt: string
  respondedAt: string | null
  expiresAt: string | null
  session: { id: string } | null
  counterpart: {
    id: string
    displayHandle: string
    avatarLetter: AvatarLetter
    avatarColor: AvatarColor
    hasPurpleTick: boolean
  }
}

type Tab = 'upcoming' | 'pending' | 'completed' | 'cancelled'

const TABS: { key: Tab; label: string }[] = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'pending', label: 'Pending' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
]

function statusBadge(status: string) {
  const map: Record<string, string> = {
    PENDING: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    ACCEPTED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    DECLINED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    CANCELLED: 'bg-muted text-muted-foreground',
    COMPLETED: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
    EXPIRED: 'bg-muted text-muted-foreground',
  }
  return map[status] ?? 'bg-muted text-muted-foreground'
}

function filterByTab(requests: SessionRequest[], tab: Tab): SessionRequest[] {
  switch (tab) {
    case 'upcoming':
      return requests.filter((r) => r.status === 'ACCEPTED')
    case 'pending':
      return requests.filter((r) => r.status === 'PENDING')
    case 'completed':
      return requests.filter((r) => r.status === 'COMPLETED')
    case 'cancelled':
      return requests.filter((r) => r.status === 'CANCELLED' || r.status === 'DECLINED' || r.status === 'EXPIRED')
    default:
      return []
  }
}

export default function CallsPage() {
  const { user } = useAuthStore()
  const isMentor = user?.role === 'MENTOR'

  const [requests, setRequests] = useState<SessionRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('upcoming')
  const [actionBusy, setActionBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const data = await getApiClient().sessions.listRequests()
      setRequests(data)
    } catch {
      setError('Failed to load sessions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleAccept(id: string) {
    setActionBusy(id)
    try {
      await getApiClient().sessions.acceptRequest(id)
      await load()
    } catch {
      setError('Could not accept request')
    } finally {
      setActionBusy(null)
    }
  }

  async function handleDecline(id: string) {
    setActionBusy(id)
    try {
      await getApiClient().sessions.declineRequest(id)
      await load()
    } catch {
      setError('Could not decline request')
    } finally {
      setActionBusy(null)
    }
  }

  async function handleCancel(id: string) {
    setActionBusy(id)
    try {
      await getApiClient().sessions.cancelRequest(id)
      await load()
    } catch {
      setError('Could not cancel request')
    } finally {
      setActionBusy(null)
    }
  }

  const visible = filterByTab(requests, activeTab)

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Calls</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          1-on-1 session requests and upcoming sessions.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {TABS.map(({ key, label }) => {
          const count = filterByTab(requests, key).length
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={[
                'px-4 py-2.5 text-sm font-medium transition-colors',
                activeTab === key
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              {label}
              {count > 0 && (
                <span className="ml-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-muted px-1 text-[10px] font-semibold text-muted-foreground">
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </p>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">No sessions here yet.</p>
          {activeTab === 'pending' && isMentor && (
            <p className="mt-1 text-xs text-muted-foreground">
              Aspirants who book with you will appear here for you to accept or decline.
            </p>
          )}
          {activeTab === 'upcoming' && !isMentor && (
            <p className="mt-1 text-xs text-muted-foreground">
              Browse mentors and request a 1-on-1 session to get started.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((r) => (
            <SessionCard
              key={r.id}
              request={r}
              isMentor={isMentor}
              busy={actionBusy === r.id}
              onAccept={() => handleAccept(r.id)}
              onDecline={() => handleDecline(r.id)}
              onCancel={() => handleCancel(r.id)}
            />
          ))}
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground">
        All payments shown are simulated. No card is charged in MVP.
      </p>
    </div>
  )
}

function SessionCard({
  request,
  isMentor,
  busy,
  onAccept,
  onDecline,
  onCancel,
}: {
  request: SessionRequest
  isMentor: boolean
  busy: boolean
  onAccept: () => void
  onDecline: () => void
  onCancel: () => void
}) {
  const scheduledDate = new Date(request.scheduledAt)
  const isPending = request.status === 'PENDING'
  const isAccepted = request.status === 'ACCEPTED'

  return (
    <div className="flex items-start gap-4 rounded-xl border bg-card p-4">
      <LetterAvatar
        letter={request.counterpart.avatarLetter}
        color={request.counterpart.avatarColor}
        hasPurpleTick={request.counterpart.hasPurpleTick}
        size={40}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{request.counterpart.displayHandle}</span>
          <span
            className={[
              'rounded-full px-2 py-0.5 text-xs font-medium',
              statusBadge(request.status),
            ].join(' ')}
          >
            {request.status.charAt(0) + request.status.slice(1).toLowerCase()}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
          <span>
            {scheduledDate.toLocaleDateString('en-IN', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            })}{' '}
            at{' '}
            {scheduledDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span>{request.durationMin} min</span>
          <span>₹{request.amountInr} (simulated)</span>
        </div>
        {request.message && (
          <p className="mt-1 text-xs text-muted-foreground italic">
            &ldquo;{request.message}&rdquo;
          </p>
        )}

        {/* Actions */}
        {isPending && isMentor && (
          <div className="mt-3 flex gap-2">
            <button
              onClick={onAccept}
              disabled={busy}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {busy ? '…' : 'Accept'}
            </button>
            <button
              onClick={onDecline}
              disabled={busy}
              className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
            >
              {busy ? '…' : 'Decline'}
            </button>
          </div>
        )}
        {isPending && !isMentor && (
          <div className="mt-3">
            <button
              onClick={onCancel}
              disabled={busy}
              className="rounded-md border px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
            >
              {busy ? '…' : 'Cancel request'}
            </button>
          </div>
        )}
        {isAccepted && (
          <div className="mt-3">
            <span className="inline-block rounded-md bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
              Session confirmed
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
