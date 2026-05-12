'use client'

import { useEffect, useState, useCallback } from 'react'
import type { AvatarColor, AvatarLetter } from '@mento/types'
import { getApiClient } from '@/lib/api'
import { LetterAvatar } from '@/components/LetterAvatar'
import {
  CheckCircle2,
  XCircle,
  ShieldBan,
  ExternalLink,
  Loader2,
  RefreshCw,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types (mirror what the api-client returns)
// ---------------------------------------------------------------------------

type VerificationInfo = {
  submittedAt: string
  reviewedAt: string | null
  reviewNote: string | null
  aadhaarSignedUrl: string | null
  hallTicketSignedUrl: string | null
  marksSheetSignedUrl: string | null
  hasBankAccount: boolean
  hasMarksSheet: boolean
}

type MentorProfile = {
  journeyType: string
  prelimsCleared: boolean
  mainsAttempts: number
  interviewAttempts: number
  isVerified: boolean
}

type PendingMentor = {
  id: string
  displayHandle: string | null
  avatarLetter: AvatarLetter | null
  avatarColor: AvatarColor | null
  hasPurpleTick: boolean
  status: string
  createdAt: string
  mentorProfile: MentorProfile | null
  verification: VerificationInfo | null
}

type ActionKind = 'approve' | 'reject' | 'ban'

// ---------------------------------------------------------------------------
// Confirm dialog
// ---------------------------------------------------------------------------

function ConfirmDialog({
  kind,
  handle,
  onConfirm,
  onCancel,
}: {
  kind: ActionKind
  handle: string | null
  onConfirm: (reason?: string) => void
  onCancel: () => void
}) {
  const [reason, setReason] = useState('')
  const needsReason = kind === 'reject' || kind === 'ban'

  const titles: Record<ActionKind, string> = {
    approve: 'Approve mentor',
    reject: 'Reject verification',
    ban: 'Ban mentor permanently',
  }

  const descriptions: Record<ActionKind, string> = {
    approve:
      "This will mark the mentor as verified and set ACTIVE status. If they uploaded a marks sheet, they'll receive a purple tick.",
    reject:
      'The mentor will be suspended and can re-submit corrected documents. Their Aadhaar will NOT be added to the denylist.',
    ban: 'The mentor will be permanently banned. Their Aadhaar hash will be added to the denylist, blocking future sign-ups. This action is irreversible.',
  }

  const buttonStyles: Record<ActionKind, string> = {
    approve: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    reject: 'bg-amber-600 hover:bg-amber-700 text-white',
    ban: 'bg-red-600 hover:bg-red-700 text-white',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-sm rounded-xl border bg-background p-6 shadow-xl">
        <h2 className="text-base font-semibold">{titles[kind]}</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {handle ? (
            <>
              Target: <span className="font-mono">{handle}</span>
            </>
          ) : null}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-foreground">{descriptions[kind]}</p>

        {needsReason && (
          <div className="mt-4 space-y-1.5">
            <label className="text-xs font-medium">
              Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Explain why..."
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
        )}

        <div className="mt-5 flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-md border px-3 py-2 text-sm hover:bg-accent"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(needsReason ? reason : undefined)}
            disabled={needsReason && reason.trim().length < 5}
            className={[
              'flex-1 rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50',
              buttonStyles[kind],
            ].join(' ')}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Doc link
// ---------------------------------------------------------------------------

function DocLink({ label, url }: { label: string; url: string | null }) {
  if (!url) {
    return <span className="text-xs text-muted-foreground">{label}: —</span>
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
    >
      {label}
      <ExternalLink size={10} />
    </a>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function AdminMentorsPage() {
  const [rows, setRows] = useState<PendingMentor[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [dialog, setDialog] = useState<{
    kind: ActionKind
    mentor: PendingMentor
  } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getApiClient().admin.listPendingMentors()
      setRows(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function handleConfirm(reason?: string) {
    if (!dialog) return
    const { kind, mentor } = dialog
    setDialog(null)
    setBusy(mentor.id)

    try {
      const client = getApiClient().admin
      if (kind === 'approve') {
        await client.approveMentor(mentor.id, reason)
      } else if (kind === 'reject') {
        await client.rejectMentor(mentor.id, reason!)
      } else if (kind === 'ban') {
        await client.banMentor(mentor.id, reason!)
      }
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${kind}`)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mentor Verification Queue</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Mentors who have submitted credentials and are awaiting review.
          </p>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="mt-6 space-y-4">
        {rows === null ? (
          <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 size={14} className="animate-spin" />
            Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border bg-card py-12 text-center text-sm text-muted-foreground">
            No pending verification submissions.
          </div>
        ) : (
          rows.map((mentor) => (
            <MentorCard
              key={mentor.id}
              mentor={mentor}
              busy={busy === mentor.id}
              onAction={(kind) => setDialog({ kind, mentor })}
            />
          ))
        )}
      </div>

      {dialog && (
        <ConfirmDialog
          kind={dialog.kind}
          handle={dialog.mentor.displayHandle}
          onConfirm={handleConfirm}
          onCancel={() => setDialog(null)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Mentor card
// ---------------------------------------------------------------------------

function MentorCard({
  mentor,
  busy,
  onAction,
}: {
  mentor: PendingMentor
  busy: boolean
  onAction: (kind: ActionKind) => void
}) {
  const v = mentor.verification
  const mp = mentor.mentorProfile

  return (
    <div className="rounded-lg border bg-card p-5">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {mentor.avatarLetter && mentor.avatarColor ? (
            <LetterAvatar
              letter={mentor.avatarLetter}
              color={mentor.avatarColor}
              hasPurpleTick={mentor.hasPurpleTick}
              size={40}
            />
          ) : (
            <div className="h-10 w-10 rounded-full bg-muted" />
          )}
          <div>
            <p className="font-medium">{mentor.displayHandle ?? '—'}</p>
            <p className="text-xs text-muted-foreground">
              {mentor.id.slice(0, 8)}… &middot; {mentor.status}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex shrink-0 items-center gap-2">
          {busy ? (
            <Loader2 size={16} className="animate-spin text-muted-foreground" />
          ) : (
            <>
              <button
                onClick={() => onAction('approve')}
                title="Approve mentor"
                className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
              >
                <CheckCircle2 size={13} />
                Approve
              </button>
              <button
                onClick={() => onAction('reject')}
                title="Reject verification"
                className="flex items-center gap-1.5 rounded-md bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600"
              >
                <XCircle size={13} />
                Reject
              </button>
              <button
                onClick={() => onAction('ban')}
                title="Ban mentor permanently"
                className="flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
              >
                <ShieldBan size={13} />
                Ban
              </button>
            </>
          )}
        </div>
      </div>

      {/* Journey info */}
      {mp && (
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
          <span>Journey: {mp.journeyType.replace(/_/g, ' ')}</span>
          {mp.prelimsCleared && <span>Prelims cleared</span>}
          {mp.mainsAttempts > 0 && <span>Mains: {mp.mainsAttempts}x</span>}
          {mp.interviewAttempts > 0 && <span>Interview: {mp.interviewAttempts}x</span>}
        </div>
      )}

      {/* Verification info */}
      {v && (
        <div className="mt-4 space-y-2">
          <p className="text-xs text-muted-foreground">
            Submitted: {new Date(v.submittedAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
            {v.reviewedAt
              ? ` · Reviewed: ${new Date(v.reviewedAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}`
              : ' · Not yet reviewed'}
          </p>

          {/* Document links (signed read URLs — 5 min TTL) */}
          <div className="flex flex-wrap gap-4">
            <DocLink label="Aadhaar" url={v.aadhaarSignedUrl} />
            <DocLink label="Hall ticket" url={v.hallTicketSignedUrl} />
            {v.hasMarksSheet ? (
              <DocLink label="Marks sheet" url={v.marksSheetSignedUrl} />
            ) : (
              <span className="text-xs text-muted-foreground">Marks sheet: not provided</span>
            )}
            <span className="text-xs text-muted-foreground">
              Bank details: {v.hasBankAccount ? 'Provided' : 'Missing'}
            </span>
          </div>

          {v.reviewNote && (
            <p className="rounded-md bg-muted px-3 py-2 text-xs text-foreground">
              Previous note: {v.reviewNote}
            </p>
          )}
        </div>
      )}

      {/* Warning if no verification docs */}
      {!v && (
        <p className="mt-3 text-xs text-amber-600">
          No verification documents submitted yet. Listed because of status.
        </p>
      )}
    </div>
  )
}
