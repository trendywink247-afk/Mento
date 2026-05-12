'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  GUIDANCE_CATEGORIES,
  LANGUAGE_OPTIONS,
  MENTOR_JOURNEY_OPTIONS,
} from '@/lib/copy'
import { getApiClient } from '@/lib/api'
import { useAuthStore } from '@/lib/auth-store'
import { ChipPicker } from '@/components/onboarding/ChipPicker'
import { MotionTap } from '@/components/motion'
import { capture } from '@/lib/analytics'

interface AttemptYear {
  year: number
  prelims: boolean
  mains: boolean
  interview: boolean
}

type Stage = 'journey' | 'history' | 'subjects' | 'reach' | 'submitting'

const STAGE_ORDER: Stage[] = ['journey', 'history', 'subjects', 'reach']

function getProgress(stage: Stage): { current: number; total: number } | null {
  const idx = STAGE_ORDER.indexOf(stage)
  if (idx === -1) return null
  return { current: idx + 1, total: STAGE_ORDER.length }
}

const stepVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.28, ease: 'easeOut' } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.18, ease: 'easeIn' } },
}

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
  }, [hasHydrated, tokens, router])

  useEffect(() => {
    capture('onboarding.mentor.step_changed', { stage })
  }, [stage])

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
      capture('onboarding.mentor.submitted', { journeyType })
      // After journey form, mentor must upload credentials before manual review.
      router.replace('/onboarding/credentials')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
      setStage('reach')
    }
  }

  const progress = getProgress(stage)

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col px-6 py-12">
      {/* Animated progress bar */}
      {progress && (
        <div className="mb-8 flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">
            Step {progress.current} of {progress.total}
          </span>
          <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-full rounded-full bg-primary"
              animate={{ width: `${(progress.current / progress.total) * 100}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              role="progressbar"
              aria-valuenow={progress.current}
              aria-valuemin={1}
              aria-valuemax={progress.total}
              aria-label={`Step ${progress.current} of ${progress.total}`}
            />
          </div>
        </div>
      )}

      {/* Crossfading step panels */}
      <AnimatePresence mode="wait">
        {stage === 'journey' && (
          <motion.div key="journey" variants={stepVariants} initial="initial" animate="animate" exit="exit">
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Your UPSC journey</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pick the description that fits you best.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {MENTOR_JOURNEY_OPTIONS.map((o) => {
                  const isSelected = journeyType === o.value
                  return (
                    <MotionTap key={o.value}>
                      <button
                        onClick={() => setJourneyType(o.value)}
                        aria-pressed={isSelected}
                        className={`relative flex w-full items-center justify-between overflow-hidden rounded-lg border p-3 text-left transition-all ${
                          isSelected
                            ? 'border-primary bg-primary/5 font-medium shadow-sm'
                            : 'border-input hover:bg-accent'
                        }`}
                      >
                        <span
                          className={`absolute inset-y-0 left-0 w-[3px] rounded-l transition-all ${
                            isSelected ? 'bg-primary' : 'bg-transparent'
                          }`}
                          aria-hidden="true"
                        />
                        <span className="pl-2">{o.label}</span>
                        {isSelected && (
                          <span className="ml-2 shrink-0 text-primary" aria-hidden="true">
                            &#10003;
                          </span>
                        )}
                      </button>
                    </MotionTap>
                  )
                })}
              </div>
              <Cta disabled={!journeyType} onClick={() => setStage('history')}>
                Next
              </Cta>
            </div>
          </motion.div>
        )}

        {stage === 'history' && (
          <motion.div key="history" variants={stepVariants} initial="initial" animate="animate" exit="exit">
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
          </motion.div>
        )}

        {stage === 'subjects' && (
          <motion.div key="subjects" variants={stepVariants} initial="initial" animate="animate" exit="exit">
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold">Where you can guide</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pick the areas you&apos;re comfortable with.
                </p>
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
          </motion.div>
        )}

        {stage === 'reach' && (
          <motion.div key="reach" variants={stepVariants} initial="initial" animate="animate" exit="exit">
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
                <label className="text-sm font-medium">Hourly rate (&#8377;)</label>
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
          </motion.div>
        )}

        {stage === 'submitting' && (
          <motion.div key="submitting" variants={stepVariants} initial="initial" animate="animate" exit="exit">
            <p className="m-auto text-sm text-muted-foreground">Submitting...</p>
          </motion.div>
        )}
      </AnimatePresence>
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
    <MotionTap disabled={disabled} className="mt-6 block">
      <button
        onClick={onClick}
        disabled={disabled}
        className="w-full rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        {children}
      </button>
    </MotionTap>
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
