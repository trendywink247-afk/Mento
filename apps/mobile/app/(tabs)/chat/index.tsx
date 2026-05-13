import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  Text,
  ToastAndroid,
  View,
  Platform,
} from 'react-native'
import { router } from 'expo-router'
import { Inbox, Clock, Send, Archive, type LucideIcon } from 'lucide-react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated'
import { Swipeable } from 'react-native-gesture-handler'
import type { ConversationSummary, AvatarLetter, AvatarColor } from '@mento/types'
import { getApiClient } from '@/lib/api'
import { useAuthStore } from '@/lib/auth-store'
import { LetterAvatar } from '@/components/LetterAvatar'
import { CHAT_TABS_COPY, CHAT_ARCHIVE_COPY } from '@/lib/copy'

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

type ConversationSummaryWithArchive = ConversationSummary & {
  archivedByMentee?: boolean
  archivedByMentor?: boolean
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

function showToast(msg: string) {
  if (Platform.OS === 'android') {
    ToastAndroid.show(msg, ToastAndroid.SHORT)
  }
  // On iOS we use an Alert for simplicity (no native toast API without a dep)
}

// ─── Animated tab indicator ───────────────────────────────────────────────────

function PillTabBar({
  tabs,
  active,
  onPress,
}: {
  tabs: { id: Tab; label: string; Icon: LucideIcon; count?: number }[]
  active: Tab
  onPress: (id: Tab) => void
}) {
  const PRIMARY = '#2563eb'
  const MUTED = '#64748b'

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 12, gap: 8, flexDirection: 'row', alignItems: 'center' }}
      style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }}
    >
      {tabs.map(({ id, label, Icon, count }) => {
        const isActive = active === id
        return (
          <Pressable
            key={id}
            onPress={() => onPress(id)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 99,
              backgroundColor: isActive ? '#dbeafe' : '#f1f5f9',
              minHeight: 36,
            }}
          >
            <Icon size={14} color={isActive ? PRIMARY : MUTED} strokeWidth={isActive ? 2.5 : 2} />
            <Text
              style={{
                fontSize: 13,
                fontWeight: isActive ? '600' : '400',
                color: isActive ? PRIMARY : MUTED,
              }}
            >
              {label}
            </Text>
            {count !== undefined && count > 0 && (
              <View
                style={{
                  backgroundColor: isActive ? '#bfdbfe' : '#e2e8f0',
                  borderRadius: 99,
                  paddingHorizontal: 5,
                  minWidth: 18,
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '600',
                    color: isActive ? PRIMARY : MUTED,
                  }}
                >
                  {count}
                </Text>
              </View>
            )}
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

// ─── Swipe action ─────────────────────────────────────────────────────────────

function ArchiveAction({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: '#f59e0b',
        justifyContent: 'center',
        alignItems: 'center',
        width: 80,
      }}
    >
      <Archive size={20} color="#fff" />
      <Text style={{ color: '#fff', fontSize: 11, marginTop: 3, fontWeight: '600' }}>Archive</Text>
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

// ─── Skeleton row ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  const opacity = useSharedValue(0.4)
  const animStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      Math.sin(Date.now() / 600),
      [-1, 1],
      [0.4, 0.8],
      Extrapolation.CLAMP,
    ),
  }))

  return (
    <Animated.View style={[animStyle, { flexDirection: 'row', gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }]}>
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#e2e8f0' }} />
      <View style={{ flex: 1, gap: 8 }}>
        <View style={{ width: '60%', height: 14, borderRadius: 6, backgroundColor: '#e2e8f0' }} />
        <View style={{ width: '80%', height: 12, borderRadius: 6, backgroundColor: '#f1f5f9' }} />
      </View>
    </Animated.View>
  )
}

// ─── Conversation row (swipeable) ─────────────────────────────────────────────

function ConvRow({
  item,
  onLongPress,
  onArchive,
}: {
  item: ConversationSummaryWithArchive
  onLongPress: () => void
  onArchive: () => void
}) {
  const swipeRef = useRef<Swipeable>(null)

  function handleArchive() {
    swipeRef.current?.close()
    onArchive()
  }

  return (
    <Swipeable
      ref={swipeRef}
      friction={2}
      overshootRight={false}
      renderRightActions={() => <ArchiveAction onPress={handleArchive} />}
    >
      <Pressable
        onPress={() => router.push({ pathname: '/(tabs)/chat/[id]', params: { id: item.id } })}
        onLongPress={onLongPress}
        delayLongPress={350}
        className="flex-row items-start gap-3 border-b border-border bg-white px-4 py-4 active:bg-accent"
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
    </Swipeable>
  )
}

// ─── Request row ──────────────────────────────────────────────────────────────

function RequestRow({
  item,
  isMentor,
  onAction,
  onArchive,
}: {
  item: ChatRequest
  isMentor: boolean
  onAction: () => void
  onArchive?: () => void
}) {
  const [busy, setBusy] = useState(false)
  const swipeRef = useRef<Swipeable>(null)

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

  function handleSwipeArchive() {
    swipeRef.current?.close()
    onArchive?.()
  }

  const isArchived = item.status === 'ARCHIVED' || item.status === 'DECLINED'
  const canSwipeArchive = !isArchived && onArchive

  const inner = (
    <View
      className={`flex-row items-start gap-3 border-b border-border bg-white px-4 py-4 ${isArchived ? 'opacity-70' : ''}`}
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

  if (canSwipeArchive) {
    return (
      <Swipeable
        ref={swipeRef}
        friction={2}
        overshootRight={false}
        renderRightActions={() => <ArchiveAction onPress={handleSwipeArchive} />}
      >
        {inner}
      </Swipeable>
    )
  }

  return inner
}

// ─── Main screen ───────────────────────────────────────────────────────────────

export default function ChatList() {
  const role = useAuthStore((s) => s.user?.role)
  const isMentor = role === 'MENTOR'

  const [convs, setConvs] = useState<ConversationSummaryWithArchive[] | null>(null)
  const [requests, setRequests] = useState<ChatRequest[] | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('all')

  const load = useCallback(async (): Promise<void> => {
    setError(null)
    try {
      const [c, r] = await Promise.all([
        getApiClient().chat.listConversations(),
        getApiClient().chatRequests.list(),
      ])
      setConvs(c as ConversationSummaryWithArchive[])
      setRequests(r as ChatRequest[])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // ─── Derived lists ───────────────────────────────────────────────────────────

  const activeConvs = (convs ?? []).filter((c) => {
    if (isMentor) return !c.archivedByMentor
    return !c.archivedByMentee
  })

  const archivedConvs = (convs ?? []).filter((c) => {
    if (isMentor) return c.archivedByMentor
    return c.archivedByMentee
  })

  const pendingRequests = isMentor
    ? (requests ?? []).filter((r) => r.status === 'PENDING')
    : []
  const sentRequests = !isMentor
    ? (requests ?? []).filter((r) => r.status === 'PENDING')
    : []
  const archivedRequests = (requests ?? []).filter(
    (r) => r.status === 'ARCHIVED' || r.status === 'DECLINED',
  )

  // ─── Archive handlers ────────────────────────────────────────────────────────

  async function archiveConversation(id: string) {
    // Optimistic update
    setConvs((prev) =>
      prev
        ? prev.map((c) =>
            c.id === id
              ? { ...c, archivedByMentee: !isMentor || c.archivedByMentee, archivedByMentor: isMentor || c.archivedByMentor }
              : c,
          )
        : prev,
    )
    showToast(CHAT_ARCHIVE_COPY.toast)
    try {
      await getApiClient().chat.archiveConversation(id)
    } catch {
      // Revert on failure
      load()
    }
  }

  async function archiveRequest(id: string) {
    // Optimistic update
    setRequests((prev) =>
      prev ? prev.map((r) => (r.id === id ? { ...r, status: 'ARCHIVED' as ChatRequestStatus } : r)) : prev,
    )
    showToast(CHAT_ARCHIVE_COPY.toast)
    try {
      await getApiClient().chatRequests.archive(id)
    } catch {
      load()
    }
  }

  // ─── Tabs definition ─────────────────────────────────────────────────────────

  const TABS: { id: Tab; label: string; Icon: LucideIcon; count?: number }[] = [
    { id: 'all', label: CHAT_TABS_COPY.all, Icon: Inbox, count: activeConvs.length },
    ...(isMentor
      ? [{ id: 'pending' as const, label: CHAT_TABS_COPY.pending, Icon: Clock, count: pendingRequests.length }]
      : [{ id: 'sent' as const, label: CHAT_TABS_COPY.sent, Icon: Send, count: sentRequests.length }]),
    { id: 'archived', label: CHAT_TABS_COPY.archived, Icon: Archive, count: archivedConvs.length + archivedRequests.length },
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

  // ─── Loading skeleton ─────────────────────────────────────────────────────────

  if (!convs && !requests) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="px-4 pt-4">
          <Text className="text-2xl font-bold tracking-tight text-foreground">Chats</Text>
        </View>
        {error ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-sm text-destructive">{error}</Text>
          </View>
        ) : (
          <View className="mt-3">
            {[0, 1, 2, 3].map((i) => <SkeletonRow key={i} />)}
          </View>
        )}
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-4 pt-4">
        <Text className="text-2xl font-bold tracking-tight text-foreground">Chats</Text>
      </View>

      {/* Pill tab bar */}
      <PillTabBar tabs={TABS} active={tab} onPress={setTab} />

      {/* Content */}
      {tab === 'all' && (
        <FlatList
          data={activeConvs}
          keyExtractor={(c) => c.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true)
                try {
                  await load()
                } finally {
                  setRefreshing(false)
                }
              }}
            />
          }
          ListEmptyComponent={<EmptyAll />}
          renderItem={({ item }) => (
            <ConvRow
              item={item}
              onLongPress={() => showMessageActions(item.id)}
              onArchive={() => archiveConversation(item.id)}
            />
          )}
        />
      )}

      {tab === 'pending' && (
        <FlatList
          data={pendingRequests}
          keyExtractor={(r) => r.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true)
                try {
                  await load()
                } finally {
                  setRefreshing(false)
                }
              }}
            />
          }
          ListEmptyComponent={<EmptyPending />}
          renderItem={({ item }) => (
            <RequestRow
              item={item}
              isMentor={true}
              onAction={load}
              onArchive={() => archiveRequest(item.id)}
            />
          )}
        />
      )}

      {tab === 'sent' && (
        <FlatList
          data={sentRequests}
          keyExtractor={(r) => r.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true)
                try {
                  await load()
                } finally {
                  setRefreshing(false)
                }
              }}
            />
          }
          ListEmptyComponent={<EmptySent />}
          renderItem={({ item }) => (
            <RequestRow
              item={item}
              isMentor={false}
              onAction={load}
              onArchive={() => archiveRequest(item.id)}
            />
          )}
        />
      )}

      {tab === 'archived' && (
        <FlatList
          data={[
            ...archivedConvs.map((c) => ({ type: 'conv' as const, data: c })),
            ...archivedRequests.map((r) => ({ type: 'req' as const, data: r })),
          ]}
          keyExtractor={(item) => item.data.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true)
                try {
                  await load()
                } finally {
                  setRefreshing(false)
                }
              }}
            />
          }
          ListEmptyComponent={<EmptyArchived />}
          renderItem={({ item }) => {
            if (item.type === 'conv') {
              return (
                <ConvRow
                  item={item.data as ConversationSummaryWithArchive}
                  onLongPress={() => showMessageActions(item.data.id)}
                  onArchive={() => {}}
                />
              )
            }
            return (
              <RequestRow
                item={item.data as ChatRequest}
                isMentor={isMentor}
                onAction={load}
              />
            )
          }}
        />
      )}
    </SafeAreaView>
  )
}
