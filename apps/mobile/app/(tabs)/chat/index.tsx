import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  Text,
  View,
} from 'react-native'
import { router } from 'expo-router'
import { Inbox, Clock, Send, Archive, type LucideIcon } from 'lucide-react-native'
import type { ConversationSummary, AvatarLetter, AvatarColor } from '@mento/types'
import { getApiClient } from '@/lib/api'
import { useAuthStore } from '@/lib/auth-store'
import { LetterAvatar } from '@/components/LetterAvatar'

// ─── Types ────────────────────────────────────────────────────────────────────

type ChatRequestStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'ARCHIVED' | 'EXPIRED'

interface ChatRequest {
  id: string
  intro: string
  status: ChatRequestStatus
  createdAt: string
  respondedAt: string | null
  expiresAt: string | null
  conversationId: string | null
  counterpart: {
    id: string
    displayHandle: string
    avatarLetter: AvatarLetter
    avatarColor: AvatarColor
    hasPurpleTick: boolean
  }
}

type Tab = 'all' | 'pending' | 'sent' | 'archived'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString()
}

// ─── Tab button ───────────────────────────────────────────────────────────────

function TabButton({
  id,
  label,
  Icon,
  count,
  active,
  onPress,
}: {
  id: Tab
  label: string
  Icon: LucideIcon
  count?: number
  active: boolean
  onPress: () => void
}) {
  const PRIMARY = '#2563eb'
  const MUTED = '#64748b'
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingVertical: 10,
        borderBottomWidth: 2,
        borderBottomColor: active ? PRIMARY : 'transparent',
      }}
    >
      <Icon size={15} color={active ? PRIMARY : MUTED} strokeWidth={active ? 2.5 : 2} />
      <Text
        style={{
          fontSize: 13,
          fontWeight: active ? '600' : '400',
          color: active ? PRIMARY : MUTED,
        }}
      >
        {label}
      </Text>
      {count !== undefined && count > 0 && (
        <View
          style={{
            backgroundColor: active ? '#dbeafe' : '#f1f5f9',
            borderRadius: 99,
            paddingHorizontal: 5,
            paddingVertical: 1,
            minWidth: 18,
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              fontSize: 10,
              fontWeight: '600',
              color: active ? PRIMARY : MUTED,
            }}
          >
            {count}
          </Text>
        </View>
      )}
    </Pressable>
  )
}

// ─── Empty states ─────────────────────────────────────────────────────────────

function EmptyAll() {
  return (
    <View className="mx-4 mt-8 rounded-2xl border border-border bg-white p-8">
      <Text className="text-center text-base font-medium text-foreground">No conversations yet.</Text>
      <Text className="mt-2 text-center text-sm text-muted">
        Browse mentors and send a 160-character intro to get started.
      </Text>
      <Pressable
        onPress={() => router.push('/(tabs)/mentors')}
        className="mx-auto mt-5 rounded-xl bg-primary px-5 py-2.5"
      >
        <Text className="text-sm font-medium text-white">Browse mentors</Text>
      </Pressable>
    </View>
  )
}

function EmptyPending() {
  return (
    <View className="mx-4 mt-8 rounded-2xl border border-border bg-white p-8">
      <Text className="text-center text-base font-medium text-foreground">No pending requests.</Text>
      <Text className="mt-2 text-center text-sm text-muted">
        When an aspirant sends you a chat request, it will appear here.
      </Text>
    </View>
  )
}

function EmptySent() {
  return (
    <View className="mx-4 mt-8 rounded-2xl border border-border bg-white p-8">
      <Text className="text-center text-base font-medium text-foreground">
        You haven't sent any requests yet.
      </Text>
      <Text className="mt-2 text-center text-sm text-muted">
        Find a mentor and send a 160-character intro to get started.
      </Text>
      <Pressable
        onPress={() => router.push('/(tabs)/mentors')}
        className="mx-auto mt-5 rounded-xl bg-primary px-5 py-2.5"
      >
        <Text className="text-sm font-medium text-white">Browse mentors</Text>
      </Pressable>
    </View>
  )
}

function EmptyArchived() {
  return (
    <View className="mx-4 mt-8 rounded-2xl border border-border bg-white p-8">
      <Text className="text-center text-base font-medium text-foreground">Nothing archived yet.</Text>
      <Text className="mt-2 text-center text-sm text-muted">
        Declined or cancelled requests will appear here.
      </Text>
    </View>
  )
}

// ─── Conversation row ─────────────────────────────────────────────────────────

function ConvRow({
  item,
  onLongPress,
}: {
  item: ConversationSummary
  onLongPress: () => void
}) {
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/(tabs)/chat/[id]', params: { id: item.id } })}
      onLongPress={onLongPress}
      delayLongPress={350}
      className="flex-row items-start gap-3 border-b border-border px-4 py-4 active:bg-accent"
    >
      <LetterAvatar
        letter={item.counterpart.avatarLetter}
        color={item.counterpart.avatarColor}
        hasPurpleTick={item.counterpart.hasPurpleTick}
        size={44}
      />
      <View className="flex-1">
        <View className="flex-row justify-between">
          <Text className="text-base font-medium text-foreground">
            {item.counterpart.displayHandle}
          </Text>
          <Text className="text-xs text-muted">
            {item.lastMessageAt ? formatTime(item.lastMessageAt) : ''}
          </Text>
        </View>
        <Text numberOfLines={1} className="mt-1 text-sm text-muted">
          {item.lastMessage?.body ?? 'No messages yet'}
        </Text>
      </View>
    </Pressable>
  )
}

// ─── Request row ──────────────────────────────────────────────────────────────

function RequestRow({
  item,
  isMentor,
  onAction,
}: {
  item: ChatRequest
  isMentor: boolean
  onAction: () => void
}) {
  const [busy, setBusy] = useState(false)

  async function accept() {
    setBusy(true)
    try {
      await getApiClient().chatRequests.accept(item.id)
      onAction()
    } finally {
      setBusy(false)
    }
  }

  async function decline() {
    Alert.alert('Decline request?', 'The aspirant will not be notified.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Decline',
        style: 'destructive',
        onPress: async () => {
          setBusy(true)
          try {
            await getApiClient().chatRequests.decline(item.id)
            onAction()
          } finally {
            setBusy(false)
          }
        },
      },
    ])
  }

  async function cancel() {
    Alert.alert('Cancel request?', 'It will be moved to archived.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel request',
        style: 'destructive',
        onPress: async () => {
          setBusy(true)
          try {
            await getApiClient().chatRequests.archive(item.id)
            onAction()
          } finally {
            setBusy(false)
          }
        },
      },
    ])
  }

  const isArchived = item.status === 'ARCHIVED' || item.status === 'DECLINED'

  return (
    <View
      className={`flex-row items-start gap-3 border-b border-border px-4 py-4 ${isArchived ? 'opacity-70' : ''}`}
    >
      <LetterAvatar
        letter={item.counterpart.avatarLetter}
        color={item.counterpart.avatarColor}
        hasPurpleTick={item.counterpart.hasPurpleTick}
        size={44}
      />
      <View className="flex-1">
        <View className="flex-row items-center justify-between">
          <Text className="text-base font-medium text-foreground">{item.counterpart.displayHandle}</Text>
          {isArchived ? (
            <View className="rounded-full bg-accent px-2 py-0.5">
              <Text className="text-[10px] font-medium uppercase tracking-wide text-muted">
                {item.status}
              </Text>
            </View>
          ) : (
            <Text className="text-xs text-muted">{formatTime(item.createdAt)}</Text>
          )}
        </View>
        <Text className="mt-1 text-sm text-muted">{item.intro}</Text>

        {/* Actions */}
        {!isArchived && (
          <View className="mt-2 flex-row gap-2">
            {isMentor ? (
              <>
                <Pressable
                  onPress={accept}
                  disabled={busy}
                  className="rounded-lg bg-primary px-3 py-1.5 disabled:opacity-50"
                >
                  <Text className="text-xs font-medium text-white">Accept</Text>
                </Pressable>
                <Pressable
                  onPress={decline}
                  disabled={busy}
                  className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-50"
                >
                  <Text className="text-xs font-medium text-foreground">Decline</Text>
                </Pressable>
              </>
            ) : (
              <Pressable
                onPress={cancel}
                disabled={busy}
                className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-50"
              >
                <Text className="text-xs font-medium text-foreground">Cancel request</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </View>
  )
}

// ─── Main screen ───────────────────────────────────────────────────────────────

export default function ChatList() {
  const role = useAuthStore((s) => s.user?.role)
  const isMentor = role === 'MENTOR'

  const [convs, setConvs] = useState<ConversationSummary[] | null>(null)
  const [requests, setRequests] = useState<ChatRequest[] | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('all')

  const load = useCallback(() => {
    setError(null)
    Promise.all([
      getApiClient().chat.listConversations(),
      getApiClient().chatRequests.list(),
    ])
      .then(([c, r]) => {
        setConvs(c)
        setRequests(r as ChatRequest[])
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load')
      })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (!convs && !requests) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        {error ? (
          <Text className="text-sm text-destructive">{error}</Text>
        ) : (
          <ActivityIndicator />
        )}
      </SafeAreaView>
    )
  }

  const pendingRequests = isMentor
    ? (requests ?? []).filter((r) => r.status === 'PENDING')
    : []
  const sentRequests = !isMentor
    ? (requests ?? []).filter((r) => r.status === 'PENDING')
    : []
  const archivedRequests = (requests ?? []).filter(
    (r) => r.status === 'ARCHIVED' || r.status === 'DECLINED',
  )

  const TABS: { id: Tab; label: string; Icon: LucideIcon; count?: number }[] = [
    { id: 'all', label: 'All', Icon: Inbox, count: (convs ?? []).length },
    ...(isMentor
      ? [{ id: 'pending' as const, label: 'Pending', Icon: Clock, count: pendingRequests.length }]
      : [{ id: 'sent' as const, label: 'Sent', Icon: Send, count: sentRequests.length }]),
    { id: 'archived', label: 'Archived', Icon: Archive, count: archivedRequests.length },
  ]

  function showMessageActions(convId: string) {
    Alert.alert('Message options', undefined, [
      {
        text: 'Report message',
        style: 'destructive',
        onPress: () => {
          // Fire-and-forget report — placeholder for MVP
        },
      },
      {
        text: 'Save to journal',
        onPress: () => router.push('/(tabs)/journals'),
      },
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-4 pt-4">
        <Text className="text-2xl font-bold tracking-tight text-foreground">Chats</Text>
      </View>

      {/* Tab bar */}
      <View className="mt-3 flex-row border-b border-border bg-background">
        {TABS.map(({ id, label, Icon, count }) => (
          <TabButton
            key={id}
            id={id}
            label={label}
            Icon={Icon}
            count={count}
            active={tab === id}
            onPress={() => setTab(id)}
          />
        ))}
      </View>

      {/* Content */}
      {tab === 'all' && (
        <FlatList
          data={convs ?? []}
          keyExtractor={(c) => c.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true)
                load()
                setRefreshing(false)
              }}
            />
          }
          ListEmptyComponent={<EmptyAll />}
          renderItem={({ item }) => (
            <ConvRow
              item={item}
              onLongPress={() => showMessageActions(item.id)}
            />
          )}
        />
      )}

      {tab === 'pending' && (
        <FlatList
          data={pendingRequests}
          keyExtractor={(r) => r.id}
          ListEmptyComponent={<EmptyPending />}
          renderItem={({ item }) => (
            <RequestRow item={item} isMentor={true} onAction={load} />
          )}
        />
      )}

      {tab === 'sent' && (
        <FlatList
          data={sentRequests}
          keyExtractor={(r) => r.id}
          ListEmptyComponent={<EmptySent />}
          renderItem={({ item }) => (
            <RequestRow item={item} isMentor={false} onAction={load} />
          )}
        />
      )}

      {tab === 'archived' && (
        <FlatList
          data={archivedRequests}
          keyExtractor={(r) => r.id}
          ListEmptyComponent={<EmptyArchived />}
          renderItem={({ item }) => (
            <RequestRow item={item} isMentor={isMentor} onAction={load} />
          )}
        />
      )}
    </SafeAreaView>
  )
}
