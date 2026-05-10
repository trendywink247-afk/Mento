import { useEffect, useState } from 'react'
import { Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import { GUIDANCE_CATEGORIES, LANGUAGE_OPTIONS, MENTOR_JOURNEY_OPTIONS } from '@/lib/copy'
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

export default function MentorOnboarding() {
  const tokens = useAuthStore((s) => s.tokens)
  const [stage, setStage] = useState<Stage>('journey')
  const [journeyType, setJourneyType] = useState<string>('')
  const [history, setHistory] = useState<AttemptYear[]>([
    { year: new Date().getFullYear() - 1, prelims: false, mains: false, interview: false },
  ])
  const [optionalSubject, setOptionalSubject] = useState('')
  const [rankAchieved, setRankAchieved] = useState('')
  const [guidanceCategories, setGuidanceCategories] = useState<string[]>([])
  const [languages, setLanguages] = useState<string[]>(['en'])
  const [hourlyRate, setHourlyRate] = useState('400')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!tokens) router.replace('/(auth)/login?role=MENTOR')
  }, [tokens])

  function updateYear(idx: number, patch: Partial<AttemptYear>) {
    const next = history.slice()
    next[idx] = { ...next[idx]!, ...patch }
    setHistory(next)
  }

  async function submit() {
    setStage('submitting')
    setError(null)
    try {
      await getApiClient().onboarding.submitMentor({
        journeyType,
        prelimsCleared: history.some((h) => h.prelims),
        mainsAttempts: history.filter((h) => h.mains).length,
        interviewAttempts: history.filter((h) => h.interview).length,
        attemptHistory: history,
        rankAchieved: rankAchieved ? Number(rankAchieved) : undefined,
        optionalSubject: optionalSubject || undefined,
        guidanceCategories,
        languages,
        hourlyRateInr: Number(hourlyRate) || 400,
      })
      router.replace('/(onboarding)/submitted')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
      setStage('reach')
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView contentContainerStyle={{ padding: 24, flexGrow: 1 }}>
        {stage === 'journey' && (
          <View className="gap-4">
            <Text className="text-2xl font-bold tracking-tight">Your UPSC journey</Text>
            <Text className="text-sm text-muted">Pick the description that fits you best.</Text>
            <View className="gap-2">
              {MENTOR_JOURNEY_OPTIONS.map((o) => (
                <Pressable
                  key={o.value}
                  onPress={() => setJourneyType(o.value)}
                  className={`rounded-lg border p-3 ${
                    journeyType === o.value ? 'border-primary bg-primary/5' : 'border-gray-200'
                  }`}
                >
                  <Text>{o.label}</Text>
                </Pressable>
              ))}
            </View>
            <Cta disabled={!journeyType} onPress={() => setStage('history')}>
              Next
            </Cta>
          </View>
        )}

        {stage === 'history' && (
          <View className="gap-4">
            <Text className="text-xl font-semibold">Year-by-year</Text>
            <Text className="text-sm text-muted">
              Add each year you attempted UPSC. Mentees see this on your profile.
            </Text>
            <View className="gap-3">
              {history.map((h, idx) => (
                <View key={idx} className="rounded-lg border border-gray-200 p-4">
                  <View className="mb-3 flex-row items-center justify-between">
                    <TextInput
                      value={String(h.year)}
                      onChangeText={(v) => updateYear(idx, { year: Number(v) })}
                      keyboardType="number-pad"
                      className="w-20 rounded border border-gray-200 px-2 py-1"
                    />
                    <Pressable onPress={() => setHistory(history.filter((_, i) => i !== idx))}>
                      <Text className="text-xs text-muted">Remove</Text>
                    </Pressable>
                  </View>
                  <View className="flex-row flex-wrap gap-2">
                    <Toggle label="Prelims" value={h.prelims} onChange={(v) => updateYear(idx, { prelims: v })} />
                    <Toggle label="Mains" value={h.mains} onChange={(v) => updateYear(idx, { mains: v })} />
                    <Toggle
                      label="Interview"
                      value={h.interview}
                      onChange={(v) => updateYear(idx, { interview: v })}
                    />
                  </View>
                </View>
              ))}
            </View>
            <Pressable
              onPress={() =>
                setHistory([
                  ...history,
                  { year: new Date().getFullYear(), prelims: false, mains: false, interview: false },
                ])
              }
            >
              <Text className="text-sm text-primary">+ Add another year</Text>
            </Pressable>
            <Cta onPress={() => setStage('subjects')}>Next</Cta>
          </View>
        )}

        {stage === 'subjects' && (
          <View className="gap-4">
            <Text className="text-xl font-semibold">Where you can guide</Text>
            <ChipPicker
              options={GUIDANCE_CATEGORIES}
              selected={guidanceCategories}
              onChange={setGuidanceCategories}
            />
            <Text className="mt-3 text-sm font-medium">Optional subject</Text>
            <TextInput
              value={optionalSubject}
              onChangeText={setOptionalSubject}
              placeholder="e.g. Sociology"
              className="rounded-md border border-gray-200 px-3 py-3"
            />
            <Text className="mt-3 text-sm font-medium">Languages</Text>
            <ChipPicker options={LANGUAGE_OPTIONS} selected={languages} onChange={setLanguages} />
            <Cta
              disabled={guidanceCategories.length === 0 || languages.length === 0}
              onPress={() => setStage('reach')}
            >
              Next
            </Cta>
          </View>
        )}

        {stage === 'reach' && (
          <View className="gap-4">
            <Text className="text-xl font-semibold">Reach &amp; rate</Text>
            <Text className="text-sm font-medium">UPSC rank achieved (optional)</Text>
            <TextInput
              value={rankAchieved}
              onChangeText={setRankAchieved}
              keyboardType="number-pad"
              placeholder="e.g. 142"
              className="rounded-md border border-gray-200 px-3 py-3"
            />
            <Text className="text-sm font-medium">Hourly rate (₹)</Text>
            <TextInput
              value={hourlyRate}
              onChangeText={setHourlyRate}
              keyboardType="number-pad"
              className="rounded-md border border-gray-200 px-3 py-3"
            />
            {error && <Text className="text-sm text-red-600">{error}</Text>}
            <Cta onPress={submit}>Submit for verification</Cta>
          </View>
        )}

        {stage === 'submitting' && (
          <View className="flex-1 items-center justify-center">
            <Text className="text-sm text-muted">Submitting…</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
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

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      className={`rounded-md border px-3 py-1.5 ${
        value ? 'border-primary bg-primary' : 'border-gray-200 bg-white'
      }`}
    >
      <Text className={value ? 'text-sm text-white' : 'text-sm'}>{label}</Text>
    </Pressable>
  )
}
