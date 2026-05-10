import { useCallback, useEffect, useRef, useState } from 'react'
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import type { Message } from '@mento/types'
import { getApiClient } from '@/lib/api'
import { getSocket } from '@/lib/socket'
import { useAuthStore } from '@/lib/auth-store'
import { uuid } from '@/lib/uuid'

export default function ChatThread() {
  const params = useLocalSearchParams<{ id: string }>()
  const conversationId = String(params.id ?? '')
  const me = useAuthStore((s) => s.user)
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [otherTyping, setOtherTyping] = useState(false)
  const listRef = useRef<FlatList<Message>>(null)
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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
    if (messages.length > 0) listRef.current?.scrollToEnd({ animated: true })
  }, [messages.length])

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

  return (
    <SafeAreaView className="flex-1 bg-white">
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
          renderItem={({ item }) => {
            const mine = item.senderId === me?.id
            return (
              <View className={mine ? 'items-end' : 'items-start'}>
                <View
                  className={`max-w-[80%] rounded-2xl px-3 py-2 ${
                    mine ? 'bg-primary' : 'bg-gray-100'
                  }`}
                >
                  <Text className={mine ? 'text-white' : 'text-gray-900'}>{item.body}</Text>
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
            )
          }}
        />
        {otherTyping && (
          <Text className="px-4 pb-1 text-xs italic text-muted">typing…</Text>
        )}
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
