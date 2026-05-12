'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getApiClient } from '@/lib/api'
import { LetterAvatar } from '@/components/LetterAvatar'
import { MotionFade, MotionStagger, MotionStaggerItem, MotionTap } from '@/components/motion'
import { CategoryIconBadge } from '@/components/journals/category-icons'
import { relativeTime } from '@/components/journals/relative-time'

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
      { key: 'MAINS_GS1', name: 'GS1' },
      { key: 'MAINS_GS2', name: 'GS2' },
      { key: 'MAINS_GS3', name: 'GS3' },
      { key: 'MAINS_GS4', name: 'GS4' },
      { key: 'MAINS_ESSAY', name: 'Essay' },
      { key: 'MAINS_OPTIONAL', name: 'Optional' },
    ],
  },
  {
    label: 'Interview',
    items: [{ key: 'INTERVIEW', name: 'Interview' }],
  },
] as const

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
    <div className="space-y-8">
      <MotionFade>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Journals</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Reflect privately, or together with a mentor.
          </p>
        </div>
      </MotionFade>

      {sharedJournals.length > 0 && (
        <MotionFade delay={0.06}>
          <section>
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">Shared with mentors</h2>
            <MotionStagger staggerDelay={0.06} className="grid gap-3 md:grid-cols-2">
              {sharedJournals.map((j) => (
                <MotionStaggerItem key={j.id}>
                  <MotionTap>
                    <Link
                      href={`/journals/${j.id}`}
                      className="flex items-center gap-3 rounded-2xl border bg-card p-4 hover:bg-accent/50"
                    >
                      {j.sharedWith && (
                        <LetterAvatar
                          letter={j.sharedWith.avatarLetter}
                          color={j.sharedWith.avatarColor}
                          size={40}
                        />
                      )}
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          With {j.sharedWith?.displayHandle ?? '—'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {j.entryCount} entries · {j.isLocked ? 'Locked' : 'Active'}
                        </p>
                      </div>
                    </Link>
                  </MotionTap>
                </MotionStaggerItem>
              ))}
            </MotionStagger>
          </section>
        </MotionFade>
      )}

      {CATEGORIES.map((group, groupIdx) => {
        const activeInGroup = group.items.filter(
          (it) => existing.find((j) => j.category === it.key && !j.isShared && j.entryCount > 0),
        ).length
        return (
          <MotionFade key={group.label} delay={0.05 * (groupIdx + 1)}>
            <section>
              <div className="mb-3 flex items-baseline justify-between border-b pb-2">
                <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                  {group.label} <span className="text-foreground/70">({group.items.length})</span>
                </h2>
                {activeInGroup > 0 && (
                  <span className="text-xs text-muted-foreground">{activeInGroup} active</span>
                )}
              </div>
              <MotionStagger staggerDelay={0.04} className="grid gap-2 md:grid-cols-3">
                {group.items.map((it) => {
                  const exists = existing.find((j) => j.category === it.key && !j.isShared)
                  const hasEntries = exists && exists.entryCount > 0
                  return (
                    <MotionStaggerItem key={it.key}>
                      <MotionTap disabled={busy}>
                        <button
                          disabled={busy}
                          onClick={() => open(it.key)}
                          className={`flex w-full items-start gap-3 rounded-xl border bg-card p-4 text-left transition-all hover:border-input hover:shadow-card disabled:opacity-50 ${
                            !hasEntries ? 'border-dashed opacity-80' : ''
                          }`}
                        >
                          <CategoryIconBadge category={it.key} size={32} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">{it.name}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {exists
                                ? `${exists.entryCount} ${exists.entryCount === 1 ? 'entry' : 'entries'}`
                                : 'Start your first entry'}
                            </p>
                            {hasEntries && exists && (
                              <p className="mt-0.5 text-[11px] text-muted-foreground/80">
                                Updated {relativeTime(exists.updatedAt)}
                              </p>
                            )}
                          </div>
                        </button>
                      </MotionTap>
                    </MotionStaggerItem>
                  )
                })}
              </MotionStagger>
            </section>
          </MotionFade>
        )
      })}
    </div>
  )
}
