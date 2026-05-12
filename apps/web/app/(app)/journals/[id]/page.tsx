'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { MessageSquare } from 'lucide-react'
import type { AvatarColor, AvatarLetter } from '@mento/types'
import { getApiClient } from '@/lib/api'
import { LetterAvatar } from '@/components/LetterAvatar'
import { relativeTime } from '@/components/journals/relative-time'

// ─── Types ───────────────────────────────────────────────────────────────────

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
  /** Present on shared journals */
  counterpart?: {
    displayHandle: string
    avatarLetter: AvatarLetter
    avatarColor: AvatarColor
  }
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function JournalPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const [journal, setJournal] = useState<JournalDetail | null>(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

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
      setLastSaved(new Date())
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  if (error) return <p className="text-sm text-red-600">{error}</p>
  if (!journal) return <p className="text-sm text-muted-foreground">Loading…</p>

  const categoryLabel = prettyCategory(journal.category)
  const sectionLabel = getSectionLabel(journal.category)

  return (
    <div className="mx-auto max-w-2xl space-y-6">

      {/* ── Breadcrumb ─────────────────────────────────────────────────── */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <button
          onClick={() => router.push('/journals')}
          className="hover:text-foreground hover:underline"
        >
          Journals
        </button>
        {sectionLabel && (
          <>
            <span aria-hidden="true">›</span>
            <span className="text-muted-foreground/60">{sectionLabel}</span>
          </>
        )}
        <span aria-hidden="true">›</span>
        <span className="font-medium text-foreground">{categoryLabel}</span>
      </nav>

      {/* ── Title + shared status badge ────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{categoryLabel}</h1>
        {journal.isShared && (
          <span
            className={[
              'shrink-0 rounded-full px-3 py-1 text-xs font-medium',
              journal.isLocked
                ? 'bg-gray-100 text-gray-600'
                : journal.canEdit
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-amber-50 text-amber-800',
            ].join(' ')}
          >
            {journal.isLocked
              ? 'Locked'
              : journal.canEdit
                ? 'Active — both online'
                : 'Read-only — only one of you is here'}
          </span>
        )}
      </div>

      {/* ── Lock / read-only banners ───────────────────────────────────── */}
      {journal.isShared && journal.isLocked && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
          <span aria-label="Locked" className="mr-1.5">🔒</span>
          This journal is locked. Your shared history with{' '}
          <strong>{journal.counterpart?.displayHandle ?? 'your mentor'}</strong> is preserved here.
        </div>
      )}

      {journal.isShared && !journal.isLocked && !journal.canEdit && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Both of you must be active in the chat to write here. Currently read-only.
        </div>
      )}

      {/* ── Editor ─────────────────────────────────────────────────────── */}
      {journal.canEdit && (
        <div className="rounded-2xl border bg-card p-4">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write a reflection…"
            className="h-24 w-full resize-y rounded-md border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="mt-2 flex items-center justify-between">
            {lastSaved ? (
              <span className="text-xs text-muted-foreground">
                Last saved {relativeTime(lastSaved.toISOString())}
              </span>
            ) : (
              <span />
            )}
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

      {/* ── Entry list ─────────────────────────────────────────────────── */}
      <ul className="space-y-3">
        {journal.entries.length === 0 ? (
          <EmptyState canEdit={journal.canEdit} isShared={journal.isShared} />
        ) : (
          journal.entries.map((e) => {
            const isSavedChat = e.type === 'SAVED_CHAT'
            return (
              <li
                key={e.id}
                className={[
                  'rounded-2xl border bg-card p-4',
                  isSavedChat
                    ? 'border-l-4 border-l-blue-400 pl-4'
                    : 'border-l-2 border-l-blue-100 pl-4',
                ].join(' ')}
              >
                {/* Entry header */}
                <div className="mb-2 flex items-center gap-2">
                  <LetterAvatar
                    letter={e.author.avatarLetter}
                    color={e.author.avatarColor}
                    size={24}
                  />
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    {e.author.displayHandle} · {formatDate(e.createdAt)}
                  </span>
                  {isSavedChat && (
                    <span className="ml-auto flex items-center gap-1 text-[10px] text-blue-600">
                      <MessageSquare size={10} strokeWidth={2} />
                      From chat
                    </span>
                  )}
                </div>
                <p className="whitespace-pre-wrap text-sm">{e.content}</p>
              </li>
            )
          })
        )}
      </ul>
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function EmptyState({ canEdit, isShared }: { canEdit: boolean; isShared: boolean }) {
  return (
    <li className="rounded-2xl border border-dashed bg-muted/20 p-6 text-sm text-muted-foreground">
      {canEdit ? (
        <>
          <p className="font-medium text-foreground/70">Your first reflection in this category.</p>
          <p className="mt-1">
            There's no template. Write what you can't say out loud.
          </p>
        </>
      ) : isShared ? (
        <p>Waiting for both of you to be active.</p>
      ) : (
        <p>No entries yet.</p>
      )}
    </li>
  )
}

function prettyCategory(c: string): string {
  return c
    .replace(/^PRELIMS_/, '')
    .replace(/^MAINS_/, '')
    .replace(/^SHARED_WITH_MENTOR/, 'Shared journal')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (ch) => ch.toUpperCase())
}

function getSectionLabel(c: string): string | null {
  if (c.startsWith('PRELIMS_')) return 'Prelims'
  if (c.startsWith('MAINS_')) return 'Mains'
  if (c === 'INTERVIEW') return 'Interview'
  if (c === 'PERSONAL') return 'Personal'
  return null
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
