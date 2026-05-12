'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  GUIDANCE_CATEGORIES,
  LANGUAGE_OPTIONS,
  MENTOR_JOURNEY_OPTIONS,
} from '@/lib/copy'
import { getApiClient } from '@/lib/api'
import { useAuthStore } from '@/lib/auth-store'
import { ChipPicker } from '@/components/onboarding/ChipPicker'

interface AttemptYear {
  year: number
  prelims: boolean
  mains: boolean
  interview: boolean
}

type Stage = 'journey' | 'history' | 'subjects' | 'reach' | 'submitting'

export default function MentorOnboardingPage() {
  const router = useRouter()
  const tokens = useAuthStore((s) => s.tokens)
  const hasHydrated = useAuthStore((s) => s.hasHydrated)
  const [stage, setStage] = useState<Stage>('journey')

  const [journeyType, setJourneyType] = useState<string>('')
  const [history, setHistory] = useState<AttemptYear[]>([
    { year: new Date().getFullYear() - 1, prelims: false, mains: false, interview: false },
  ])
  const [optionalSubject, setOptionalSubject] = useState('')
  const [rankAchieved, setRankAchieved] = useState('')
  const [guidanceCategories, setGuidanceCategories] = useState<string[]>([])
  const [languages, setLanguages] = useState<string[]>(['en'])
  const [hourlyRate, setHourlyRate] = useState(400)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (hasHydrated && !tokens) router.replace('/login?role=MENTOR')
  }, [tokens, router])

  function addYear() {
    setHistory([...history, { year: new Date().getFullYear(), prelims: false, mains: false, interview: false }])
  }
  function updateYear(idx: number, patch: Partial<AttemptYear>) {
    const next = history.slice()
    next[idx] = { ...next[idx]!, ...patch }
    setHistory(next)
  }
  function removeYear(idx: number) {
    setHistory(history.filter((_, i) => i !== idx))
  }

  const prelimsCleared = history.some((h) => h.prelims)
  const mainsAttempts = history.filter((h) => h.mains).length
  const interviewAttempts = history.filter((h) => h.interview).length

  async function submit() {
    setStage('submitting')
    setError(null)
    try {
      await getApiClient().onboarding.submitMentor({
        journeyType,
        prelimsCleared,
        mainsAttempts,
        interviewAttempts,
        attemptHistory: history,
        rankAchieved: rankAchieved ? Number(rankAchieved) : undefined,
        optionalSubject: optionalSubject || undefined,
        guidanceCategories,
        languages,
        hourlyRateInr: hourlyRate,
      })
      router.replace('/onboarding/submitted')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
      setStage('reach')
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col px-6 py-12">
      {stage === 'journey' && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Your UPSC journey</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Pick the description that fits you best.
            </p>
          </div>
          <div className="space-y-2">
            {MENTOR_JOURNEY_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => setJourneyType(o.value)}
                className={`w-full rounded-lg border p-3 text-left transition-colors ${
                  journeyType === o.value
                    ? 'border-primary bg-primary/5'
                    : 'border-input hover:bg-accent'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <Cta disabled={!journeyType} onClick={() => setStage('history')}>
            Next
          </Cta>
        </div>
      )}

      {stage === 'history' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold">Year-by-year</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Add each year you attempted UPSC. Mentees see this on your profile.
            </p>
          </div>
          <div className="space-y-3">
            {history.map((h, idx) => (
              <div key={idx} className="rounded-lg border bg-card p-4">
                <div className="mb-3 flex items-center justify-between">
                  <input
                    type="number"
                    value={h.year}
                    onChange={(e) => updateYear(idx, { year: Number(e.target.value) })}
                    className="w-24 rounded border bg-background px-2 py-1 text-sm"
                  />
                  <button
                    onClick={() => removeYear(idx)}
                    className="text-xs text-muted-foreground hover:text-red-600"
                  >
                    Remove
                  </button>
                </div>
                <div className="flex flex-wrap gap-3 text-sm">
                  <Check label="Prelims" checked={h.prelims} onChange={(v) => updateYear(idx, { prelims: v })} />
                  <Check label="Mains" checked={h.mains} onChange={(v) => updateYear(idx, { mains: v })} />
                  <Check
                    label="Interview"
                    checked={h.interview}
                    onChange={(v) => updateYear(idx, { interview: v })}
                  />
                </div>
              </div>
            ))}
          </div>
          <button onClick={addYear} className="text-sm text-primary hover:underline">
            + Add another year
          </button>
          <Cta onClick={() => setStage('subjects')}>Next</Cta>
        </div>
      )}

      {stage === 'subjects' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold">Where you can guide</h2>
            <p className="mt-1 text-sm text-muted-foreground">Pick the areas you&apos;re comfortable with.</p>
          </div>
          <ChipPicker
            options={GUIDANCE_CATEGORIES}
            selected={guidanceCategories}
            onChange={setGuidanceCategories}
          />
          <div className="space-y-2">
            <label className="text-sm font-medium">Optional subject</label>
            <input
              type="text"
              value={optionalSubject}
              onChange={(e) => setOptionalSubject(e.target.value)}
              placeholder="e.g. Sociology"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Languages</label>
            <ChipPicker options={LANGUAGE_OPTIONS} selected={languages} onChange={setLanguages} />
          </div>
          <Cta
            disabled={guidanceCategories.length === 0 || languages.length === 0}
            onClick={() => setStage('reach')}
          >
            Next
          </Cta>
        </div>
      )}

      {stage === 'reach' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold">Reach &amp; rate</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Set your default 1:1 hourly rate. You can adjust later.
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">UPSC rank achieved (if applicable)</label>
            <input
              type="number"
              value={rankAchieved}
              onChange={(e) => setRankAchieved(e.target.value)}
              placeholder="e.g. 142"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Hourly rate (₹)</label>
            <input
              type="number"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(Number(e.target.value))}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              min={100}
              max={10000}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Cta onClick={submit}>Submit for verification</Cta>
        </div>
      )}

      {stage === 'submitting' && (
        <p className="m-auto text-sm text-muted-foreground">Submitting…</p>
      )}
    </div>
  )
}

function Cta({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="mt-6 w-full rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
    >
      {children}
    </button>
  )
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-1.5">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="text-sm">{label}</span>
    </label>
  )
}
