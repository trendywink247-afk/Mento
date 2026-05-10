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

type Stage = 'intro' | 'journey' | 'background' | 'reflection' | 'knowledge' | 'challenges' | 'privacy' | 'submitting'

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
      router.replace('/(tabs)')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
      setStage('privacy')
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView contentContainerStyle={{ padding: 24, flexGrow: 1 }}>
        {stage === 'intro' && (
          <Center>
            <Text className="text-3xl font-bold tracking-tight">{COPY.mirrorTitle}</Text>
            <Text className="mt-2 text-base text-muted">{COPY.mirrorSubtitle}</Text>
            <Cta onPress={() => setStage('journey')}>Begin</Cta>
          </Center>
        )}

        {stage === 'journey' && (
          <View className="gap-4">
            <Text className="text-xl font-semibold">Where are you in your journey?</Text>
            <View className="gap-2">
              {JOURNEY_STAGES.map((s) => (
                <Pressable
                  key={s.value}
                  onPress={() => setJourneyStage(s.value)}
                  className={`rounded-lg border p-3 ${
                    journeyStage === s.value ? 'border-primary bg-primary/5' : 'border-gray-200'
                  }`}
                >
                  <Text>{s.label}</Text>
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
            <Text className="text-xl font-semibold">How are you preparing?</Text>
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
            <Text className="text-xl font-medium leading-relaxed">{COPY.honestReflection}</Text>
            <Cta onPress={() => setStage('knowledge')}>I'm ready</Cta>
          </Center>
        )}

        {stage === 'knowledge' && (
          <View className="gap-4">
            <Text className="text-xl font-semibold">How comfortable are you with each subject?</Text>
            <Text className="text-sm text-muted">Tap each level — be honest.</Text>
            <View className="gap-5 mt-2">
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
            <Text className="text-xl font-semibold">What gets in your way most?</Text>
            <Text className="text-sm text-muted">Pick everything that applies.</Text>
            <ChipPicker options={CHALLENGE_OPTIONS} selected={challenges} onChange={setChallenges} />
            <Cta disabled={challenges.length === 0} onPress={() => setStage('privacy')}>
              Next
            </Cta>
          </View>
        )}

        {stage === 'privacy' && (
          <Center>
            <Text className="text-xl font-medium">A note on privacy</Text>
            <Text className="mt-3 text-sm leading-relaxed text-muted">{COPY.privacyNotice}</Text>
            {error && <Text className="mt-3 text-sm text-red-600">{error}</Text>}
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
      className={`mt-6 rounded-md px-4 py-3 ${disabled ? 'bg-gray-300' : 'bg-primary'}`}
    >
      <Text className="text-center text-base font-medium text-white">{children}</Text>
    </Pressable>
  )
}
