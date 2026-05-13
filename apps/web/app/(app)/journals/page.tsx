'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { getApiClient } from '@/lib/api'
import { LetterAvatar } from '@/components/LetterAvatar'
import { MotionFade, MotionStagger, MotionStaggerItem, MotionTap } from '@/components/motion'
import { CategoryIconBadge } from '@/components/journals/category-icons'
import { relativeTime } from '@/components/journals/relative-time'
import { capture } from '@/lib/analytics'
import { ANALYTICS_EVENTS } from '@/lib/events'

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
  const t = useTranslations('journals')
  const [existing, setExisting] = useState<ExistingJournal[]>([])
  const [busy, setBusy] = useState(false)

  const CATEGORIES = [
    {
      label: t('categories.personal'),
      items: [{ key: 'PERSONAL', name: t('categories.personalJournal') }],
    },
    {
      label: t('categories.prelims'),
      items: [
        { key: 'PRELIMS_POLITY', name: t('categories.polity') },
        { key: 'PRELIMS_HISTORY', name: t('categories.history') },
        { key: 'PRELIMS_GEOGRAPHY', name: t('categories.geography') },
        { key: 'PRELIMS_ECONOMY', name: t('categories.economy') },
        { key: 'PRELIMS_ENVIRONMENT', name: t('categories.environment') },
        { key: 'PRELIMS_SCI_TECH', name: t('categories.sciTech') },
        { key: 'PRELIMS_CSAT', name: t('categories.csat') },
        { key: 'PRELIMS_CURRENT_AFFAIRS', name: t('categories.currentAffairs') },
      ],
    },
    {
      label: t('categories.mains'),
      items: [
        { key: 'MAINS_GS1', name: t('categories.gs1') },
        { key: 'MAINS_GS2', name: t('categories.gs2') },
        { key: 'MAINS_GS3', name: t('categories.gs3') },
        { key: 'MAINS_GS4', name: t('categories.gs4') },
        { key: 'MAINS_ESSAY', name: t('categories.essay') },
        { key: 'MAINS_OPTIONAL', name: t('categories.optional') },
      ],
    },
    {
      label: t('categories.interview'),
      items: [{ key: 'INTERVIEW', name: t('categories.interviewJournal') }],
    },
  ]

  useEffect(() => {
    capture(ANALYTICS_EVENTS.JOURNAL_LIST_VIEWED)
    getApiClient().journals.list().then(setExisting).catch(() => {})
  }, [])

  async function open(category: string) {
    capture(ANALYTICS_EVENTS.JOURNAL_OPENED, { category })
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
          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('subtitle')}
          </p>
        </div>
      </MotionFade>

      {sharedJournals.length > 0 && (
        <MotionFade delay={0.06}>
          <section>
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">{t('sharedWithMentors')}</h2>
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
                          {t('sharedWith', { handle: j.sharedWith?.displayHandle ?? '—' })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t('entriesCount', { count: j.entryCount })} · {j.isLocked ? t('lockedLabel') : t('activeStatusLabel')}
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
                  <span className="text-xs text-muted-foreground">{t('activeLabel', { count: activeInGroup })}</span>
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
                                ? t('entriesCount', { count: exists.entryCount })
                                : t('startFirstEntry')}
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
