import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { useLocalSearchParams, useNavigation } from 'expo-router'
import { Search, X, ChevronUp, ChevronDown } from 'lucide-react-native'
import type { Message } from '@mento/types'
import { getApiClient } from '@/lib/api'
import { getSocket } from '@/lib/socket'
import { useAuthStore } from '@/lib/auth-store'
import { uuid } from '@/lib/uuid'
import { MENTEES_COPY, CHAT_SEARCH_COPY } from '@/lib/copy'

interface JournalItem {
  id: string
  category: string
  title: string | null
}

// ---- Category picker bottom sheet ----

function CategoryPicker({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean
  onClose: () => void
  onPick: (journal: JournalItem) => void
}) {
  const [journals, setJournals] = useState<JournalItem[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!visible) return
    setLoading(true)
    getApiClient()
      .journals.list()
      .then((data) =>
        setJournals(
          data
            .filter((j) => !j.isShared && !j.isLocked)
            .map((j) => ({ id: j.id, category: j.category, title: j.title })),
        ),
      )
      .catch(() => setJournals([]))
      .finally(() => setLoading(false))
  }, [visible])

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 bg-black/40"
        onPress={onClose}
      />
      <View className="rounded-t-2xl bg-white px-4 pb-8 pt-4">
        <View className="mb-4 flex-row items-center justify-between">
          <Text className="text-base font-semibold text-gray-900">Save to journal</Text>
          <TouchableOpacity onPress={onClose}>
            <Text className="text-sm text-blue-600">Cancel</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <Text className="py-4 text-center text-sm text-gray-400">Loading…</Text>
        ) : journals.length === 0 ? (
          <Text className="py-4 text-center text-sm text-gray-400">
            No personal journals. Create one from the Journals tab first.
          </Text>
        ) : (
          journals.map((j) => (
            <TouchableOpacity
              key={j.id}
              onPress={() => onPick(j)}
              className="border-b border-gray-100 py-3"
            >
              <Text className="text-sm capitalize text-gray-900">
                {j.title ?? j.category.replace(/_/g, ' ').toLowerCase()}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </View>
    </Modal>
  )
}

// ─── Highlight matched text ────────────────────────────────────────────────────

function HighlightText({
  text,
  query,
  isMyMessage,
  isCurrent,
}: {
  text: string
  query: string
  isMyMessage: boolean
  isCurrent: boolean
}) {
  if (!query) {
    return <Text className={isMyMessage ? 'text-white' : 'text-gray-900'}>{text}</Text>
  }

  const lower = text.toLowerCase()
  const lowerQ = query.toLowerCase()
  const parts: { str: string; match: boolean }[] = []
  let idx = 0
  while (idx < text.length) {
    const found = lower.indexOf(lowerQ, idx)
    if (found === -1) {
      parts.push({ str: text.slice(idx), match: false })
      break
    }
    if (found > idx) {
      parts.push({ str: text.slice(idx, found), match: false })
    }
    parts.push({ str: text.slice(found, found + query.length), match: true })
    idx = found + query.length
  }

  return (
    <Text>
      {parts.map((p, i) =>
        p.match ? (
          <Text
            key={i}
            style={{
              backgroundColor: isCurrent ? '#f59e0b' : '#fde68a',
              color: '#1e293b',
            }}
          >
            {p.str}
          </Text>
        ) : (
          <Text key={i} className={isMyMessage ? 'text-white' : 'text-gray-900'}>
            {p.str}
          </Text>
        ),
      )}
    </Text>
  )
}

// ─── Search bar (slide-down) ───────────────────────────────────────────────────

function SearchBar({
  visible,
  query,
  onChangeQuery,
  matchCount,
  currentMatch,
  onPrev,
  onNext,
  onClose,
}: {
  visible: boolean
  query: string
  onChangeQuery: (q: string) => void
  matchCount: number
  currentMatch: number
  onPrev: () => void
  onNext: () => void
  onClose: () => void
}) {
  const anim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(anim, {
      toValue: visible ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start()
  }, [visible, anim])

  const height = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 56] })
  const opacity = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] })

  return (
    <Animated.View
      style={{
        height,
        opacity,
        overflow: 'hidden',
        backgroundColor: '#f8fafc',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
      }}
    >
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8 }}>
        <Search size={16} color="#64748b" />
        <TextInput
          value={query}
          onChangeText={onChangeQuery}
          placeholder={CHAT_SEARCH_COPY.placeholder}
          placeholderTextColor="#94a3b8"
          style={{ flex: 1, fontSize: 14, color: '#0f172a', height: 36 }}
          autoFocus={visible}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <Text style={{ fontSize: 12, color: '#64748b', minWidth: 42, textAlign: 'center' }}>
            {matchCount === 0 ? CHAT_SEARCH_COPY.empty : `${currentMatch + 1} / ${matchCount}`}
          </Text>
        )}
        <Pressable onPress={onPrev} hitSlop={8} style={{ padding: 4 }}>
          <ChevronUp size={18} color="#64748b" />
        </Pressable>
        <Pressable onPress={onNext} hitSlop={8} style={{ padding: 4 }}>
          <ChevronDown size={18} color="#64748b" />
        </Pressable>
        <Pressable onPress={onClose} hitSlop={8} style={{ padding: 4 }}>
          <X size={18} color="#64748b" />
        </Pressable>
      </View>
    </Animated.View>
  )
}

// ─── Main screen ───────────────────────────────────────────────────────────────

export default function ChatThread() {
  const params = useLocalSearchParams<{ id: string }>()
  const conversationId = String(params.id ?? '')
  const me = useAuthStore((s) => s.user)
  const navigation = useNavigation()

  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [otherTyping, setOtherTyping] = useState(false)
  const [pickerVisible, setPickerVisible] = useState(false)
  const [pendingMessageId, setPendingMessageId] = useState<string | null>(null)

  // ─── Search state ─────────────────────────────────────────────────────────
  const [searchVisible, setSearchVisible] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0)

  const listRef = useRef<FlatList<Message>>(null)
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ─── Derived: filtered messages for display ───────────────────────────────
  const matchingIds = searchQuery
    ? messages
        .filter((m) => m.body?.toLowerCase().includes(searchQuery.toLowerCase()))
        .map((m) => m.id)
    : []
  const matchCount = matchingIds.length

  const safeCurrentMatchIdx = matchCount === 0 ? 0 : currentMatchIdx % matchCount

  function scrollToMatch(idx: number) {
    if (matchingIds.length === 0) return
    const targetId = matchingIds[idx % matchingIds.length]
    const msgIdx = messages.findIndex((m) => m.id === targetId)
    if (msgIdx >= 0) {
      listRef.current?.scrollToIndex({ index: msgIdx, animated: true, viewPosition: 0.5 })
    }
  }

  function handleNextMatch() {
    const next = (safeCurrentMatchIdx + 1) % Math.max(matchCount, 1)
    setCurrentMatchIdx(next)
    scrollToMatch(next)
  }

  function handlePrevMatch() {
    const prev = (safeCurrentMatchIdx - 1 + Math.max(matchCount, 1)) % Math.max(matchCount, 1)
    setCurrentMatchIdx(prev)
    scrollToMatch(prev)
  }

  function handleCloseSearch() {
    setSearchVisible(false)
    setSearchQuery('')
    setCurrentMatchIdx(0)
  }

  // ─── Header right: search icon ────────────────────────────────────────────
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => setSearchVisible((v) => !v)}
          hitSlop={12}
          style={{ padding: 6, marginRight: 4 }}
        >
          <Search size={20} color="#2563eb" />
        </Pressable>
      ),
    })
  }, [navigation])

  useEffect(() => {
    if (!conversationId) return
    let mounted = true
    getApiClient()
      .chat.getMessages(conversationId, { limit: 50 })
      .then((rows) => mounted && setMessages(rows))
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [conversationId])

  useEffect(() => {
    if (!conversationId) return
    const socket = getSocket()
    socket.connect()

    const onConnect = () => {
      socket.emit('conversation:join', { conversationId })
    }
    const onMessage = (m: Message) => {
      if (m.conversationId !== conversationId) return
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]))
      if (me && m.senderId !== me.id) {
        socket.emit('message:delivered', { messageId: m.id })
      }
    }
    const onStatus = (u: { messageId: string; deliveredAt?: string; readAt?: string }) =>
      setMessages((prev) =>
        prev.map((m) =>
          m.id === u.messageId
            ? { ...m, deliveredAt: u.deliveredAt ?? m.deliveredAt, readAt: u.readAt ?? m.readAt }
            : m,
        ),
      )
    const onTypingStart = (d: { conversationId: string; userId: string }) => {
      if (d.conversationId === conversationId && d.userId !== me?.id) setOtherTyping(true)
    }
    const onTypingStop = (d: { conversationId: string; userId: string }) => {
      if (d.conversationId === conversationId && d.userId !== me?.id) setOtherTyping(false)
    }

    socket.on('connect', onConnect)
    socket.on('message:new', onMessage)
    socket.on('message:status', onStatus)
    socket.on('typing:start', onTypingStart)
    socket.on('typing:stop', onTypingStop)

    return () => {
      socket.emit('conversation:leave', { conversationId })
      socket.off('connect', onConnect)
      socket.off('message:new', onMessage)
      socket.off('message:status', onStatus)
      socket.off('typing:start', onTypingStart)
      socket.off('typing:stop', onTypingStop)
    }
  }, [conversationId, me])

  useEffect(() => {
    if (messages.length > 0 && !searchVisible) {
      listRef.current?.scrollToEnd({ animated: true })
    }
  }, [messages.length, searchVisible])

  // Reset match index when query changes
  useEffect(() => {
    setCurrentMatchIdx(0)
  }, [searchQuery])

  const send = useCallback(() => {
    const body = draft.trim()
    if (!body) return
    const clientMessageId = uuid()
    const socket = getSocket()
    socket.emit(
      'message:send',
      { conversationId, type: 'TEXT', body, clientMessageId },
      () => {},
    )
    setDraft('')
    socket.emit('typing:stop', { conversationId })
  }, [conversationId, draft])

  const onDraftChange = (v: string) => {
    setDraft(v)
    const socket = getSocket()
    socket.emit('typing:start', { conversationId })
    if (typingTimer.current) clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(() => {
      socket.emit('typing:stop', { conversationId })
    }, 1500)
  }

  function openMessageOptions(messageId: string) {
    Alert.alert('Message options', undefined, [
      {
        text: 'Save to journal',
        onPress: () => {
          setPendingMessageId(messageId)
          setPickerVisible(true)
        },
      },
      {
        text: 'Report message',
        style: 'destructive',
        onPress: () => {
          Alert.alert('Report', 'Are you sure you want to report this message?', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Report',
              style: 'destructive',
              onPress: () => {
                getApiClient()
                  .chat.reportMessage(messageId, 'Inappropriate', undefined)
                  .catch(() => {})
              },
            },
          ])
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  async function handleJournalPick(journal: JournalItem) {
    setPickerVisible(false)
    if (!pendingMessageId) return
    try {
      await getApiClient().journals.saveFromChat(pendingMessageId, journal.category)
      Alert.alert('Saved', MENTEES_COPY.savedToJournal(
        journal.title ?? journal.category.replace(/_/g, ' ').toLowerCase(),
      ))
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 402) {
        Alert.alert('PRO required', MENTEES_COPY.saveJournalProRequired)
      } else {
        Alert.alert('Error', 'Could not save to journal. Please try again.')
      }
    } finally {
      setPendingMessageId(null)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Search bar (slide-down) */}
      <SearchBar
        visible={searchVisible}
        query={searchQuery}
        onChangeQuery={setSearchQuery}
        matchCount={matchCount}
        currentMatch={safeCurrentMatchIdx}
        onPrev={handlePrevMatch}
        onNext={handleNextMatch}
        onClose={handleCloseSearch}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={64}
        className="flex-1"
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 6 }}
          onScrollToIndexFailed={() => {}}
          renderItem={({ item }) => {
            const mine = item.senderId === me?.id
            const isMatchingMsg = searchQuery && matchingIds.includes(item.id)
            const isCurrentMatch = isMatchingMsg && matchingIds[safeCurrentMatchIdx] === item.id

            return (
              <Pressable
                onLongPress={() => openMessageOptions(item.id)}
                delayLongPress={500}
              >
                <View className={mine ? 'items-end' : 'items-start'}>
                  <View
                    style={isCurrentMatch ? { borderWidth: 2, borderColor: '#f59e0b', borderRadius: 16 } : undefined}
                    className={`max-w-[80%] rounded-2xl px-3 py-2 ${
                      mine ? 'bg-primary' : 'bg-gray-100'
                    }`}
                  >
                    {item.body ? (
                      <HighlightText
                        text={item.body}
                        query={searchQuery}
                        isMyMessage={mine}
                        isCurrent={!!isCurrentMatch}
                      />
                    ) : null}
                    <Text
                      className={`mt-1 text-[10px] ${
                        mine ? 'text-white/70' : 'text-gray-500'
                      }`}
                    >
                      {new Date(item.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {mine &&
                        (item.readAt
                          ? ' · read'
                          : item.deliveredAt
                            ? ' · delivered'
                            : ' · sent')}
                    </Text>
                  </View>
                </View>
              </Pressable>
            )
          }}
        />
        {otherTyping && (
          <Text className="px-4 pb-1 text-xs italic text-muted">typing…</Text>
        )}
        {/* Composer — hidden when search is active */}
        {!searchVisible && (
          <View className="flex-row items-center gap-2 border-t border-gray-100 px-3 py-2">
            <TextInput
              value={draft}
              onChangeText={onDraftChange}
              placeholder="Type a message…"
              multiline
              className="flex-1 rounded-md border border-gray-200 bg-white px-3 py-2 text-base"
            />
            <Pressable
              onPress={send}
              disabled={!draft.trim()}
              className="rounded-md bg-primary px-4 py-2 disabled:opacity-50"
            >
              <Text className="text-base font-medium text-white">Send</Text>
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>

      <CategoryPicker
        visible={pickerVisible}
        onClose={() => {
          setPickerVisible(false)
          setPendingMessageId(null)
        }}
        onPick={handleJournalPick}
      />
    </SafeAreaView>
  )
}
