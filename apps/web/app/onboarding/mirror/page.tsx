'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  BACKGROUND_OPTIONS,
  CHALLENGE_OPTIONS,
  COPY,
  JOURNEY_STAGES,
  KNOWLEDGE_SUBJECTS,
} from '@/lib/copy'
import { getApiClient } from '@/lib/api'
import { useAuthStore } from '@/lib/auth-store'
import { ConfidenceSlider } from '@/components/onboarding/ConfidenceSlider'
import { ChipPicker } from '@/components/onboarding/ChipPicker'
import { getSessionId } from '@/lib/session-id'
import { MotionTap } from '@/components/motion'
import { capture } from '@/lib/analytics'

type Stage = 'intro' | 'journey' | 'background' | 'reflection' | 'knowledge' | 'challenges' | 'privacy' | 'submitting'

function getProgress(stage: Stage, isBeginner: boolean): { current: number; total: number } | null {
  const beginnerOrder: Stage[] = ['intro', 'journey', 'background', 'reflection', 'knowledge', 'challenges', 'privacy']
  const standardOrder: Stage[] = ['intro', 'journey', 'reflection', 'knowledge', 'challenges', 'privacy']
  const order = isBeginner ? beginnerOrder : standardOrder
  const idx = order.indexOf(stage)
  if (idx === -1) return null
  return { current: idx + 1, total: order.length }
}

const SUBJECT_GROUPS: { label: string; subjects: readonly string[] }[] = [
  {
    label: 'Polity & History',
    subjects: KNOWLEDGE_SUBJECTS.filter((s) => ['Polity', 'History'].includes(s)),
  },
  {
    label: 'Geography & Environment',
    subjects: KNOWLEDGE_SUBJECTS.filter((s) => ['Geography', 'Environment'].includes(s)),
  },
  {
    label: 'Sci-Tech & Economy',
    subjects: KNOWLEDGE_SUBJECTS.filter((s) => ['Sci-Tech', 'Economy', 'CSAT'].includes(s)),
  },
  {
    label: 'Essay & Ethics',
    subjects: KNOWLEDGE_SUBJECTS.filter((s) => ['Essay', 'Ethics'].includes(s)),
  },
  {
    label: 'Current Affairs & Newspaper',
    subjects: KNOWLEDGE_SUBJECTS.filter((s) => ['Current Affairs', 'Newspaper Reading'].includes(s)),
  },
]

const stepVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.28, ease: 'easeOut' } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.18, ease: 'easeIn' } },
}

export default function MirrorPage() {
  const router = useRouter()
  const tokens = useAuthStore((s) => s.tokens)
  const hasHydrated = useAuthStore((s) => s.hasHydrated)
  const clearSession = useAuthStore((s) => s.clear)

  const [stage, setStage] = useState<Stage>('intro')
  const [journeyStage, setJourneyStage] = useState<string>('')
  const [background, setBackground] = useState<string>('')
  const [knowledge, setKnowledge] = useState<Record<string, number>>(
    Object.fromEntries(KNOWLEDGE_SUBJECTS.map((s) => [s, 0])),
  )
  const [challenges, setChallenges] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [savingLater, setSavingLater] = useState(false)

  useEffect(() => {
    if (hasHydrated && !tokens) router.replace('/login?role=ASPIRANT')
  }, [hasHydrated, tokens, router])

  useEffect(() => {
    void getApiClient()
      .onboarding.trackEvent(getSessionId(), `mirror.${stage}`)
      .catch(() => {})
    // Client-side PostHog event — mirrors the server-side audit event.
    capture('onboarding.mirror.step_changed', { stage })
  }, [stage])

  const isBeginner =
    journeyStage === 'ABOUT_TO_START' ||
    journeyStage === 'ONE_YEAR_IN' ||
    journeyStage === 'TWO_YEARS_IN_NO_PRELIMS'

  const progress = getProgress(stage, isBeginner)

  async function submit() {
    setStage('submitting')
    setError(null)
    try {
      await getApiClient().onboarding.submitMirror({
        journeyStage,
        background: background || undefined,
        knowledge,
        challenges,
      })
      capture('onboarding.mirror.submitted', { journeyStage })
      router.replace('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
      setStage('privacy')
    }
  }

  async function saveForLater() {
    if (savingLater) return
    setSavingLater(true)
    try {
      await getApiClient()
        .onboarding.trackEvent(getSessionId(), 'mirror.saved_for_later', {
          stage,
          journeyStage: journeyStage || null,
        })
        .catch(() => {})
      clearSession()
      router.replace('/')
    } catch {
      setSavingLater(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col px-6 py-12">
      {/* Screen-reader live region — announces step changes */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {progress ? `Mirror step ${progress.current} of ${progress.total}` : ''}
      </div>

      {/* Animated progress bar */}
      {progress && (
        <div className="mb-8 flex items-center justify-between">
          <div className="flex flex-1 flex-col gap-1.5 pr-4">
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
          {stage !== 'intro' && (
            <button
              onClick={saveForLater}
              disabled={savingLater}
              className="shrink-0 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              {savingLater ? 'Saving...' : 'Save & finish later'}
            </button>
          )}
        </div>
      )}

      {/* Crossfading step panels */}
      <AnimatePresence mode="wait">
        {stage === 'intro' && (
          <motion.div key="intro" variants={stepVariants} initial="initial" animate="animate" exit="exit">
            <Center>
              <h1 className="text-3xl font-semibold tracking-tight">{COPY.mirrorTitle}</h1>
              <p className="mt-2 text-base text-muted-foreground">{COPY.mirrorSubtitle}</p>
              <Cta onClick={() => setStage('journey')}>Begin</Cta>
            </Center>
          </motion.div>
        )}

        {stage === 'journey' && (
          <motion.div key="journey" variants={stepVariants} initial="initial" animate="animate" exit="exit">
            <div className="space-y-6">
              <h2 className="text-xl font-semibold">Where are you in your journey?</h2>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {JOURNEY_STAGES.map((s) => {
                  const isSelected = journeyStage === s.value
                  return (
                    <MotionTap key={s.value}>
                      <button
                        onClick={() => setJourneyStage(s.value)}
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
                        <span className="pl-2">{s.label}</span>
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
              <Cta
                disabled={!journeyStage}
                onClick={() => setStage(isBeginner ? 'background' : 'reflection')}
              >
                Next
              </Cta>
            </div>
          </motion.div>
        )}

        {stage === 'background' && (
          <motion.div key="background" variants={stepVariants} initial="initial" animate="animate" exit="exit">
            <div className="space-y-6">
              <h2 className="text-xl font-semibold">How are you preparing?</h2>
              <ChipPicker
                options={BACKGROUND_OPTIONS}
                selected={background ? [background] : []}
                onChange={(next) => setBackground(next[0] ?? '')}
                multi={false}
              />
              <Cta disabled={!background} onClick={() => setStage('reflection')}>
                Next
              </Cta>
            </div>
          </motion.div>
        )}

        {stage === 'reflection' && (
          <motion.div key="reflection" variants={stepVariants} initial="initial" animate="animate" exit="exit">
            <Center>
              <h2 className="text-xl font-medium">{COPY.honestReflection}</h2>
              <Cta onClick={() => setStage('knowledge')}>I&apos;m ready</Cta>
            </Center>
          </motion.div>
        )}

        {stage === 'knowledge' && (
          <motion.div key="knowledge" variants={stepVariants} initial="initial" animate="animate" exit="exit">
            <div className="space-y-6">
              <h2 className="text-xl font-semibold">How comfortable are you with each subject?</h2>
              <p className="text-sm text-muted-foreground">
                There&apos;s no right answer. Lower is safer &mdash; we&apos;ll show you what to study, not judge you.
              </p>
              <div className="space-y-3">
                {SUBJECT_GROUPS.map((group, groupIdx) => (
                  <details key={group.label} open={groupIdx === 0} className="group">
                    <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg border border-input px-4 py-3 hover:bg-accent">
                      <span className="text-sm font-medium">{group.label}</span>
                      <span className="text-xs text-muted-foreground group-open:rotate-180">
                        &#9660;
                      </span>
                    </summary>
                    <div className="mt-2 space-y-4 px-1 pb-2">
                      {group.subjects.map((s) => (
                        <ConfidenceSlider
                          key={s}
                          label={s}
                          value={knowledge[s] ?? 0}
                          onChange={(v) => setKnowledge({ ...knowledge, [s]: v })}
                        />
                      ))}
                    </div>
                  </details>
                ))}
              </div>
              <Cta onClick={() => setStage('challenges')}>Next</Cta>
            </div>
          </motion.div>
        )}

        {stage === 'challenges' && (
          <motion.div key="challenges" variants={stepVariants} initial="initial" animate="animate" exit="exit">
            <div className="space-y-6">
              <h2 className="text-xl font-semibold">What gets in your way most?</h2>
              <ChipPicker
                options={CHALLENGE_OPTIONS}
                selected={challenges}
                onChange={setChallenges}
                showCount
                gridCols
              />
              <Cta disabled={challenges.length === 0} onClick={() => setStage('privacy')}>
                Next
              </Cta>
            </div>
          </motion.div>
        )}

        {stage === 'privacy' && (
          <motion.div key="privacy" variants={stepVariants} initial="initial" animate="animate" exit="exit">
            <Center>
              <h2 className="text-xl font-medium">A note on privacy</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {COPY.privacyNotice}
              </p>
              {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
              <Cta onClick={submit}>I understand &mdash; let&apos;s begin</Cta>
            </Center>
          </motion.div>
        )}

        {stage === 'submitting' && (
          <motion.div key="submitting" variants={stepVariants} initial="initial" animate="animate" exit="exit">
            <Center>
              <p className="text-sm text-muted-foreground">Saving your reflection...</p>
            </Center>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="m-auto max-w-md text-center">{children}</div>
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
