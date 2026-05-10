'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { AvatarColor, AvatarLetter } from '@mento/types'
import { getApiClient } from '@/lib/api'
import { LetterAvatar } from '@/components/LetterAvatar'

type JournalDetail = {
  id: string
  category: string
  title: string | null
  isShared: boolean
  isLocked: boolean
  canEdit: boolean
  entries: Array<{
    id: string
    type: string
    content: string
    sourceMessageId: string | null
    createdAt: string
    updatedAt: string
    author: {
      id: string
      displayHandle: string
      avatarLetter: AvatarLetter
      avatarColor: AvatarColor
    }
  }>
}

export default function JournalPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const [journal, setJournal] = useState<JournalDetail | null>(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!params.id) return
    try {
      const j = await getApiClient().journals.detail(String(params.id))
      setJournal(j as JournalDetail)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    }
  }, [params.id])

  useEffect(() => {
    void load()
  }, [load])

  async function add() {
    if (!journal || !draft.trim()) return
    setBusy(true)
    try {
      await getApiClient().journals.addEntry(journal.id, draft.trim())
      setDraft('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  if (error) return <p className="text-sm text-red-600">{error}</p>
  if (!journal) return <p className="text-sm text-muted-foreground">Loading…</p>

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={() => router.push('/journals')} className="text-sm text-muted-foreground hover:underline">
          ← Back
        </button>
        {journal.isShared && (
          <span
            className={`rounded-full px-2 py-0.5 text-xs ${
              journal.isLocked
                ? 'bg-gray-200 text-gray-700'
                : journal.canEdit
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-amber-100 text-amber-800'
            }`}
          >
            {journal.isLocked
              ? 'Locked'
              : journal.canEdit
                ? 'Active — both online'
                : 'Read-only — only one of you is here'}
          </span>
        )}
      </div>

      <h1 className="text-2xl font-semibold tracking-tight">
        {prettyCategory(journal.category)}
      </h1>

      {journal.canEdit && (
        <div className="rounded-2xl border bg-card p-4">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write a reflection…"
            className="h-24 w-full resize-y rounded-md border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="mt-2 flex justify-end">
            <button
              onClick={add}
              disabled={busy || !draft.trim()}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Add entry'}
            </button>
          </div>
        </div>
      )}

      <ul className="space-y-3">
        {journal.entries.length === 0 ? (
          <li className="rounded-2xl border bg-muted/20 p-6 text-sm text-muted-foreground">
            No entries yet. {journal.canEdit ? 'Start writing above.' : 'Waiting for both of you.'}
          </li>
        ) : (
          journal.entries.map((e) => (
            <li key={e.id} className="rounded-2xl border bg-card p-4">
              <div className="mb-2 flex items-center gap-2">
                <LetterAvatar
                  letter={e.author.avatarLetter}
                  color={e.author.avatarColor}
                  size={24}
                />
                <span className="text-xs text-muted-foreground">
                  {e.author.displayHandle} · {new Date(e.createdAt).toLocaleString()}
                </span>
                {e.type === 'SAVED_CHAT' && (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] text-blue-700">
                    From chat
                  </span>
                )}
              </div>
              <p className="whitespace-pre-wrap text-sm">{e.content}</p>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}

function prettyCategory(c: string) {
  return c
    .replace(/^PRELIMS_/, 'Prelims · ')
    .replace(/^MAINS_/, 'Mains · ')
    .replace(/^SHARED_WITH_MENTOR/, 'Shared with mentor')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
