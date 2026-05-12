'use client'

import { useState } from 'react'
import { getApiClient } from '@/lib/api'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DURATION_OPTIONS = [30, 60, 90]

interface BookingSheetProps {
  mentorId: string
  mentorHandle: string
  hourlyRateInr: number
  availability: Record<string, unknown> | null
  onClose: () => void
  onSuccess: () => void
}

type DayAvailability = { enabled?: boolean; start?: string; end?: string }

function getDefaultHours(day: number): { start: string; end: string } {
  // Mon-Fri: 9am-6pm. Weekend: closed.
  if (day === 0 || day === 6) return { start: '09:00', end: '18:00' }
  return { start: '09:00', end: '18:00' }
}

function isDayEnabled(avail: Record<string, unknown> | null, day: number): boolean {
  if (!avail) return day >= 1 && day <= 5
  const d = avail[day.toString()] as DayAvailability | undefined
  if (d === undefined) return day >= 1 && day <= 5
  return d.enabled !== false
}

function getDayHours(
  avail: Record<string, unknown> | null,
  day: number,
): { start: string; end: string } {
  const defaults = getDefaultHours(day)
  if (!avail) return defaults
  const d = avail[day.toString()] as DayAvailability | undefined
  if (!d) return defaults
  return { start: d.start ?? defaults.start, end: d.end ?? defaults.end }
}

function getNext7Days(): Date[] {
  const days: Date[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let i = 1; i <= 7; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    days.push(d)
  }
  return days
}

function generateTimeSlots(start: string, end: string): string[] {
  const slots: string[] = []
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  let cur = sh * 60 + (sm ?? 0)
  const endMin = eh * 60 + (em ?? 0)
  while (cur < endMin) {
    const h = Math.floor(cur / 60)
    const m = cur % 60
    slots.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`)
    cur += 30
  }
  return slots
}

export function BookingSheet({
  mentorId,
  mentorHandle,
  hourlyRateInr,
  availability,
  onClose,
  onSuccess,
}: BookingSheetProps) {
  const days = getNext7Days()
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [duration, setDuration] = useState<number>(60)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const amountInr = Math.ceil((hourlyRateInr * duration) / 60)

  const slots =
    selectedDay !== null
      ? (() => {
          const dayOfWeek = selectedDay.getDay()
          if (!isDayEnabled(availability, dayOfWeek)) return []
          const { start, end } = getDayHours(availability, dayOfWeek)
          return generateTimeSlots(start, end)
        })()
      : []

  async function handleConfirm() {
    if (!selectedDay || !selectedTime) return
    const [h, m] = selectedTime.split(':').map(Number)
    const scheduledAt = new Date(selectedDay)
    scheduledAt.setHours(h ?? 0, m ?? 0, 0, 0)

    setBusy(true)
    setError(null)
    try {
      await getApiClient().sessions.createRequest({
        mentorId,
        scheduledAt: scheduledAt.toISOString(),
        durationMin: duration,
        message: message.trim() || undefined,
      })
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not book session')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6">
      <div className="w-full max-w-lg rounded-2xl bg-background p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Request 1-on-1 session</h2>
            <p className="text-sm text-muted-foreground">with {mentorHandle}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent"
          >
            Cancel
          </button>
        </div>

        {/* Day picker */}
        <div className="mb-4">
          <p className="mb-2 text-sm font-medium">Pick a day</p>
          <div className="grid grid-cols-7 gap-1">
            {days.map((d) => {
              const dayOfWeek = d.getDay()
              const enabled = isDayEnabled(availability, dayOfWeek)
              const isSelected = selectedDay?.toDateString() === d.toDateString()
              return (
                <button
                  key={d.toISOString()}
                  disabled={!enabled}
                  onClick={() => {
                    setSelectedDay(d)
                    setSelectedTime(null)
                  }}
                  className={[
                    'flex flex-col items-center rounded-lg py-2 text-xs transition-colors',
                    !enabled
                      ? 'cursor-not-allowed text-muted-foreground/30'
                      : isSelected
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-accent',
                  ].join(' ')}
                >
                  <span className="text-[10px]">{DAY_LABELS[dayOfWeek]}</span>
                  <span className="mt-0.5 font-medium">{d.getDate()}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Time slots */}
        {selectedDay && (
          <div className="mb-4">
            <p className="mb-2 text-sm font-medium">Pick a time</p>
            {slots.length === 0 ? (
              <p className="text-sm text-muted-foreground">Mentor unavailable this day.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {slots.map((slot) => (
                  <button
                    key={slot}
                    onClick={() => setSelectedTime(slot)}
                    className={[
                      'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                      selectedTime === slot
                        ? 'bg-primary text-primary-foreground'
                        : 'border hover:bg-accent',
                    ].join(' ')}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Duration */}
        <div className="mb-4">
          <p className="mb-2 text-sm font-medium">Duration</p>
          <div className="flex gap-2">
            {DURATION_OPTIONS.map((d) => (
              <button
                key={d}
                onClick={() => setDuration(d)}
                className={[
                  'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  duration === d ? 'bg-primary text-primary-foreground' : 'border hover:bg-accent',
                ].join(' ')}
              >
                {d} min
              </button>
            ))}
          </div>
        </div>

        {/* Optional message */}
        <div className="mb-4">
          <p className="mb-2 text-sm font-medium">
            Note to mentor{' '}
            <span className="font-normal text-muted-foreground">(optional)</span>
          </p>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 200))}
            placeholder="What would you like to discuss?"
            className="h-20 w-full rounded-md border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="mt-1 text-right text-xs text-muted-foreground">{message.length}/200</div>
        </div>

        {/* Cost preview */}
        <div className="mb-4 rounded-lg bg-muted/50 px-4 py-3">
          <div className="flex items-center justify-between text-sm">
            <span>
              {duration} min @ ₹{hourlyRateInr}/hr
            </span>
            <span className="font-semibold">₹{amountInr}</span>
          </div>
          <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
            Simulated payment for MVP — no card is charged. Real payment arrives in v1.1.
          </p>
        </div>

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        <button
          onClick={handleConfirm}
          disabled={!selectedDay || !selectedTime || busy}
          className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {busy ? 'Booking…' : `Confirm booking · ₹${amountInr} (simulated)`}
        </button>
      </div>
    </div>
  )
}
