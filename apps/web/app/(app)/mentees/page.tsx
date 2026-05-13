'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MessageSquare, BookOpen, Search, ArrowUpDown, Users } from 'lucide-react'
import { getApiClient } from '@/lib/api'
import { useAuthStore } from '@/lib/auth-store'
import { LetterAvatar } from '@/components/LetterAvatar'
import { MENTEES_COPY } from '@/lib/copy'

type SortKey = 'recent' | 'oldest'

interface MenteeRow {
  conversationId: string
  lastMessageAt: string
  unreadCount: number
  sharedJournalId: string | null
  aspirant: {
    id: string
    displayHandle: string
    avatarLetter: string
    avatarColor: string
    hasPurpleTick: boolean
  }
  lastMessage: {
    id: string
    body: string | null
    senderId: string
    createdAt: string
  } | null
}

function RelativeTime({ iso }: { iso: string }) {
  const date = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  let label: string
  if (diffMin < 1) label = 'just now'
  else if (diffMin < 60) label = `${diffMin}m ago`
  else if (diffHr < 24) label = `${diffHr}h ago`
  else if (diffDay < 7) label = `${diffDay}d ago`
  else label = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

  return <span className="text-xs text-muted-foreground">{label}</span>
}

function MenteeSkeleton() {
  return (
    <div className="flex animate-pulse items-center gap-4 rounded-xl border bg-background p-4">
      <div className="h-10 w-10 rounded-full bg-muted" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-32 rounded bg-muted" />
        <div className="h-3 w-48 rounded bg-muted" />
      </div>
      <div className="flex gap-2">
        <div className="h-8 w-8 rounded-md bg-muted" />
        <div className="h-8 w-8 rounded-md bg-muted" />
      </div>
    </div>
  )
}

function EmptyMentees() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
        <Users size={36} className="text-muted-foreground" />
      </div>
      <div>
        <p className="text-base font-semibold text-foreground">No mentees yet</p>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">
          {MENTEES_COPY.myMenteesEmpty}
        </p>
      </div>
    </div>
  )
}

export default function MyMenteesPage() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const hasHydrated = useAuthStore((s) => s.hasHydrated)

  const [rows, setRows] = useState<MenteeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('recent')

  // Guard: non-mentors get redirected.
  useEffect(() => {
    if (!hasHydrated) return
    if (user && user.role !== 'MENTOR') {
      router.replace('/dashboard')
    }
  }, [hasHydrated, user, router])

  useEffect(() => {
    if (!hasHydrated || !user || user.role !== 'MENTOR') return
    setLoading(true)
    getApiClient()
      .mentors.listMentees()
      .then((data) => setRows(data as MenteeRow[]))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [hasHydrated, user])

  const filtered = useMemo(() => {
    let result = rows.filter((r) =>
      r.aspirant.displayHandle.toLowerCase().includes(search.toLowerCase()),
    )
    if (sort === 'oldest') {
      result = [...result].sort(
        (a, b) => new Date(a.lastMessageAt).getTime() - new Date(b.lastMessageAt).getTime(),
      )
    }
    // default 'recent' is already sorted desc from API
    return result
  }, [rows, search, sort])

  if (!hasHydrated) return null
  if (user?.role !== 'MENTOR') return null

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">My mentees</h1>
        {!loading && (
          <span className="flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-primary/15 px-2 text-xs font-semibold text-primary">
            {rows.length}
          </span>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by handle…"
            className="w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <button
          onClick={() => setSort((s) => (s === 'recent' ? 'oldest' : 'recent'))}
          className="flex items-center gap-1.5 rounded-md border bg-background px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <ArrowUpDown size={13} />
          {sort === 'recent' ? 'Recent first' : 'Oldest first'}
        </button>
      </div>

      {/* List */}
      <div className="space-y-2">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <MenteeSkeleton key={i} />)
        ) : filtered.length === 0 ? (
          <EmptyMentees />
        ) : (
          filtered.map((row) => (
            <div
              key={row.conversationId}
              className="group flex items-center gap-4 rounded-xl border bg-background p-4 transition-colors hover:bg-accent/40"
            >
              {/* Avatar */}
              <LetterAvatar
                letter={row.aspirant.avatarLetter as never}
                color={row.aspirant.avatarColor as never}
                hasPurpleTick={row.aspirant.hasPurpleTick}
                size={40}
              />

              {/* Info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold text-foreground">
                    {row.aspirant.displayHandle}
                  </span>
                  {row.unreadCount > 0 && (
                    <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                      {row.unreadCount}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {row.lastMessage?.body
                    ? row.lastMessage.body.slice(0, 60)
                    : 'No messages yet'}
                </p>
              </div>

              {/* Timestamp */}
              <div className="hidden shrink-0 sm:block">
                <RelativeTime iso={row.lastMessageAt} />
              </div>

              {/* CTAs */}
              <div className="flex shrink-0 items-center gap-1">
                <Link
                  href={`/chat/${row.conversationId}`}
                  title="Open chat"
                  className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-primary/10 hover:text-primary"
                >
                  <MessageSquare size={16} />
                </Link>
                {row.sharedJournalId ? (
                  <Link
                    href={`/journals/${row.sharedJournalId}`}
                    title="Open shared journal"
                    className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-primary/10 hover:text-primary"
                  >
                    <BookOpen size={16} />
                  </Link>
                ) : (
                  <span
                    title="No shared journal yet"
                    className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground/30"
                  >
                    —
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
