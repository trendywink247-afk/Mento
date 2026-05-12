'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Inbox, Clock, Send, Archive } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { ConversationSummary, AvatarLetter, AvatarColor } from '@mento/types'
import { getApiClient } from '@/lib/api'
import { LetterAvatar } from '@/components/LetterAvatar'
import { ChatConversationSkeleton } from '@/components/skeletons/ChatConversationSkeleton'
import { EmptyChat } from '@/components/illustrations/EmptyChat'
import { MotionFade, MotionTap } from '@/components/motion'

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
  const t = useTranslations('chat')
  return (
    <MotionFade>
      <div className="rounded-2xl border bg-card p-10 text-center shadow-sm">
        <EmptyChat className="mx-auto mb-4 h-36 w-auto" />
        <p className="mx-auto max-w-sm text-base font-medium">{t('emptyAll.heading')}</p>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          {t('emptyAll.body')}
        </p>
        <MotionTap className="mt-6 inline-block">
          <Link
            href="/mentors"
            className="inline-block rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Browse mentors
          </Link>
        </MotionTap>
      </div>
    </MotionFade>
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
  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      aria-hidden="false"
      onClick={(e) => {
        // Close when clicking the backdrop
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-msg"
        className="w-full max-w-sm rounded-xl border bg-background p-6 shadow-xl"
      >
        <p id="confirm-dialog-msg" className="text-sm text-foreground">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Cancel
          </button>
          <button
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            onClick={onConfirm}
            className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2"
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
  const t = useTranslations('chat')
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
                {c.lastMessage?.body ?? t('noMessages')}
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
  const t = useTranslations('chat')
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
    { id: 'all', label: t('tabs.all'), Icon: Inbox, count: convs.length },
    { id: 'pending', label: t('tabs.pending'), Icon: Clock, count: pendingRequests.length },
    { id: 'sent', label: t('tabs.sent'), Icon: Send, count: sentRequests.length },
    { id: 'archived', label: t('tabs.archived'), Icon: Archive, count: archivedRequests.length },
  ]

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>

      {/* Tab bar — sticky within the scrolling main area */}
      <div
        role="tablist"
        aria-label="Chat sections"
        className="sticky top-0 z-10 -mx-1 flex gap-1 border-b bg-background pb-0 pt-0"
      >
        {TABS.map(({ id, label, Icon, count }) => (
          <button
            key={id}
            role="tab"
            id={`tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`tabpanel-${id}`}
            onClick={() => setTab(id)}
            className={[
              'relative flex items-center gap-1.5 rounded-t px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2',
              tab === id
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            <Icon size={15} strokeWidth={tab === id ? 2.5 : 2} />
            {label}
            {count !== undefined && count > 0 && (
              <span
                aria-label={`${count} items`}
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
      <div
        role="tabpanel"
        id={`tabpanel-${tab}`}
        aria-labelledby={`tab-${tab}`}
      >
        {tab === 'all' && <AllTab convs={convs} />}
        {tab === 'pending' && <PendingTab requests={pendingRequests} onAction={load} />}
        {tab === 'sent' && <SentTab requests={sentRequests} onAction={load} />}
        {tab === 'archived' && <ArchivedTab requests={archivedRequests} onAction={load} />}
      </div>
    </div>
  )
}
