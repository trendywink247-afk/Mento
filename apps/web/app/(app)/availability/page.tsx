'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getApiClient } from '@/lib/api'
import { useAuthStore } from '@/lib/auth-store'

const DAYS = [
  { index: 1, label: 'Monday' },
  { index: 2, label: 'Tuesday' },
  { index: 3, label: 'Wednesday' },
  { index: 4, label: 'Thursday' },
  { index: 5, label: 'Friday' },
  { index: 6, label: 'Saturday' },
  { index: 0, label: 'Sunday' },
]

type DayConfig = { enabled: boolean; start: string; end: string }
type AvailabilityMap = Record<string, DayConfig>

function makeDefaults(): AvailabilityMap {
  const map: AvailabilityMap = {}
  for (const d of DAYS) {
    map[d.index.toString()] = {
      enabled: d.index >= 1 && d.index <= 5,
      start: '09:00',
      end: '18:00',
    }
  }
  return map
}

function mergeAvailability(raw: Record<string, unknown> | null): AvailabilityMap {
  const defaults = makeDefaults()
  if (!raw) return defaults
  const result: AvailabilityMap = { ...defaults }
  for (const key of Object.keys(defaults)) {
    const entry = raw[key]
    if (entry && typeof entry === 'object') {
      const e = entry as Partial<DayConfig>
      result[key] = {
        enabled: e.enabled ?? defaults[key]!.enabled,
        start: e.start ?? defaults[key]!.start,
        end: e.end ?? defaults[key]!.end,
      }
    }
  }
  return result
}

export default function AvailabilityPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const isMentor = user?.role === 'MENTOR'

  const [avail, setAvail] = useState<AvailabilityMap>(makeDefaults())
  const [hourlyRate, setHourlyRate] = useState<number>(400)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isMentor) {
      router.replace('/dashboard')
      return
    }
    // To read existing availability we fetch from mentors endpoint — we need mentorId.
    // Since we don't have it directly, we use the /me endpoint which has user id,
    // then fetch mentor detail. Actually let's read from sessions/availability/:id
    // but we don't have a "self" endpoint for that. We'll just start from defaults
    // and load from user id via profile if available.
    setLoading(false)
  }, [isMentor, router])

  function toggleDay(idx: number) {
    setAvail((prev) => ({
      ...prev,
      [idx.toString()]: {
        ...prev[idx.toString()]!,
        enabled: !prev[idx.toString()]?.enabled,
      },
    }))
  }

  function setTime(idx: number, field: 'start' | 'end', value: string) {
    setAvail((prev) => ({
      ...prev,
      [idx.toString()]: {
        ...prev[idx.toString()]!,
        [field]: value,
      },
    }))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      await getApiClient().sessions.setAvailability(avail as Record<string, unknown>)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError('Failed to save availability')
    } finally {
      setSaving(false)
    }
  }

  if (!isMentor) return null
  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Availability</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Set the days and times when aspirants can book a 1-on-1 session with you.
        </p>
      </div>

      {/* Hourly rate */}
      <div className="rounded-xl border bg-card p-5">
        <h2 className="mb-3 text-sm font-medium">Hourly rate (₹)</h2>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={100}
            max={5000}
            step={50}
            value={hourlyRate}
            onChange={(e) => setHourlyRate(Number(e.target.value))}
            className="w-28 rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <span className="text-sm text-muted-foreground">per hour (default ₹400)</span>
        </div>
        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
          Rate is informational only in MVP. Real billing arrives in v1.1.
        </p>
      </div>

      {/* Weekly schedule */}
      <div className="rounded-xl border bg-card p-5">
        <h2 className="mb-4 text-sm font-medium">Weekly schedule</h2>
        <div className="space-y-3">
          {DAYS.map(({ index, label }) => {
            const config = avail[index.toString()]!
            return (
              <div key={index} className="flex items-center gap-4">
                <button
                  onClick={() => toggleDay(index)}
                  className={[
                    'flex w-28 flex-shrink-0 items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
                    config.enabled
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'h-2 w-2 rounded-full',
                      config.enabled ? 'bg-primary' : 'bg-muted-foreground/30',
                    ].join(' ')}
                  />
                  {label.slice(0, 3)}
                </button>

                {config.enabled ? (
                  <div className="flex items-center gap-2 text-sm">
                    <input
                      type="time"
                      value={config.start}
                      onChange={(e) => setTime(index, 'start', e.target.value)}
                      className="rounded-md border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <span className="text-muted-foreground">to</span>
                    <input
                      type="time"
                      value={config.end}
                      onChange={(e) => setTime(index, 'end', e.target.value)}
                      className="rounded-md border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground/50">Unavailable</span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">
          Availability saved successfully.
        </p>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save availability'}
      </button>

      <p className="text-center text-xs text-muted-foreground">
        Aspirants will see 30-minute slots within your available hours when booking.
      </p>
    </div>
  )
}
