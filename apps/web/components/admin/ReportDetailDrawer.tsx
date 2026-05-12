'use client'

import { useState } from 'react'
import { getApiClient } from '@/lib/api'
import { MODERATION_COPY } from '@/lib/copy'

type ReportDetail = {
  id: string
  createdAt: string
  status: string
  reason: string
  outcome: string | null
  reviewedAt: string | null
  reporter: { id: string; displayHandle: string; avatarLetter: string; avatarColor: string }
  target: { id: string; displayHandle: string; avatarLetter: string; avatarColor: string }
  targetUserId: string
  message: { id: string; body: string | null; type: string; createdAt: string }
  conversationId: string
  contextMessages: Array<{ id: string; body: string | null; type: string; createdAt: string }>
}

type Action = 'DISMISS' | 'WARN' | 'SUSPEND' | 'BAN'

function ConfirmModal({
  action,
  target,
  notes,
  setNotes,
  onConfirm,
  onCancel,
  busy,
}: {
  action: Action
  target: string
  notes: string
  setNotes: (v: string) => void
  onConfirm: () => void
  onCancel: () => void
  busy: boolean
}) {
  const needsNotes = action === 'WARN' || action === 'SUSPEND' || action === 'BAN'

  const titles: Record<Action, string> = {
    DISMISS: 'Dismiss report',
    WARN: 'Warn user',
    SUSPEND: 'Suspend user',
    BAN: 'Ban user permanently',
  }

  const buttonStyles: Record<Action, string> = {
    DISMISS: 'bg-slate-600 hover:bg-slate-700 text-white',
    WARN: 'bg-amber-600 hover:bg-amber-700 text-white',
    SUSPEND: 'bg-orange-600 hover:bg-orange-700 text-white',
    BAN: 'bg-red-700 hover:bg-red-800 text-white',
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-md rounded-xl border bg-background p-6 shadow-2xl">
        <h2 className="text-base font-semibold">{titles[action]}</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Target: <span className="font-mono">{target}</span>
        </p>

        {action === 'BAN' && (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs font-medium text-red-800 dark:bg-red-950 dark:text-red-200">
            {MODERATION_COPY.confirmBan}
          </p>
        )}

        {action === 'SUSPEND' && (
          <p className="mt-3 text-sm text-foreground">
            The user will be suspended immediately. All active sessions and push tokens will be
            revoked.
          </p>
        )}

        {needsNotes && (
          <div className="mt-4 space-y-1.5">
            <label className="text-xs font-medium">
              Notes {action === 'BAN' ? <span className="text-red-500">*</span> : '(optional)'}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Internal admin note..."
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
        )}

        <div className="mt-5 flex gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="flex-1 rounded-md border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy || (action === 'BAN' && notes.trim().length < 5)}
            className={[
              'flex-1 rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50',
              buttonStyles[action],
            ].join(' ')}
          >
            {busy ? 'Processing...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function ReportDetailDrawer({
  report,
  onClose,
  onResolved,
}: {
  report: ReportDetail
  onClose: () => void
  onResolved: () => void
}) {
  const [pendingAction, setPendingAction] = useState<Action | null>(null)
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isResolved = report.status !== 'PENDING'

  async function handleConfirm() {
    if (!pendingAction) return
    setBusy(true)
    setError(null)
    try {
      await getApiClient().admin.moderation.resolve(report.id, pendingAction, notes || undefined)
      setPendingAction(null)
      setNotes('')
      onResolved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onClose}
        aria-hidden
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l bg-background shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-base font-semibold">Report Detail</h2>
            <p className="text-xs text-muted-foreground">{report.id.slice(0, 8)}…</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
          >
            Close
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Status + reason */}
          <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span
                className={[
                  'rounded-full px-2 py-0.5 text-xs font-medium',
                  report.status === 'PENDING'
                    ? 'bg-amber-100 text-amber-800'
                    : report.status === 'REVIEWED_NO_ACTION'
                    ? 'bg-slate-100 text-slate-700'
                    : 'bg-red-100 text-red-800',
                ].join(' ')}
              >
                {report.status}
              </span>
              <span className="text-xs text-muted-foreground">
                {new Date(report.createdAt).toLocaleString('en-IN')}
              </span>
            </div>
            <p className="text-sm">
              <span className="font-medium">Reason:</span> {report.reason}
            </p>
            {report.outcome && (
              <p className="text-xs text-muted-foreground">Outcome: {report.outcome}</p>
            )}
          </div>

          {/* Parties */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">Reporter</p>
              <p className="text-sm font-medium">{report.reporter.displayHandle}</p>
              <p className="text-xs text-muted-foreground">{report.reporter.id.slice(0, 8)}…</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">Target (message author)</p>
              <p className="text-sm font-medium">{report.target.displayHandle}</p>
              <p className="text-xs text-muted-foreground">{report.target.id.slice(0, 8)}…</p>
            </div>
          </div>

          {/* Reported message */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Reported message</p>
            <div className="rounded-lg border bg-muted/20 px-4 py-3 text-sm">
              {report.message.body ?? <em className="text-muted-foreground">No text body</em>}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {new Date(report.message.createdAt).toLocaleString('en-IN')} · type: {report.message.type}
            </p>
          </div>

          {/* Context messages */}
          {report.contextMessages.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Recent messages from same author (up to 5)
              </p>
              <div className="space-y-2">
                {report.contextMessages.map((m) => (
                  <div key={m.id} className="rounded-md border bg-muted/10 px-3 py-2">
                    <p className="text-xs text-muted-foreground mb-0.5">
                      {new Date(m.createdAt).toLocaleString('en-IN')} · {m.type}
                    </p>
                    <p className="text-sm">
                      {m.body ?? <em className="text-muted-foreground">No text body</em>}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              {error}
            </p>
          )}
        </div>

        {/* Action footer — only shown for pending reports */}
        {!isResolved && (
          <div className="border-t px-6 py-4">
            <p className="text-xs text-muted-foreground mb-3">Actions</p>
            <div className="grid grid-cols-4 gap-2">
              <button
                onClick={() => setPendingAction('DISMISS')}
                className="rounded-md border px-2 py-2 text-xs font-medium hover:bg-accent"
              >
                Dismiss
              </button>
              <button
                onClick={() => setPendingAction('WARN')}
                className="rounded-md border border-amber-300 bg-amber-50 px-2 py-2 text-xs font-medium text-amber-800 hover:bg-amber-100"
              >
                Warn
              </button>
              <button
                onClick={() => setPendingAction('SUSPEND')}
                className="rounded-md bg-orange-600 px-2 py-2 text-xs font-medium text-white hover:bg-orange-700"
              >
                Suspend
              </button>
              <button
                onClick={() => setPendingAction('BAN')}
                className="rounded-md bg-red-700 px-2 py-2 text-xs font-medium text-white hover:bg-red-800"
              >
                Ban
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirm modal */}
      {pendingAction && (
        <ConfirmModal
          action={pendingAction}
          target={report.target.displayHandle}
          notes={notes}
          setNotes={setNotes}
          onConfirm={handleConfirm}
          onCancel={() => { setPendingAction(null); setNotes('') }}
          busy={busy}
        />
      )}
    </>
  )
}
