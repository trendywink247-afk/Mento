'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { getApiClient } from '@/lib/api'
import { useFeatureFlags } from '@/lib/feature-flags'

interface FlagRow {
  id: string
  key: string
  enabled: boolean
  description: string | null
  updatedAt: string
  updatedBy: string | null
}

export default function AdminFlagsPage() {
  const [flags, setFlags] = useState<FlagRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [seeding, setSeeding] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)
  const { refresh: refreshContext } = useFeatureFlags()

  const load = useCallback(async () => {
    setError(null)
    try {
      const rows = await getApiClient().admin.flags.list()
      setFlags(rows)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load flags')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function handleToggle(key: string, currentEnabled: boolean) {
    setToggling(key)
    // Optimistic update.
    setFlags((prev) =>
      prev ? prev.map((f) => (f.key === key ? { ...f, enabled: !currentEnabled } : f)) : prev,
    )
    try {
      await getApiClient().admin.flags.set(key, !currentEnabled)
      // Bust the React context cache so useFeatureFlag reflects change within 60s.
      refreshContext()
    } catch (err: unknown) {
      // Revert on error.
      setFlags((prev) =>
        prev ? prev.map((f) => (f.key === key ? { ...f, enabled: currentEnabled } : f)) : prev,
      )
      alert(err instanceof Error ? err.message : 'Failed to update flag')
    } finally {
      setToggling(null)
    }
  }

  async function handleSeed() {
    setSeeding(true)
    try {
      const result = await getApiClient().admin.flags.seed()
      await load()
      refreshContext()
      alert(`Seeded ${result.seeded} flag(s). ${result.skipped} already existed.`)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Seed failed')
    } finally {
      setSeeding(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Feature Flags</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Toggle features on or off without deploying code. Changes propagate within 30s.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void load()}
            className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
          <button
            onClick={() => void handleSeed()}
            disabled={seeding}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {seeding && <Loader2 size={14} className="animate-spin" />}
            Seed defaults
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {!flags ? (
        <div className="mt-8 flex justify-center">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
      ) : flags.length === 0 ? (
        <div className="mt-8 rounded-lg border bg-card p-8 text-center">
          <p className="text-base font-medium">No flags found.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Click &ldquo;Seed defaults&rdquo; to create the built-in flag set.
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Key</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Description</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Last updated</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Enabled</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {flags.map((flag) => (
                <tr key={flag.id} className="hover:bg-accent/30">
                  <td className="px-4 py-3 font-mono text-xs font-semibold">{flag.key}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {flag.description ?? <span className="italic text-muted-foreground/60">No description</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(flag.updatedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      role="switch"
                      aria-checked={flag.enabled}
                      aria-label={`Toggle ${flag.key}`}
                      disabled={toggling === flag.key}
                      onClick={() => void handleToggle(flag.key, flag.enabled)}
                      className={[
                        'relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50',
                        flag.enabled ? 'bg-primary' : 'bg-muted',
                      ].join(' ')}
                    >
                      <span
                        className={[
                          'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ease-in-out',
                          flag.enabled ? 'translate-x-4' : 'translate-x-0',
                        ].join(' ')}
                      />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
