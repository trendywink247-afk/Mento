import { useEffect, useState } from 'react'
import { Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native'
import { router } from 'expo-router'
import type { AvatarColor, AvatarLetter } from '@mento/types'
import { getApiClient } from '@/lib/api'
import { LetterAvatar } from '@/components/LetterAvatar'

const CATEGORIES = [
  { label: 'Personal', items: [{ key: 'PERSONAL', name: 'Personal' }] },
  {
    label: 'Prelims',
    items: [
      { key: 'PRELIMS_POLITY', name: 'Polity' },
      { key: 'PRELIMS_HISTORY', name: 'History' },
      { key: 'PRELIMS_GEOGRAPHY', name: 'Geography' },
      { key: 'PRELIMS_ECONOMY', name: 'Economy' },
      { key: 'PRELIMS_ENVIRONMENT', name: 'Environment' },
      { key: 'PRELIMS_SCI_TECH', name: 'Sci-Tech' },
      { key: 'PRELIMS_CSAT', name: 'CSAT' },
      { key: 'PRELIMS_CURRENT_AFFAIRS', name: 'Current affairs' },
    ],
  },
  {
    label: 'Mains',
    items: [
      { key: 'MAINS_GS1', name: 'GS1' },
      { key: 'MAINS_GS2', name: 'GS2' },
      { key: 'MAINS_GS3', name: 'GS3' },
      { key: 'MAINS_GS4', name: 'GS4' },
      { key: 'MAINS_ESSAY', name: 'Essay' },
      { key: 'MAINS_OPTIONAL', name: 'Optional' },
    ],
  },
  { label: 'Interview', items: [{ key: 'INTERVIEW', name: 'Interview' }] },
] as const

type Existing = {
  id: string
  category: string
  isShared: boolean
  isLocked: boolean
  entryCount: number
  sharedWith: {
    id: string
    displayHandle: string
    avatarLetter: AvatarLetter
    avatarColor: AvatarColor
  } | null
}

export default function JournalsList() {
  const [existing, setExisting] = useState<Existing[]>([])

  useEffect(() => {
    getApiClient()
      .journals.list()
      .then((rows) => setExisting(rows as Existing[]))
      .catch(() => {})
  }, [])

  async function open(category: string) {
    const j = await getApiClient().journals.upsert(category)
    router.push({ pathname: '/(tabs)/journals/[id]', params: { id: j.id } })
  }

  const sharedJournals = existing.filter((j) => j.isShared)

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView contentContainerStyle={{ padding: 20, gap: 24 }}>
        <View>
          <Text className="text-2xl font-bold tracking-tight">Journals</Text>
          <Text className="mt-1 text-sm text-muted">
            Reflect privately, or together with a mentor.
          </Text>
        </View>

        {sharedJournals.length > 0 && (
          <View className="gap-3">
            <Text className="text-sm font-medium text-muted">Shared with mentors</Text>
            {sharedJournals.map((j) => (
              <Pressable
                key={j.id}
                onPress={() => router.push({ pathname: '/(tabs)/journals/[id]', params: { id: j.id } })}
                className="flex-row items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 active:bg-gray-50"
              >
                {j.sharedWith && (
                  <LetterAvatar
                    letter={j.sharedWith.avatarLetter}
                    color={j.sharedWith.avatarColor}
                    size={36}
                  />
                )}
                <View className="flex-1">
                  <Text className="text-sm font-medium">
                    With {j.sharedWith?.displayHandle ?? '—'}
                  </Text>
                  <Text className="text-xs text-muted">
                    {j.entryCount} entries · {j.isLocked ? 'Locked' : 'Active'}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {CATEGORIES.map((g) => (
          <View key={g.label} className="gap-3">
            <Text className="text-sm font-medium text-muted">{g.label}</Text>
            <View className="flex-row flex-wrap gap-2">
              {g.items.map((it) => {
                const exists = existing.find((j) => j.category === it.key && !j.isShared)
                return (
                  <Pressable
                    key={it.key}
                    onPress={() => open(it.key)}
                    className="flex-1 min-w-[45%] rounded-xl border border-gray-200 bg-white p-3 active:bg-gray-50"
                  >
                    <Text className="text-sm font-medium">{it.name}</Text>
                    <Text className="mt-1 text-xs text-muted">
                      {exists ? `${exists.entryCount} entries` : 'Start your first entry'}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}
