'use client'

import { useEffect, useState } from 'react'
import { getApiClient } from '@/lib/api'

type Log = {
  id: string
  actorId: string | null
  action: string
  targetType: string | null
  targetId: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
}

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<Log[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getApiClient()
      .admin.listAuditLogs(100)
      .then((rows) => setLogs(rows))
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Failed to load'),
      )
  }, [])

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-4 overflow-x-auto rounded-lg border bg-card">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Time</th>
              <th className="px-4 py-2">Actor</th>
              <th className="px-4 py-2">Action</th>
              <th className="px-4 py-2">Target</th>
              <th className="px-4 py-2">Metadata</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {logs === null ? (
              <tr>
                <td className="px-4 py-3 text-muted-foreground" colSpan={5}>
                  Loading…
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td className="px-4 py-3 text-muted-foreground" colSpan={5}>
                  No audit log entries
                </td>
              </tr>
            ) : (
              logs.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-3 text-xs">
                    {new Date(l.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-xs">{l.actorId?.slice(0, 8) ?? 'system'}</td>
                  <td className="px-4 py-3 font-medium">{l.action}</td>
                  <td className="px-4 py-3 text-xs">
                    {l.targetType ? `${l.targetType} ${l.targetId?.slice(0, 8)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {l.metadata ? JSON.stringify(l.metadata) : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
