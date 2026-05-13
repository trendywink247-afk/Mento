import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  Text,
  View,
} from 'react-native'
import { router } from 'expo-router'
import { BadgeCheck, SlidersHorizontal } from 'lucide-react-native'
import type { AvatarColor, AvatarLetter } from '@mento/types'
import { getApiClient } from '@/lib/api'
import { LetterAvatar } from '@/components/LetterAvatar'
import { capture } from '@/lib/analytics'
import { ANALYTICS_EVENTS } from '@/lib/events'

type Mentor = {
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
  optionalSubject: string | null
  guidanceCategories: string[]
  languages: string[]
  hourlyRateInr: number
  rankAchieved: number | null
}

function trustLine(m: Mentor): string {
  if (m.interviewAttempts > 0) return `Interview · ${m.interviewAttempts}× attended`
  if (m.mainsAttempts > 0) return `Mains · ${m.mainsAttempts}× written`
  if (m.prelimsCleared) return 'Prelims cleared'
  return 'Aspirant mentor'
}

const MUTED = '#64748b'

export default function MentorsList() {
  const [mentors, setMentors] = useState<Mentor[] | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [verifiedOnly, setVerifiedOnly] = useState(false)

  async function load() {
    const rows = await getApiClient()
      .mentors.list({ isVerified: verifiedOnly ? true : undefined })
      .catch(() => [])
    setMentors(rows)
  }

  useEffect(() => {
    capture(ANALYTICS_EVENTS.MENTORS_LIST_VIEWED)
  }, [])

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verifiedOnly])

  if (!mentors) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="px-4 pt-4 pb-2">
        <Text className="text-2xl font-bold tracking-tight text-foreground">Mentors</Text>
        <Text className="mt-1 text-xs text-muted">
          Verified, anonymous mentors who've walked the UPSC path.
        </Text>

        {/* Filter chips */}
        <View className="mt-3 flex-row items-center gap-2">
          <Pressable
            onPress={() => {
              const next = !verifiedOnly
              setVerifiedOnly(next)
              if (next) capture(ANALYTICS_EVENTS.MENTORS_FILTER_APPLIED, { filter: 'verified_only' })
            }}
            className={`flex-row items-center gap-1.5 rounded-full border px-3 py-1.5 ${
              verifiedOnly ? 'border-primary bg-primary' : 'border-border bg-white'
            }`}
          >
            <SlidersHorizontal
              size={12}
              color={verifiedOnly ? '#ffffff' : MUTED}
              strokeWidth={2}
            />
            <Text className={`text-xs font-medium ${verifiedOnly ? 'text-white' : 'text-muted'}`}>
              Verified only
            </Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={mentors}
        keyExtractor={(m) => m.userId}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true)
              await load()
              setRefreshing(false)
            }}
          />
        }
        ListEmptyComponent={() => (
          <View className="items-center pt-12">
            <Text className="text-center text-sm text-muted">
              No mentors match your filters yet. New mentors join every week.
            </Text>
          </View>
        )}
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              router.push({ pathname: '/(tabs)/mentors/[id]', params: { id: item.userId } })
            }
            className="rounded-2xl border border-border bg-white p-4 active:bg-accent"
          >
            <View className="flex-row items-start gap-3">
              <LetterAvatar
                letter={item.avatarLetter}
                color={item.avatarColor}
                hasPurpleTick={item.hasPurpleTick}
                size={48}
              />
              <View className="flex-1">
                {/* Name + verified badge */}
                <View className="flex-row items-center gap-2">
                  <Text className="text-base font-semibold text-foreground">
                    {item.displayHandle}
                  </Text>
                  {item.isVerified && (
                    <BadgeCheck size={16} color="#059669" strokeWidth={2} />
                  )}
                  {item.isFoundingPartner && (
                    <View className="rounded-full bg-amber-100 px-2 py-0.5">
                      <Text className="text-[10px] font-medium text-amber-700">Founding</Text>
                    </View>
                  )}
                </View>

                {/* Trust line */}
                <Text className="mt-0.5 text-xs text-muted">{trustLine(item)}</Text>

                {/* Rank if present */}
                {item.rankAchieved && (
                  <Text className="mt-0.5 text-xs font-medium text-primary">
                    Rank {item.rankAchieved}
                  </Text>
                )}

                {/* Guidance categories */}
                {item.guidanceCategories.length > 0 && (
                  <View className="mt-1.5 flex-row flex-wrap gap-1">
                    {item.guidanceCategories.slice(0, 4).map((c) => (
                      <View key={c} className="rounded-full bg-accent px-2 py-0.5">
                        <Text className="text-[10px] text-muted">{c}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Rate + languages */}
                <Text className="mt-1.5 text-xs text-muted">
                  ₹{item.hourlyRateInr}/hr · {item.languages.join(', ')}
                </Text>
              </View>
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  )
}
