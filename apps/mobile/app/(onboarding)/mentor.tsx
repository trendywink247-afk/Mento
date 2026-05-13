import { useEffect, useState } from 'react'
import { Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import { GUIDANCE_CATEGORIES, LANGUAGE_OPTIONS, MENTOR_JOURNEY_OPTIONS } from '@/lib/copy'
import { getApiClient } from '@/lib/api'
import { useAuthStore } from '@/lib/auth-store'
import { ChipPicker } from '@/components/onboarding/ChipPicker'
import { capture } from '@/lib/analytics'
import { ANALYTICS_EVENTS } from '@/lib/events'

interface AttemptYear {
  year: number
  prelims: boolean
  mains: boolean
  interview: boolean
}

type Stage = 'journey' | 'history' | 'subjects' | 'reach' | 'submitting'

const STAGES: Stage[] = ['journey', 'history', 'subjects', 'reach']

function ProgressBar({ stage }: { stage: Stage }) {
  const idx = STAGES.indexOf(stage)
  const progress = idx < 0 ? 1 : (idx + 1) / STAGES.length
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

  // Track stage transitions.
  useEffect(() => {
    if (stage === 'journey') {
      capture(ANALYTICS_EVENTS.MENTOR_ONBOARDING_STARTED)
    } else if (stage !== 'submitting') {
      capture(ANALYTICS_EVENTS.MENTOR_STEP_COMPLETED, { step: stage })
    }
  }, [stage])

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
      capture(ANALYTICS_EVENTS.MENTOR_VERIFICATION_SUBMITTED, { journeyType })
      router.replace('/(onboarding)/submitted')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
      setStage('reach')
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
        {stage === 'journey' && (
          <View className="gap-4">
            <Text className="text-2xl font-bold tracking-tight text-foreground">Your UPSC journey</Text>
            <Text className="text-sm text-muted">Pick the description that fits you best.</Text>
            <View className="gap-2">
              {MENTOR_JOURNEY_OPTIONS.map((o) => (
                <Pressable
                  key={o.value}
                  onPress={() => setJourneyType(o.value)}
                  className={`rounded-xl border p-4 ${
                    journeyType === o.value
                      ? 'border-primary bg-blue-50'
                      : 'border-border bg-white'
                  }`}
                >
                  <Text
                    className={
                      journeyType === o.value
                        ? 'text-sm font-medium text-primary'
                        : 'text-sm text-foreground'
                    }
                  >
                    {o.label}
                  </Text>
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
            <Text className="text-xl font-semibold text-foreground">Year-by-year history</Text>
            <Text className="text-sm text-muted">
              Add each year you attempted UPSC. Mentees see this on your profile.
            </Text>
            <View className="gap-3">
              {history.map((h, idx) => (
                <View
                  key={idx}
                  className="rounded-xl border border-border bg-white p-4"
                >
                  {/* Year header */}
                  <View className="mb-3 flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2">
                      <View className="h-8 w-8 items-center justify-center rounded-full bg-primary">
                        <Text className="text-xs font-bold text-white">{idx + 1}</Text>
                      </View>
                      <TextInput
                        value={String(h.year)}
                        onChangeText={(v) => updateYear(idx, { year: Number(v) || h.year })}
                        keyboardType="number-pad"
                        style={{
                          width: 70,
                          borderWidth: 1,
                          borderColor: '#e2e8f0',
                          borderRadius: 8,
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          fontSize: 15,
                          fontWeight: '600',
                          color: '#0f172a',
                        }}
                      />
                    </View>
                    {history.length > 1 && (
                      <Pressable
                        onPress={() => setHistory(history.filter((_, i) => i !== idx))}
                        hitSlop={8}
                      >
                        <Text className="text-xs text-muted">Remove</Text>
                      </Pressable>
                    )}
                  </View>

                  {/* Stage toggles — horizontal chips */}
                  <View className="flex-row gap-2">
                    <Toggle
                      label="Prelims"
                      value={h.prelims}
                      onChange={(v) => updateYear(idx, { prelims: v })}
                    />
                    <Toggle
                      label="Mains"
                      value={h.mains}
                      onChange={(v) => updateYear(idx, { mains: v })}
                    />
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
              className="items-center rounded-xl border border-dashed border-primary py-3"
            >
              <Text className="text-sm font-medium text-primary">+ Add another year</Text>
            </Pressable>

            <Cta onPress={() => setStage('subjects')}>Next</Cta>
          </View>
        )}

        {stage === 'subjects' && (
          <View className="gap-4">
            <Text className="text-xl font-semibold text-foreground">Where you can guide</Text>
            <ChipPicker
              options={GUIDANCE_CATEGORIES}
              selected={guidanceCategories}
              onChange={setGuidanceCategories}
            />
            <Text className="mt-3 text-sm font-medium text-foreground">Optional subject</Text>
            <TextInput
              value={optionalSubject}
              onChangeText={setOptionalSubject}
              placeholder="e.g. Sociology"
              placeholderTextColor="#94a3b8"
              className="rounded-xl border border-border bg-white px-3 py-3 text-foreground"
            />
            <Text className="mt-3 text-sm font-medium text-foreground">Languages</Text>
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
            <Text className="text-xl font-semibold text-foreground">Reach &amp; rate</Text>
            <Text className="text-sm font-medium text-foreground">UPSC rank achieved (optional)</Text>
            <TextInput
              value={rankAchieved}
              onChangeText={setRankAchieved}
              keyboardType="number-pad"
              placeholder="e.g. 142"
              placeholderTextColor="#94a3b8"
              className="rounded-xl border border-border bg-white px-3 py-3 text-foreground"
            />
            <Text className="text-sm font-medium text-foreground">Hourly rate (₹)</Text>
            <TextInput
              value={hourlyRate}
              onChangeText={setHourlyRate}
              keyboardType="number-pad"
              className="rounded-xl border border-border bg-white px-3 py-3 text-foreground"
            />
            {error && <Text className="text-sm text-destructive">{error}</Text>}
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
      className={`mt-6 rounded-xl px-4 py-4 ${disabled ? 'bg-border' : 'bg-primary'}`}
    >
      <Text className="text-center text-base font-semibold text-white">{children}</Text>
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
      className={`flex-1 items-center rounded-lg border py-2 ${
        value ? 'border-primary bg-primary' : 'border-border bg-white'
      }`}
    >
      <Text className={`text-xs font-medium ${value ? 'text-white' : 'text-foreground'}`}>
        {label}
      </Text>
    </Pressable>
  )
}
