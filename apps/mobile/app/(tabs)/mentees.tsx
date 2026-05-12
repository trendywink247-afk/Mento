import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Users } from 'lucide-react-native'
import { getApiClient } from '@/lib/api'
import { useAuthStore } from '@/lib/auth-store'
import { LetterAvatar } from '@/components/LetterAvatar'
import { MENTEES_COPY } from '@/lib/copy'

interface MenteeRow {
  conversationId: string
  lastMessageAt: string
  unreadCount: number
  sharedJournalId: string | null
  aspirant: {
    id: string
    displayHandle: string
    avatarLetter: string
    avatarColor: string
    hasPurpleTick: boolean
  }
  lastMessage: {
    id: string
    body: string | null
    senderId: string
    createdAt: string
  } | null
}

function relativeTime(iso: string): string {
  const date = new Date(iso)
  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export default function MenteesScreen() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const hasHydrated = useAuthStore((s) => s.hydrated)
  const [rows, setRows] = useState<MenteeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!hasHydrated) return
    if (user?.role !== 'MENTOR') return
    setLoading(true)
    getApiClient()
      .mentors.listMentees()
      .then((data) => setRows(data as MenteeRow[]))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [hasHydrated, user])

  const filtered = useMemo(
    () =>
      rows.filter((r) =>
        r.aspirant.displayHandle.toLowerCase().includes(search.toLowerCase()),
      ),
    [rows, search],
  )

  // Non-mentor: show redirect hint
  if (hasHydrated && user?.role !== 'MENTOR') {
    return (
      <View className="flex-1 items-center justify-center bg-white px-8">
        <Text className="text-center text-sm text-gray-500">
          This section is only available to mentors.
        </Text>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View className="border-b border-gray-100 px-4 pb-3 pt-4">
        <View className="flex-row items-center gap-2">
          <Text className="text-xl font-semibold text-gray-900">My mentees</Text>
          {!loading && (
            <View className="rounded-full bg-blue-50 px-2 py-0.5">
              <Text className="text-xs font-semibold text-blue-600">{rows.length}</Text>
            </View>
          )}
        </View>
        {/* Search */}
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by handle…"
          className="mt-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900"
          placeholderTextColor="#94a3b8"
        />
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : filtered.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Users size={48} color="#cbd5e1" />
          <Text className="mt-4 text-base font-semibold text-gray-700">No mentees yet</Text>
          <Text className="mt-1 text-center text-sm text-gray-400">
            {MENTEES_COPY.myMenteesEmpty}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(r) => r.conversationId}
          contentContainerStyle={{ paddingBottom: 24 }}
          renderItem={({ item: row }) => (
            <Pressable
              onPress={() => router.push(`/(tabs)/chat/${row.conversationId}` as never)}
              className="flex-row items-center gap-3 border-b border-gray-50 px-4 py-3"
            >
              <LetterAvatar
                letter={row.aspirant.avatarLetter as never}
                color={row.aspirant.avatarColor as never}
                hasPurpleTick={row.aspirant.hasPurpleTick}
                size={44}
              />

              <View className="min-w-0 flex-1">
                <View className="flex-row items-center gap-2">
                  <Text className="text-sm font-semibold text-gray-900" numberOfLines={1}>
                    {row.aspirant.displayHandle}
                  </Text>
                  {row.unreadCount > 0 && (
                    <View className="rounded-full bg-blue-600 px-1.5 py-0.5">
                      <Text className="text-[10px] font-bold text-white">{row.unreadCount}</Text>
                    </View>
                  )}
                </View>
                <Text className="mt-0.5 text-xs text-gray-400" numberOfLines={1}>
                  {row.lastMessage?.body ? row.lastMessage.body.slice(0, 60) : 'No messages yet'}
                </Text>
              </View>

              <Text className="shrink-0 text-xs text-gray-300">
                {relativeTime(row.lastMessageAt)}
              </Text>
            </Pressable>
          )}
        />
      )}
    </View>
  )
}
