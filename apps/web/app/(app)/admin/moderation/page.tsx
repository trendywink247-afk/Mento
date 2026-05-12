'use client'

import { useEffect, useState, useCallback } from 'react'
import { getApiClient } from '@/lib/api'
import { ReportDetailDrawer } from '@/components/admin/ReportDetailDrawer'
import { Loader2, RefreshCw } from 'lucide-react'

type ReportStatus = 'PENDING' | 'REVIEWED_NO_ACTION' | 'REVIEWED_BANNED'

type ReportSummary = {
  id: string
  createdAt: string
  status: string
  reason: string
  reporter: { id: string; displayHandle: string; avatarLetter: string; avatarColor: string }
  target: { id: string; displayHandle: string; avatarLetter: string; avatarColor: string }
  messageSnippet: string
  conversationId: string
}

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

const STATUS_TABS: Array<{ value: ReportStatus; label: string }> = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'REVIEWED_NO_ACTION', label: 'Dismissed' },
  { value: 'REVIEWED_BANNED', label: 'Actioned' },
]

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  REVIEWED_NO_ACTION: 'bg-slate-100 text-slate-700',
  REVIEWED_BANNED: 'bg-red-100 text-red-800',
}

export default function AdminModerationPage() {
  const [activeTab, setActiveTab] = useState<ReportStatus>('PENDING')
  const [items, setItems] = useState<ReportSummary[] | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<ReportDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const load = useCallback(
    async (status: ReportStatus, cursor?: string) => {
      setLoading(true)
      setError(null)
      try {
        const res = await getApiClient().admin.moderation.list({
          status,
          limit: 50,
          cursor,
        })
        if (cursor) {
          setItems((prev) => [...(prev ?? []), ...res.items])
        } else {
          setItems(res.items)
        }
        setNextCursor(res.nextCursor)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    setItems(null)
    setNextCursor(null)
    void load(activeTab)
  }, [activeTab, load])

  async function openDetail(id: string) {
    setSelectedId(id)
    setDetailLoading(true)
    try {
      const data = await getApiClient().admin.moderation.detail(id)
      setDetail(data)
    } catch {
      setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }

  function closeDetail() {
    setSelectedId(null)
    setDetail(null)
  }

  function handleResolved() {
    closeDetail()
    // Reload the current tab to reflect the change.
    setItems(null)
    void load(activeTab)
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Moderation Queue</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review reported messages and take action.
          </p>
        </div>
        <button
          onClick={() => { setItems(null); void load(activeTab) }}
          disabled={loading}
          className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Status tabs */}
      <div className="mt-5 flex gap-1 rounded-lg border bg-muted/30 p-1 w-fit">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={[
              'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
              activeTab === tab.value
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {/* Report list */}
      <div className="mt-5 overflow-hidden rounded-lg border bg-card">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5">Reporter</th>
              <th className="px-4 py-2.5">Target</th>
              <th className="px-4 py-2.5 max-w-xs">Reason / Snippet</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items === null ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center">
                  <Loader2 size={16} className="mx-auto animate-spin text-muted-foreground" />
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No reports in this category.
                </td>
              </tr>
            ) : (
              items.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => openDetail(r.id)}
                  className={[
                    'cursor-pointer hover:bg-muted/30 transition-colors',
                    selectedId === r.id ? 'bg-muted/40' : '',
                  ].join(' ')}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium">{r.reporter.displayHandle}</p>
                    <p className="text-xs text-muted-foreground">{r.reporter.id.slice(0, 8)}…</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{r.target.displayHandle}</p>
                    <p className="text-xs text-muted-foreground">{r.target.id.slice(0, 8)}…</p>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <p className="text-xs font-medium truncate">{r.reason}</p>
                    {r.messageSnippet && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {r.messageSnippet}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={[
                        'rounded-full px-2 py-0.5 text-xs font-medium',
                        STATUS_BADGE[r.status] ?? 'bg-muted text-muted-foreground',
                      ].join(' ')}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(r.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Load more */}
      {nextCursor && (
        <button
          onClick={() => void load(activeTab, nextCursor)}
          disabled={loading}
          className="mt-4 w-full rounded-md border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'Load more'}
        </button>
      )}

      {/* Detail drawer */}
      {selectedId && !detailLoading && detail && (
        <ReportDetailDrawer
          report={detail}
          onClose={closeDetail}
          onResolved={handleResolved}
        />
      )}
      {selectedId && detailLoading && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20">
          <Loader2 size={24} className="animate-spin text-white" />
        </div>
      )}
    </div>
  )
}
