'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Inbox, Clock, Send, Archive } from 'lucide-react'
import type { ConversationSummary, AvatarLetter, AvatarColor } from '@mento/types'
import { getApiClient } from '@/lib/api'
import { LetterAvatar } from '@/components/LetterAvatar'
import { ChatConversationSkeleton } from '@/components/skeletons/ChatConversationSkeleton'
import { EmptyChat } from '@/components/illustrations/EmptyChat'

// ---- Types ----

type ChatRequestStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'ARCHIVED' | 'EXPIRED'

interface ChatRequest {
  id: string
  intro: string
  status: ChatRequestStatus
  createdAt: string
  respondedAt: string | null
  expiresAt: string | null
  conversationId: string | null
  counterpart: {
    id: string
    displayHandle: string
    avatarLetter: AvatarLetter
    avatarColor: AvatarColor
    hasPurpleTick: boolean
  }
}

type Tab = 'all' | 'pending' | 'sent' | 'archived'

// ---- Helpers ----

function formatTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString()
}

// ---- Empty states ----

function EmptyAllState() {
  return (
    <div className="rounded-2xl border bg-card p-10 text-center shadow-sm">
      <EmptyChat className="mx-auto mb-4 h-36 w-auto" />
      <p className="mx-auto max-w-sm text-base font-medium">No conversations yet.</p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
        Browse mentors and send your first 160-character intro. When a mentor accepts, your
        conversation will appear here.
      </p>
      <Link
        href="/mentors"
        className="mt-6 inline-block rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        Browse mentors
      </Link>
    </div>
  )
}

function EmptyPendingState() {
  return (
    <div className="rounded-2xl border bg-card p-10 text-center shadow-sm">
      <p className="mx-auto max-w-sm text-base font-medium">No pending requests.</p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
        When an aspirant sends you a chat request, it will appear here for you to accept or decline.
      </p>
    </div>
  )
}

function EmptySentState() {
  return (
    <div className="rounded-2xl border bg-card p-10 text-center shadow-sm">
      <p className="mx-auto max-w-sm text-base font-medium">
        You have not sent any requests yet.
      </p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
        Find a mentor and send a 160-character intro to get started.
      </p>
      <Link
        href="/mentors"
        className="mt-6 inline-block rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        Browse mentors
      </Link>
    </div>
  )
}

function EmptyArchivedState() {
  return (
    <div className="rounded-2xl border bg-card p-10 text-center shadow-sm">
      <p className="mx-auto max-w-sm text-base font-medium">Nothing archived yet.</p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
        Declined or cancelled requests will appear here.
      </p>
    </div>
  )
}

// ---- Confirm modal ----

function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
}: {
  message: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-xl border bg-background p-6 shadow-xl">
        <p className="text-sm text-foreground">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:opacity-90"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}

// ---- Sub-panels ----

function AllTab({ convs }: { convs: ConversationSummary[] }) {
  if (convs.length === 0) return <EmptyAllState />
  return (
    <ul className="divide-y rounded-lg border bg-card">
      {convs.map((c) => (
        <li key={c.id}>
          <Link
            href={`/chat/${c.id}`}
            className="flex items-start gap-3 p-4 hover:bg-accent/50"
          >
            <LetterAvatar
              letter={c.counterpart.avatarLetter}
              color={c.counterpart.avatarColor}
              hasPurpleTick={c.counterpart.hasPurpleTick}
            />
            <div className="min-w-0 flex-1">
              <div className="flex justify-between">
                <span className="font-medium">{c.counterpart.displayHandle}</span>
                <span className="text-xs text-muted-foreground">
                  {c.lastMessageAt ? formatTime(c.lastMessageAt) : ''}
                </span>
              </div>
              <p className="truncate text-sm text-muted-foreground">
                {c.lastMessage?.body ?? 'No messages yet'}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}

function PendingTab({
  requests,
  onAction,
}: {
  requests: ChatRequest[]
  onAction: () => void
}) {
  const [confirming, setConfirming] = useState<{ id: string; action: 'decline' } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  if (requests.length === 0) return <EmptyPendingState />

  async function handleAccept(id: string) {
    setBusy(id)
    try {
      await getApiClient().chatRequests.accept(id)
      onAction()
    } finally {
      setBusy(null)
    }
  }

  async function handleDecline(id: string) {
    setBusy(id)
    try {
      await getApiClient().chatRequests.decline(id)
      onAction()
    } finally {
      setBusy(null)
      setConfirming(null)
    }
  }

  return (
    <>
      {confirming && (
        <ConfirmDialog
          message="Decline this chat request? The aspirant will not be notified."
          onConfirm={() => handleDecline(confirming.id)}
          onCancel={() => setConfirming(null)}
        />
      )}
      <ul className="divide-y rounded-lg border bg-card">
        {requests.map((r) => (
          <li key={r.id} className="flex items-start gap-3 p-4">
            <LetterAvatar
              letter={r.counterpart.avatarLetter}
              color={r.counterpart.avatarColor}
              hasPurpleTick={r.counterpart.hasPurpleTick}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="font-medium">{r.counterpart.displayHandle}</span>
                <span className="text-xs text-muted-foreground">{formatTime(r.createdAt)}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{r.intro}</p>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => handleAccept(r.id)}
                  disabled={busy === r.id}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  Accept
                </button>
                <button
                  onClick={() => setConfirming({ id: r.id, action: 'decline' })}
                  disabled={busy === r.id}
                  className="rounded-md border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-50"
                >
                  Decline
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}

function SentTab({
  requests,
  onAction,
}: {
  requests: ChatRequest[]
  onAction: () => void
}) {
  const [confirming, setConfirming] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  if (requests.length === 0) return <EmptySentState />

  async function handleCancel(id: string) {
    setBusy(id)
    try {
      await getApiClient().chatRequests.archive(id)
      onAction()
    } finally {
      setBusy(null)
      setConfirming(null)
    }
  }

  return (
    <>
      {confirming && (
        <ConfirmDialog
          message="Cancel this chat request? It will be moved to archived."
          onConfirm={() => handleCancel(confirming)}
          onCancel={() => setConfirming(null)}
        />
      )}
      <ul className="divide-y rounded-lg border bg-card">
        {requests.map((r) => (
          <li key={r.id} className="flex items-start gap-3 p-4">
            <LetterAvatar
              letter={r.counterpart.avatarLetter}
              color={r.counterpart.avatarColor}
              hasPurpleTick={r.counterpart.hasPurpleTick}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="font-medium">{r.counterpart.displayHandle}</span>
                <span className="text-xs text-muted-foreground">{formatTime(r.createdAt)}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{r.intro}</p>
              <div className="mt-2">
                <button
                  onClick={() => setConfirming(r.id)}
                  disabled={busy === r.id}
                  className="rounded-md border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-50"
                >
                  Cancel request
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}

function ArchivedTab({
  requests,
  onAction,
}: {
  requests: ChatRequest[]
  onAction: () => void
}) {
  const [busy, setBusy] = useState<string | null>(null)

  if (requests.length === 0) return <EmptyArchivedState />

  async function handleUnarchive(id: string) {
    // Unarchive is a placeholder for MVP — the backend has no reverse-archive endpoint.
    setBusy(id)
    try {
      await Promise.resolve()
      onAction()
    } finally {
      setBusy(null)
    }
  }

  return (
    <ul className="divide-y rounded-lg border bg-card">
      {requests.map((r) => (
        <li key={r.id} className="flex items-start gap-3 p-4 opacity-80">
          <LetterAvatar
            letter={r.counterpart.avatarLetter}
            color={r.counterpart.avatarColor}
            hasPurpleTick={r.counterpart.hasPurpleTick}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span className="font-medium">{r.counterpart.displayHandle}</span>
              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {r.status}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{r.intro}</p>
            {r.status === 'ARCHIVED' && (
              <div className="mt-2">
                <button
                  onClick={() => handleUnarchive(r.id)}
                  disabled={busy === r.id}
                  className="rounded-md border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-50"
                >
                  Unarchive
                </button>
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}

// ---- Main page ----

export default function ChatListPage() {
  const [convs, setConvs] = useState<ConversationSummary[] | null>(null)
  const [requests, setRequests] = useState<ChatRequest[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('all')

  const load = useCallback(() => {
    let mounted = true
    setError(null)

    Promise.all([
      getApiClient().chat.listConversations(),
      getApiClient().chatRequests.list(),
    ])
      .then(([c, r]) => {
        if (!mounted) return
        setConvs(c)
        setRequests(r)
      })
      .catch((err: unknown) => {
        if (mounted) setError(err instanceof Error ? err.message : 'Failed to load')
      })

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    const cleanup = load()
    return cleanup
  }, [load])

  if (error) return <p className="text-sm text-red-600">{error}</p>

  if (!convs || !requests) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-32 animate-pulse rounded bg-slate-200" aria-hidden="true" />
        <div className="h-10 w-full animate-pulse rounded-t border-b bg-slate-100" aria-hidden="true" />
        <ul className="divide-y rounded-lg border bg-card">
          {Array.from({ length: 6 }).map((_, i) => (
            <ChatConversationSkeleton key={i} />
          ))}
        </ul>
      </div>
    )
  }

  const pendingRequests = requests.filter((r) => r.status === 'PENDING')
  const sentRequests = requests.filter((r) => r.status === 'PENDING')
  const archivedRequests = requests.filter(
    (r) => r.status === 'ARCHIVED' || r.status === 'DECLINED',
  )

  const TABS: { id: Tab; label: string; Icon: React.ElementType; count?: number }[] = [
    { id: 'all', label: 'All', Icon: Inbox, count: convs.length },
    { id: 'pending', label: 'Pending', Icon: Clock, count: pendingRequests.length },
    { id: 'sent', label: 'Sent', Icon: Send, count: sentRequests.length },
    { id: 'archived', label: 'Archived', Icon: Archive, count: archivedRequests.length },
  ]

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Chats</h1>

      {/* Tab bar — sticky within the scrolling main area */}
      <div className="sticky top-0 z-10 -mx-1 flex gap-1 border-b bg-background pb-0 pt-0">
        {TABS.map(({ id, label, Icon, count }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={[
              'relative flex items-center gap-1.5 rounded-t px-4 py-2.5 text-sm font-medium transition-colors',
              tab === id
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            <Icon size={15} strokeWidth={tab === id ? 2.5 : 2} />
            {label}
            {count !== undefined && count > 0 && (
              <span
                className={[
                  'ml-0.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                  tab === id ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                ].join(' ')}
              >
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {tab === 'all' && <AllTab convs={convs} />}
        {tab === 'pending' && <PendingTab requests={pendingRequests} onAction={load} />}
        {tab === 'sent' && <SentTab requests={sentRequests} onAction={load} />}
        {tab === 'archived' && <ArchivedTab requests={archivedRequests} onAction={load} />}
      </div>
    </div>
  )
}
