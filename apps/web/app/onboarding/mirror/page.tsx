'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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

type Stage = 'intro' | 'journey' | 'background' | 'reflection' | 'knowledge' | 'challenges' | 'privacy' | 'submitting'

export default function MirrorPage() {
  const router = useRouter()
  const tokens = useAuthStore((s) => s.tokens)
  const hasHydrated = useAuthStore((s) => s.hasHydrated)
  const [stage, setStage] = useState<Stage>('intro')
  const [journeyStage, setJourneyStage] = useState<string>('')
  const [background, setBackground] = useState<string>('')
  const [knowledge, setKnowledge] = useState<Record<string, number>>(
    Object.fromEntries(KNOWLEDGE_SUBJECTS.map((s) => [s, 0.3])),
  )
  const [challenges, setChallenges] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (hasHydrated && !tokens) router.replace('/login?role=ASPIRANT')
  }, [hasHydrated, tokens, router])

  useEffect(() => {
    void getApiClient()
      .onboarding.trackEvent(getSessionId(), `mirror.${stage}`)
      .catch(() => {})
  }, [stage])

  const isBeginner =
    journeyStage === 'ABOUT_TO_START' ||
    journeyStage === 'ONE_YEAR_IN' ||
    journeyStage === 'TWO_YEARS_IN_NO_PRELIMS'

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
      router.replace('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
      setStage('privacy')
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col px-6 py-12">
      {stage === 'intro' && (
        <Center>
          <h1 className="text-3xl font-semibold tracking-tight">{COPY.mirrorTitle}</h1>
          <p className="mt-2 text-base text-muted-foreground">{COPY.mirrorSubtitle}</p>
          <Cta onClick={() => setStage('journey')}>Begin</Cta>
        </Center>
      )}

      {stage === 'journey' && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">Where are you in your journey?</h2>
          <div className="space-y-2">
            {JOURNEY_STAGES.map((s) => (
              <button
                key={s.value}
                onClick={() => setJourneyStage(s.value)}
                className={`w-full rounded-lg border p-3 text-left transition-colors ${
                  journeyStage === s.value
                    ? 'border-primary bg-primary/5'
                    : 'border-input hover:bg-accent'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <Cta
            disabled={!journeyStage}
            onClick={() => setStage(isBeginner ? 'background' : 'reflection')}
          >
            Next
          </Cta>
        </div>
      )}

      {stage === 'background' && (
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
      )}

      {stage === 'reflection' && (
        <Center>
          <h2 className="text-xl font-medium">{COPY.honestReflection}</h2>
          <Cta onClick={() => setStage('knowledge')}>I&apos;m ready</Cta>
        </Center>
      )}

      {stage === 'knowledge' && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">How comfortable are you with each subject?</h2>
          <p className="text-sm text-muted-foreground">Drag each slider — be honest.</p>
          <div className="space-y-5">
            {KNOWLEDGE_SUBJECTS.map((s) => (
              <ConfidenceSlider
                key={s}
                label={s}
                value={knowledge[s] ?? 0}
                onChange={(v) => setKnowledge({ ...knowledge, [s]: v })}
              />
            ))}
          </div>
          <Cta onClick={() => setStage('challenges')}>Next</Cta>
        </div>
      )}

      {stage === 'challenges' && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">What gets in your way most?</h2>
          <p className="text-sm text-muted-foreground">Pick everything that applies.</p>
          <ChipPicker options={CHALLENGE_OPTIONS} selected={challenges} onChange={setChallenges} />
          <Cta disabled={challenges.length === 0} onClick={() => setStage('privacy')}>
            Next
          </Cta>
        </div>
      )}

      {stage === 'privacy' && (
        <Center>
          <h2 className="text-xl font-medium">A note on privacy</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {COPY.privacyNotice}
          </p>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          <Cta onClick={submit}>I understand &mdash; let&apos;s begin</Cta>
        </Center>
      )}

      {stage === 'submitting' && (
        <Center>
          <p className="text-sm text-muted-foreground">Saving your reflection…</p>
        </Center>
      )}
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
    <button
      onClick={onClick}
      disabled={disabled}
      className="mt-6 w-full rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
    >
      {children}
    </button>
  )
}
