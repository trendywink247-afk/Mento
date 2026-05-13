import { useEffect, useState } from 'react'
import { Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native'
import { router } from 'expo-router'
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
import { capture } from '@/lib/analytics'
import { ANALYTICS_EVENTS } from '@/lib/events'

type Stage = 'intro' | 'journey' | 'background' | 'reflection' | 'knowledge' | 'challenges' | 'privacy' | 'submitting'

const STAGES: Stage[] = ['intro', 'journey', 'background', 'reflection', 'knowledge', 'challenges', 'privacy']

function ProgressBar({ stage }: { stage: Stage }) {
  const idx = STAGES.indexOf(stage)
  const progress = idx < 0 ? 0 : (idx + 1) / STAGES.length
  return (
    <View style={{ height: 3, backgroundColor: '#e2e8f0', borderRadius: 2 }}>
      <View
        style={{
          height: 3,
          borderRadius: 2,
          backgroundColor: '#2563eb',
          width: `${Math.round(progress * 100)}%`,
        }}
      />
    </View>
  )
}

export default function Mirror() {
  const tokens = useAuthStore((s) => s.tokens)
  const [stage, setStage] = useState<Stage>('intro')
  const [journeyStage, setJourneyStage] = useState<string>('')
  const [background, setBackground] = useState<string>('')
  const [knowledge, setKnowledge] = useState<Record<string, number>>(
    Object.fromEntries(KNOWLEDGE_SUBJECTS.map((s) => [s, 0.25])),
  )
  const [challenges, setChallenges] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!tokens) router.replace('/(auth)/login?role=ASPIRANT')
  }, [tokens])

  // Track stage transitions.
  useEffect(() => {
    if (stage === 'intro') {
      capture(ANALYTICS_EVENTS.MIRROR_STARTED)
    } else if (stage !== 'submitting') {
      capture(ANALYTICS_EVENTS.MIRROR_STEP_COMPLETED, { step: stage })
    }
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
      capture(ANALYTICS_EVENTS.MIRROR_COMPLETED, { journeyStage })
      router.replace('/(tabs)')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
      setStage('privacy')
    }
  }

  const showProgress = stage !== 'submitting'

  return (
    <SafeAreaView className="flex-1 bg-background">
      {showProgress && (
        <View className="px-6 pt-4 pb-1">
          <ProgressBar stage={stage} />
        </View>
      )}

      <ScrollView contentContainerStyle={{ padding: 24, flexGrow: 1 }}>
        {stage === 'intro' && (
          <Center>
            <Text className="text-3xl font-bold tracking-tight text-foreground">{COPY.mirrorTitle}</Text>
            <Text className="mt-2 text-base text-muted">{COPY.mirrorSubtitle}</Text>
            <Cta onPress={() => setStage('journey')}>Begin</Cta>
          </Center>
        )}

        {stage === 'journey' && (
          <View className="gap-4">
            <Text className="text-xl font-semibold text-foreground">Where are you in your journey?</Text>
            <View className="gap-2">
              {JOURNEY_STAGES.map((s) => (
                <Pressable
                  key={s.value}
                  onPress={() => setJourneyStage(s.value)}
                  className={`rounded-xl border p-4 ${
                    journeyStage === s.value
                      ? 'border-primary bg-blue-50'
                      : 'border-border bg-white'
                  }`}
                >
                  <Text
                    className={
                      journeyStage === s.value
                        ? 'text-sm font-medium text-primary'
                        : 'text-sm text-foreground'
                    }
                  >
                    {s.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Cta
              disabled={!journeyStage}
              onPress={() => setStage(isBeginner ? 'background' : 'reflection')}
            >
              Next
            </Cta>
          </View>
        )}

        {stage === 'background' && (
          <View className="gap-4">
            <Text className="text-xl font-semibold text-foreground">How are you preparing?</Text>
            <ChipPicker
              options={BACKGROUND_OPTIONS}
              selected={background ? [background] : []}
              onChange={(next) => setBackground(next[0] ?? '')}
              multi={false}
            />
            <Cta disabled={!background} onPress={() => setStage('reflection')}>
              Next
            </Cta>
          </View>
        )}

        {stage === 'reflection' && (
          <Center>
            <Text className="text-xl font-medium leading-relaxed text-foreground">{COPY.honestReflection}</Text>
            <Cta onPress={() => setStage('knowledge')}>I'm ready</Cta>
          </Center>
        )}

        {stage === 'knowledge' && (
          <View className="gap-4">
            <Text className="text-xl font-semibold text-foreground">How comfortable are you with each subject?</Text>
            <Text className="text-sm text-muted">Tap each level — be honest.</Text>
            <View className="mt-2 gap-5">
              {KNOWLEDGE_SUBJECTS.map((s) => (
                <ConfidenceSlider
                  key={s}
                  label={s}
                  value={knowledge[s] ?? 0}
                  onChange={(v) => setKnowledge({ ...knowledge, [s]: v })}
                />
              ))}
            </View>
            <Cta onPress={() => setStage('challenges')}>Next</Cta>
          </View>
        )}

        {stage === 'challenges' && (
          <View className="gap-4">
            <Text className="text-xl font-semibold text-foreground">What gets in your way most?</Text>
            <Text className="text-sm text-muted">Pick everything that applies.</Text>
            <ChipPicker options={CHALLENGE_OPTIONS} selected={challenges} onChange={setChallenges} />
            <Cta disabled={challenges.length === 0} onPress={() => setStage('privacy')}>
              Next
            </Cta>
          </View>
        )}

        {stage === 'privacy' && (
          <Center>
            <Text className="text-xl font-medium text-foreground">A note on privacy</Text>
            <Text className="mt-3 text-sm leading-relaxed text-muted">{COPY.privacyNotice}</Text>
            {error && <Text className="mt-3 text-sm text-destructive">{error}</Text>}
            <Cta onPress={submit}>I understand — let's begin</Cta>
          </Center>
        )}

        {stage === 'submitting' && (
          <Center>
            <Text className="text-sm text-muted">Saving your reflection…</Text>
          </Center>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <View className="flex-1 items-center justify-center">
      <View className="max-w-md">{children}</View>
    </View>
  )
}

function Cta({
  children,
  onPress,
  disabled,
}: {
  children: React.ReactNode
  onPress: () => void
  disabled?: boolean
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`mt-6 rounded-xl px-4 py-4 ${disabled ? 'bg-border' : 'bg-primary'}`}
    >
      <Text className="text-center text-base font-semibold text-white">{children}</Text>
    </Pressable>
  )
}
