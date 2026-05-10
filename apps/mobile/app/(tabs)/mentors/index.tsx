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
import type { AvatarColor, AvatarLetter } from '@mento/types'
import { getApiClient } from '@/lib/api'
import { LetterAvatar } from '@/components/LetterAvatar'

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
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verifiedOnly])

  if (!mentors) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-4 pt-4">
        <Text className="text-2xl font-bold tracking-tight">Mentors</Text>
        <Text className="mt-1 text-xs text-muted">
          Verified, anonymous mentors who've walked the UPSC path.
        </Text>
        <View className="mt-3 flex-row gap-2">
          <Pressable
            onPress={() => setVerifiedOnly(!verifiedOnly)}
            className={`rounded-full border px-3 py-1 ${
              verifiedOnly ? 'border-primary bg-primary' : 'border-gray-300 bg-white'
            }`}
          >
            <Text className={verifiedOnly ? 'text-xs text-white' : 'text-xs'}>Verified only</Text>
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
            onPress={() => router.push({ pathname: '/(tabs)/mentors/[id]', params: { id: item.userId } })}
            className="rounded-2xl border border-gray-200 bg-white p-4 active:bg-gray-50"
          >
            <View className="flex-row items-start gap-3">
              <LetterAvatar
                letter={item.avatarLetter}
                color={item.avatarColor}
                hasPurpleTick={item.hasPurpleTick}
                size={48}
              />
              <View className="flex-1">
                <View className="flex-row items-center gap-2">
                  <Text className="text-base font-medium">{item.displayHandle}</Text>
                  {item.isVerified && (
                    <View className="rounded-full bg-emerald-100 px-2 py-0.5">
                      <Text className="text-[10px] font-medium text-emerald-700">Verified</Text>
                    </View>
                  )}
                </View>
                <Text className="mt-1 text-xs text-muted">
                  {item.interviewAttempts > 0
                    ? `Interview · ${item.interviewAttempts}×`
                    : item.mainsAttempts > 0
                      ? `Mains · ${item.mainsAttempts}×`
                      : item.prelimsCleared
                        ? 'Prelims cleared'
                        : 'Aspirant'}
                  {item.rankAchieved ? ` · Rank ${item.rankAchieved}` : ''}
                </Text>
                {item.guidanceCategories.length > 0 && (
                  <Text className="mt-1 text-xs text-muted">
                    {item.guidanceCategories.slice(0, 4).join(' · ')}
                  </Text>
                )}
                <Text className="mt-1 text-xs text-muted">
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
