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
import type { ConversationSummary } from '@mento/types'
import { getApiClient } from '@/lib/api'
import { LetterAvatar } from '@/components/LetterAvatar'

export default function ChatList() {
  const [convs, setConvs] = useState<ConversationSummary[] | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      setError(null)
      const rows = await getApiClient().chat.listConversations()
      setConvs(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    }
  }

  useEffect(() => {
    void load()
  }, [])

  if (!convs && !error) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      {error && <Text className="px-6 py-3 text-sm text-red-600">{error}</Text>}
      <FlatList
        data={convs ?? []}
        keyExtractor={(c) => c.id}
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
        ListEmptyComponent={() =>
          convs ? (
            <View className="px-6 pt-12">
              <Text className="text-center text-sm text-muted">
                No conversations yet. An admin will assign you a mentor or aspirant soon.
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/(tabs)/chat/[id]', params: { id: item.id } })}
            className="flex-row items-start gap-3 border-b border-gray-100 px-4 py-4 active:bg-gray-50"
          >
            <LetterAvatar
              letter={item.counterpart.avatarLetter}
              color={item.counterpart.avatarColor}
              hasPurpleTick={item.counterpart.hasPurpleTick}
              size={44}
            />
            <View className="flex-1">
              <View className="flex-row justify-between">
                <Text className="text-base font-medium">{item.counterpart.displayHandle}</Text>
                <Text className="text-xs text-muted">
                  {item.lastMessageAt ? formatTime(item.lastMessageAt) : ''}
                </Text>
              </View>
              <Text numberOfLines={1} className="mt-1 text-sm text-muted">
                {item.lastMessage?.body ?? 'No messages yet'}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  )
}

function formatTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString()
}
