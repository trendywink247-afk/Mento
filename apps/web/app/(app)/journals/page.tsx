'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getApiClient } from '@/lib/api'
import { LetterAvatar } from '@/components/LetterAvatar'

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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Journals</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Reflect privately, or together with a mentor.
        </p>
      </div>

      {sharedJournals.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Shared with mentors</h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {sharedJournals.map((j) => (
              <li key={j.id}>
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
              </li>
            ))}
          </ul>
        </section>
      )}

      {CATEGORIES.map((group) => (
        <section key={group.label}>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">{group.label}</h2>
          <div className="grid gap-2 md:grid-cols-3">
            {group.items.map((it) => {
              const exists = existing.find((j) => j.category === it.key && !j.isShared)
              return (
                <button
                  key={it.key}
                  disabled={busy}
                  onClick={() => open(it.key)}
                  className="rounded-xl border bg-card p-4 text-left transition-colors hover:bg-accent disabled:opacity-50"
                >
                  <p className="text-sm font-medium">{it.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {exists ? `${exists.entryCount} entries` : 'Start your first entry'}
                  </p>
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
