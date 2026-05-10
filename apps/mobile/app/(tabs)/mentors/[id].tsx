import { useEffect, useState } from 'react'
import {
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import type { AvatarColor, AvatarLetter } from '@mento/types'
import { getApiClient } from '@/lib/api'
import { LetterAvatar } from '@/components/LetterAvatar'
import { COPY } from '@/lib/copy'

type AttemptYear = { year: number; prelims: boolean; mains: boolean; interview: boolean }
type MentorDetail = {
  userId: string
  displayHandle: string
  avatarLetter: AvatarLetter
  avatarColor: AvatarColor
  hasPurpleTick: boolean
  isVerified: boolean
  isFoundingPartner: boolean
  prelimsCleared: boolean
  mainsAttempts: number
  interviewAttempts: number
  attemptHistory: unknown
  rankAchieved: number | null
  optionalSubject: string | null
  guidanceCategories: string[]
  languages: string[]
  hourlyRateInr: number
  metrics: { chats: number; mentees: number; sessions: number }
  reviews: Array<{
    id: string
    body: string
    createdAt: string
    author: { displayHandle: string; avatarLetter: AvatarLetter; avatarColor: AvatarColor }
  }>
}

export default function MentorProfile() {
  const params = useLocalSearchParams<{ id: string }>()
  const [mentor, setMentor] = useState<MentorDetail | null>(null)
  const [showRequest, setShowRequest] = useState(false)
  const [intro, setIntro] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    if (!params.id) return
    getApiClient()
      .mentors.detail(String(params.id))
      .then(setMentor)
      .catch(() => {})
  }, [params.id])

  async function send() {
    if (!mentor) return
    setBusy(true)
    setError(null)
    try {
      await getApiClient().chatRequests.create(mentor.userId, intro.trim())
      setSent(true)
      setTimeout(() => {
        setShowRequest(false)
        router.replace('/(tabs)/chat')
      }, 1200)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send')
    } finally {
      setBusy(false)
    }
  }

  if (!mentor) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <Text className="text-sm text-muted">Loading…</Text>
      </SafeAreaView>
    )
  }

  const history = (mentor.attemptHistory ?? []) as AttemptYear[]

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
        <View className="rounded-2xl border border-gray-200 bg-white p-5">
          <View className="flex-row items-start gap-4">
            <LetterAvatar
              letter={mentor.avatarLetter}
              color={mentor.avatarColor}
              hasPurpleTick={mentor.hasPurpleTick}
              size={64}
            />
            <View className="flex-1">
              <View className="flex-row flex-wrap items-center gap-2">
                <Text className="text-xl font-bold tracking-tight">{mentor.displayHandle}</Text>
                {mentor.isVerified && (
                  <View className="rounded-full bg-emerald-100 px-2 py-0.5">
                    <Text className="text-[10px] font-medium text-emerald-700">Verified</Text>
                  </View>
                )}
              </View>
              {mentor.rankAchieved && (
                <Text className="mt-1 text-sm text-muted">Rank — {mentor.rankAchieved}</Text>
              )}
              <Text className="mt-1 text-sm text-muted">
                ₹{mentor.hourlyRateInr}/hr · {mentor.languages.join(', ')}
              </Text>
            </View>
          </View>

          {history.length > 0 && (
            <View className="mt-5">
              <Text className="mb-2 text-sm font-medium">UPSC journey</Text>
              {history.map((h, i) => (
                <Text key={i} className="text-sm text-muted">
                  <Text className="font-medium text-primary">{h.year}</Text> —{' '}
                  {[
                    h.prelims && 'Prelims cleared',
                    h.mains && 'Mains written',
                    h.interview && 'Interview attended',
                  ]
                    .filter(Boolean)
                    .join(', ') || 'Did not advance'}
                </Text>
              ))}
            </View>
          )}

          {mentor.guidanceCategories.length > 0 && (
            <View className="mt-5">
              <Text className="mb-2 text-sm font-medium">Comfortable guiding</Text>
              <View className="flex-row flex-wrap gap-2">
                {mentor.guidanceCategories.map((c) => (
                  <View key={c} className="rounded-full bg-gray-100 px-3 py-1">
                    <Text className="text-xs">{c}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {mentor.optionalSubject && (
            <Text className="mt-3 text-sm text-muted">
              Optional: <Text className="text-primary">{mentor.optionalSubject}</Text>
            </Text>
          )}

          <View className="mt-5 gap-2">
            <Pressable
              onPress={() => setShowRequest(true)}
              className="rounded-md bg-emerald-600 px-4 py-3 active:opacity-90"
            >
              <Text className="text-center text-base font-medium text-white">
                Initiate connection
              </Text>
            </Pressable>
            <Pressable disabled className="rounded-md bg-amber-500/70 px-4 py-3 opacity-60">
              <Text className="text-center text-sm font-medium text-white">
                Request 1-on-1 session (coming soon)
              </Text>
            </Pressable>
          </View>
        </View>

        <View className="rounded-2xl border border-gray-200 bg-white p-5 flex-row gap-4">
          <Stat label="Mentees" value={mentor.metrics.mentees} />
          <Stat label="Chats" value={mentor.metrics.chats} />
          <Stat label="Sessions" value={mentor.metrics.sessions} />
        </View>

        <View className="rounded-2xl border border-gray-200 bg-white p-5">
          <Text className="mb-2 text-sm font-medium">What mentees say</Text>
          <Text className="mb-3 text-xs text-muted">{COPY.rateHumans}</Text>
          {mentor.reviews.length === 0 ? (
            <Text className="text-sm text-muted">No reviews yet.</Text>
          ) : (
            mentor.reviews.map((r) => (
              <View key={r.id} className="mb-4 flex-row items-start gap-3">
                <LetterAvatar letter={r.author.avatarLetter} color={r.author.avatarColor} size={28} />
                <View className="flex-1">
                  <Text className="text-sm">{r.body}</Text>
                  <Text className="mt-1 text-xs text-muted">
                    {r.author.displayHandle} · {new Date(r.createdAt).toLocaleDateString()}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <Modal visible={showRequest} animationType="slide" transparent onRequestClose={() => setShowRequest(false)}>
        <View className="flex-1 justify-center bg-black/50 p-6">
          <View className="rounded-2xl bg-white p-5">
            {sent ? (
              <View>
                <Text className="text-center text-base font-medium">Request sent.</Text>
                <Text className="mt-2 text-center text-sm text-muted">
                  When the mentor accepts, your conversation will appear in Chats.
                </Text>
              </View>
            ) : (
              <>
                <Text className="text-lg font-bold">Send an intro</Text>
                <Text className="mt-1 text-sm text-muted">
                  160 characters. Be honest. Tell them what you need.
                </Text>
                <TextInput
                  value={intro}
                  onChangeText={(t) => setIntro(t.slice(0, 160))}
                  multiline
                  placeholder="Hi, I'm preparing for Prelims and struggling with…"
                  className="mt-3 h-28 rounded-md border border-gray-200 bg-white p-3 text-base"
                />
                <Text className="mt-1 text-right text-xs text-muted">{intro.length}/160</Text>
                {error && <Text className="mt-2 text-sm text-red-600">{error}</Text>}
                <View className="mt-4 flex-row gap-2">
                  <Pressable
                    onPress={() => setShowRequest(false)}
                    className="flex-1 rounded-md border border-gray-200 px-4 py-3"
                  >
                    <Text className="text-center">Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={send}
                    disabled={!intro.trim() || busy}
                    className={`flex-1 rounded-md px-4 py-3 ${
                      !intro.trim() || busy ? 'bg-gray-300' : 'bg-primary'
                    }`}
                  >
                    <Text className="text-center font-medium text-white">
                      {busy ? 'Sending…' : 'Send'}
                    </Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View className="flex-1 items-center">
      <Text className="text-2xl font-bold">{value}</Text>
      <Text className="text-xs text-muted">{label}</Text>
    </View>
  )
}
