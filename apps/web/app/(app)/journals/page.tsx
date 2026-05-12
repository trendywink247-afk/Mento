'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getApiClient } from '@/lib/api'
import { LetterAvatar } from '@/components/LetterAvatar'
import { CategoryIconBadge } from '@/components/journals/category-icons'
import { relativeTime } from '@/components/journals/relative-time'

// ─── Category definitions ────────────────────────────────────────────────────

const CATEGORIES = [
  {
    label: 'Personal',
    items: [{ key: 'PERSONAL', name: 'Personal journal' }],
  },
  {
    label: 'Prelims',
    items: [
      { key: 'PRELIMS_POLITY', name: 'Polity' },
      { key: 'PRELIMS_HISTORY', name: 'History' },
      { key: 'PRELIMS_GEOGRAPHY', name: 'Geography' },
      { key: 'PRELIMS_ECONOMY', name: 'Economy' },
      { key: 'PRELIMS_ENVIRONMENT', name: 'Environment' },
      { key: 'PRELIMS_SCI_TECH', name: 'Sci-Tech' },
      { key: 'PRELIMS_CSAT', name: 'CSAT' },
      { key: 'PRELIMS_CURRENT_AFFAIRS', name: 'Current affairs' },
    ],
  },
  {
    label: 'Mains',
    items: [
      { key: 'MAINS_GS1', name: 'GS 1' },
      { key: 'MAINS_GS2', name: 'GS 2' },
      { key: 'MAINS_GS3', name: 'GS 3' },
      { key: 'MAINS_GS4', name: 'GS 4' },
      { key: 'MAINS_ESSAY', name: 'Essay' },
      { key: 'MAINS_OPTIONAL', name: 'Optional' },
    ],
  },
  {
    label: 'Interview',
    items: [{ key: 'INTERVIEW', name: 'Interview' }],
  },
] as const

// ─── Types ───────────────────────────────────────────────────────────────────

type ExistingJournal = {
  id: string
  category: string
  title: string | null
  isShared: boolean
  isLocked: boolean
  conversationId: string | null
  entryCount: number
  updatedAt: string
  sharedWith: {
    id: string
    displayHandle: string
    avatarLetter: 'B' | 'A' | 'P' | 'M' | 'I' | 'F'
    avatarColor: 'SLATE' | 'AMBER' | 'SKY' | 'FOREST' | 'PURPLE' | 'GOLD'
  } | null
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function JournalsPage() {
  const [existing, setExisting] = useState<ExistingJournal[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getApiClient().journals.list().then(setExisting).catch(() => {})
  }, [])

  async function open(category: string) {
    setBusy(true)
    try {
      const j = await getApiClient().journals.upsert(category)
      window.location.href = `/journals/${j.id}`
    } finally {
      setBusy(false)
    }
  }

  const sharedJournals = existing.filter((j) => j.isShared)

  return (
    <div className="space-y-10">
      {/* ── Page header ───────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Journals</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Where you write down what you can't tell anyone else.{' '}
          <span className="italic">
            Some pages stay with you. Others, you and your mentor write together.
          </span>
        </p>
      </div>

      {/* ── Shared with mentors ───────────────────────────────────────── */}
      {sharedJournals.length > 0 && (
        <section>
          <SectionHeader label="Shared with mentors" count={sharedJournals.length} />
          <ul className="mt-3 grid gap-3 md:grid-cols-2">
            {sharedJournals.map((j) => (
              <li key={j.id}>
                <Link
                  href={`/journals/${j.id}`}
                  className="flex items-center gap-3 rounded-2xl border bg-card p-4 transition-shadow hover:shadow-md"
                >
                  <CategoryIconBadge category="SHARED_WITH_MENTOR" size={32} />
                  {j.sharedWith && (
                    <LetterAvatar
                      letter={j.sharedWith.avatarLetter}
                      color={j.sharedWith.avatarColor}
                      size={32}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      With {j.sharedWith?.displayHandle ?? '—'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {j.entryCount} {j.entryCount === 1 ? 'entry' : 'entries'} ·{' '}
                      {j.isLocked ? 'Locked' : 'Active'}
                      {j.entryCount > 0 && ` · ${relativeTime(j.updatedAt)}`}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Category groups ───────────────────────────────────────────── */}
      {CATEGORIES.map((group) => {
        const activeCount = group.items.filter((it) =>
          existing.some((j) => j.category === it.key && !j.isShared && j.entryCount > 0),
        ).length

        return (
          <section key={group.label}>
            <SectionHeader label={group.label} count={group.items.length} activeCount={activeCount} />

            {/* Personal gets a special hero card */}
            {group.label === 'Personal' ? (
              <PersonalCard
                item={group.items[0]}
                exists={existing.find((j) => j.category === group.items[0].key && !j.isShared)}
                busy={busy}
                onOpen={open}
              />
            ) : (
              <div className="mt-3 grid gap-2 md:grid-cols-3">
                {group.items.map((it) => {
                  const exists = existing.find((j) => j.category === it.key && !j.isShared)
                  const isEmpty = !exists || exists.entryCount === 0
                  return (
                    <CategoryCard
                      key={it.key}
                      item={it}
                      exists={exists}
                      isEmpty={isEmpty}
                      busy={busy}
                      onOpen={open}
                    />
                  )
                })}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({
  label,
  count,
  activeCount,
}: {
  label: string
  count: number
  activeCount?: number
}) {
  return (
    <div className="flex items-baseline gap-2 border-b border-border/60 pb-1.5">
      <h2 className="text-base font-semibold tracking-tight">
        {label}{' '}
        <span className="text-sm font-normal text-muted-foreground">({count})</span>
      </h2>
      {activeCount !== undefined && activeCount > 0 && (
        <span className="ml-auto text-xs text-muted-foreground">{activeCount} active</span>
      )}
    </div>
  )
}

type CategoryItem = { key: string; name: string }

function CategoryCard({
  item,
  exists,
  isEmpty,
  busy,
  onOpen,
}: {
  item: CategoryItem
  exists: ExistingJournal | undefined
  isEmpty: boolean
  busy: boolean
  onOpen: (key: string) => void
}) {
  return (
    <button
      disabled={busy}
      onClick={() => onOpen(item.key)}
      className={[
        'group rounded-xl border p-4 text-left transition-shadow hover:shadow-md disabled:pointer-events-none disabled:opacity-50',
        isEmpty
          ? 'border-dashed bg-card opacity-70'
          : 'border-border bg-card',
      ].join(' ')}
    >
      <div className="mb-3 flex items-center gap-2.5">
        <CategoryIconBadge category={item.key} size={32} />
        <p className="text-sm font-medium leading-tight">{item.name}</p>
      </div>
      <p className="text-xs text-muted-foreground">
        {exists && exists.entryCount > 0
          ? `${exists.entryCount} ${exists.entryCount === 1 ? 'entry' : 'entries'}`
          : 'Start your first entry'}
      </p>
      {exists && exists.entryCount > 0 && (
        <p className="mt-0.5 text-[11px] text-muted-foreground/70">
          Last updated {relativeTime(exists.updatedAt)}
        </p>
      )}
    </button>
  )
}

function PersonalCard({
  item,
  exists,
  busy,
  onOpen,
}: {
  item: CategoryItem
  exists: ExistingJournal | undefined
  busy: boolean
  onOpen: (key: string) => void
}) {
  const isEmpty = !exists || exists.entryCount === 0

  return (
    <button
      disabled={busy}
      onClick={() => onOpen(item.key)}
      className="mt-3 w-full rounded-2xl border bg-gradient-to-br from-blue-50 to-white p-6 text-left transition-shadow hover:shadow-md disabled:pointer-events-none disabled:opacity-50 md:col-span-3"
    >
      <div className="flex items-start gap-4">
        <CategoryIconBadge category={item.key} size={40} />
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold">Personal journal</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {isEmpty
              ? 'Start your first entry'
              : `${exists.entryCount} ${exists.entryCount === 1 ? 'entry' : 'entries'}`}
            {exists && exists.entryCount > 0 && (
              <span className="ml-2 text-xs">· Last updated {relativeTime(exists.updatedAt)}</span>
            )}
          </p>
          <p className="mt-3 text-xs italic text-muted-foreground/80">
            "Some pages stay with you. Others, you and your mentor write together."
          </p>
        </div>
      </div>
    </button>
  )
}
