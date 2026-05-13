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
import { BadgeCheck, ChevronLeft, Shield } from 'lucide-react-native'
import type { AvatarColor, AvatarLetter } from '@mento/types'
import { getApiClient } from '@/lib/api'
import { LetterAvatar } from '@/components/LetterAvatar'
import { COPY } from '@/lib/copy'
import { capture } from '@/lib/analytics'
import { ANALYTICS_EVENTS } from '@/lib/events'

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

function yearBadge(h: AttemptYear): string {
  const parts: string[] = []
  if (h.prelims) parts.push('Prelims')
  if (h.mains) parts.push('Mains')
  if (h.interview) parts.push('Interview')
  return parts.length ? parts.join(' · ') : 'Did not advance'
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
      .then((m) => {
        setMentor(m)
        capture(ANALYTICS_EVENTS.MENTOR_PROFILE_VIEWED, { mentorId: String(params.id) })
      })
      .catch(() => {})
  }, [params.id])

  async function send() {
    if (!mentor) return
    setBusy(true)
    setError(null)
    try {
      await getApiClient().chatRequests.create(mentor.userId, intro.trim())
      capture(ANALYTICS_EVENTS.CHAT_REQUEST_SENT, { mentorId: mentor.userId })
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
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <Text className="text-sm text-muted">Loading…</Text>
      </SafeAreaView>
    )
  }

  const history = (mentor.attemptHistory ?? []) as AttemptYear[]

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Back breadcrumb */}
      <Pressable
        onPress={() => router.back()}
        hitSlop={8}
        className="flex-row items-center gap-1 px-4 py-3 border-b border-border"
      >
        <ChevronLeft size={16} color="#64748b" strokeWidth={2} />
        <Text className="text-sm text-muted">Mentors</Text>
      </Pressable>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Hero band */}
        <View className="bg-white px-5 pt-5 pb-4 border-b border-border">
          <View className="flex-row items-start gap-4">
            <LetterAvatar
              letter={mentor.avatarLetter}
              color={mentor.avatarColor}
              hasPurpleTick={mentor.hasPurpleTick}
              size={72}
            />
            <View className="flex-1">
              <View className="flex-row flex-wrap items-center gap-2">
                <Text className="text-xl font-bold tracking-tight text-foreground">
                  {mentor.displayHandle}
                </Text>
                {mentor.isVerified && (
                  <BadgeCheck size={18} color="#059669" strokeWidth={2} />
                )}
                {mentor.isFoundingPartner && (
                  <View className="rounded-full bg-amber-100 px-2 py-0.5">
                    <Text className="text-[10px] font-medium text-amber-700">Founding</Text>
                  </View>
                )}
              </View>
              {mentor.rankAchieved && (
                <Text className="mt-1 text-sm font-medium text-primary">
                  Rank {mentor.rankAchieved}
                </Text>
              )}
              <Text className="mt-1 text-sm text-muted">
                ₹{mentor.hourlyRateInr}/hr · {mentor.languages.join(', ')}
              </Text>
            </View>
          </View>

          {/* Stats row */}
          <View className="mt-4 flex-row rounded-xl border border-border bg-accent overflow-hidden">
            <Stat label="Mentees" value={mentor.metrics.mentees} />
            <View className="w-px bg-border" />
            <Stat label="Chats" value={mentor.metrics.chats} />
            <View className="w-px bg-border" />
            <Stat label="Sessions" value={mentor.metrics.sessions} />
          </View>
        </View>

        <View className="gap-4 p-5">
          {/* Journey timeline */}
          {history.length > 0 && (
            <View className="rounded-2xl border border-border bg-white p-5">
              <Text className="mb-3 text-sm font-semibold text-foreground">UPSC journey</Text>
              <View className="gap-3">
                {history.map((h, i) => (
                  <View key={i} className="flex-row gap-3">
                    {/* Timeline dot + line */}
                    <View className="items-center">
                      <View className="h-5 w-5 items-center justify-center rounded-full bg-primary">
                        <Text style={{ color: '#ffffff', fontSize: 9, fontWeight: '700' }}>
                          {h.year % 100}
                        </Text>
                      </View>
                      {i < history.length - 1 && (
                        <View className="mt-1 flex-1 w-px bg-border" />
                      )}
                    </View>
                    <View className="flex-1 pb-3">
                      <Text className="text-sm font-semibold text-foreground">{h.year}</Text>
                      <Text className="text-xs text-muted">{yearBadge(h)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Guidance categories */}
          {mentor.guidanceCategories.length > 0 && (
            <View className="rounded-2xl border border-border bg-white p-5">
              <Text className="mb-3 text-sm font-semibold text-foreground">Comfortable guiding</Text>
              <View className="flex-row flex-wrap gap-2">
                {mentor.guidanceCategories.map((c) => (
                  <View key={c} className="rounded-full bg-accent px-3 py-1">
                    <Text className="text-xs text-foreground">{c}</Text>
                  </View>
                ))}
              </View>
              {mentor.optionalSubject && (
                <Text className="mt-3 text-sm text-muted">
                  Optional:{' '}
                  <Text className="font-medium text-primary">{mentor.optionalSubject}</Text>
                </Text>
              )}
            </View>
          )}

          {/* Reviews */}
          <View className="rounded-2xl border border-border bg-white p-5">
            <Text className="mb-1 text-sm font-semibold text-foreground">What mentees say</Text>
            <Text className="mb-3 text-xs text-muted">{COPY.rateHumans}</Text>
            {mentor.reviews.length === 0 ? (
              <Text className="text-sm text-muted">No reviews yet.</Text>
            ) : (
              mentor.reviews.map((r) => (
                <View key={r.id} className="mb-4 flex-row items-start gap-3">
                  <LetterAvatar
                    letter={r.author.avatarLetter}
                    color={r.author.avatarColor}
                    size={28}
                  />
                  <View className="flex-1">
                    <Text className="text-sm text-foreground">{r.body}</Text>
                    <Text className="mt-1 text-xs text-muted">
                      {r.author.displayHandle} ·{' '}
                      {new Date(r.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* Anonymity reassurance footer */}
          <View className="flex-row items-start gap-3 rounded-2xl border border-border bg-violet-50 p-4">
            <Shield size={16} color="#6d28d9" strokeWidth={2} />
            <Text className="flex-1 text-xs leading-relaxed text-violet-800">
              {COPY.mentorAnonymity}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Sticky CTA */}
      <View className="border-t border-border bg-white px-4 py-3 gap-2">
        <Pressable
          onPress={() => setShowRequest(true)}
          className="rounded-xl bg-primary px-4 py-3.5"
        >
          <Text className="text-center text-base font-semibold text-white">
            Initiate connection
          </Text>
        </Pressable>
        <Pressable disabled className="rounded-xl bg-amber-500/60 px-4 py-3 opacity-60">
          <Text className="text-center text-sm font-medium text-white">
            Request 1-on-1 session (coming soon)
          </Text>
        </Pressable>
      </View>

      {/* Request modal */}
      <Modal
        visible={showRequest}
        animationType="slide"
        transparent
        onRequestClose={() => setShowRequest(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="rounded-t-3xl bg-white px-5 pt-5 pb-8">
            {sent ? (
              <View className="py-4">
                <Text className="text-center text-base font-semibold text-foreground">
                  Request sent.
                </Text>
                <Text className="mt-2 text-center text-sm text-muted">
                  When the mentor accepts, your conversation will appear in Chats.
                </Text>
              </View>
            ) : (
              <>
                {/* Handle bar */}
                <View className="mb-4 h-1 w-10 self-center rounded-full bg-border" />
                <Text className="text-lg font-bold text-foreground">Send an intro</Text>
                <Text className="mt-1 text-sm text-muted">
                  160 characters. Be honest. Tell them what you need.
                </Text>
                <TextInput
                  value={intro}
                  onChangeText={(t) => setIntro(t.slice(0, 160))}
                  multiline
                  placeholder="Hi, I'm preparing for Prelims and struggling with…"
                  placeholderTextColor="#94a3b8"
                  className="mt-3 h-28 rounded-xl border border-border bg-white p-3 text-base text-foreground"
                />
                <Text className="mt-1 text-right text-xs text-muted">{intro.length}/160</Text>
                {error && <Text className="mt-2 text-sm text-destructive">{error}</Text>}
                <View className="mt-4 flex-row gap-2">
                  <Pressable
                    onPress={() => setShowRequest(false)}
                    className="flex-1 rounded-xl border border-border px-4 py-3"
                  >
                    <Text className="text-center font-medium text-foreground">Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={send}
                    disabled={!intro.trim() || busy}
                    className={`flex-1 rounded-xl px-4 py-3 ${
                      !intro.trim() || busy ? 'bg-border' : 'bg-primary'
                    }`}
                  >
                    <Text className="text-center font-semibold text-white">
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
    <View className="flex-1 items-center py-3">
      <Text className="text-xl font-bold text-foreground">{value}</Text>
      <Text className="text-xs text-muted">{label}</Text>
    </View>
  )
}
