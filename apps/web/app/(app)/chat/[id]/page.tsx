'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { v4 as uuid } from '@/lib/uuid'
import type { Message } from '@mento/types'
import { getApiClient } from '@/lib/api'
import { getSocket } from '@/lib/socket'
import { useAuthStore } from '@/lib/auth-store'

export default function ChatThreadPage() {
  const params = useParams<{ id: string }>()
  const conversationId = params.id
  const me = useAuthStore((s) => s.user)
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [status, setStatus] = useState<'connecting' | 'open' | 'closed'>('connecting')
  const [otherTyping, setOtherTyping] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Initial load.
  useEffect(() => {
    let mounted = true
    getApiClient()
      .chat.getMessages(conversationId, { limit: 50 })
      .then((rows) => mounted && setMessages(rows))
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [conversationId])

  // Socket setup.
  useEffect(() => {
    const socket = getSocket()
    socket.connect()
    setStatus('connecting')

    const onConnect = () => {
      setStatus('open')
      socket.emit('conversation:join', { conversationId })
    }
    const onDisconnect = () => setStatus('closed')
    const onMessage = (m: Message) => {
      if (m.conversationId !== conversationId) return
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]))
      // Best-effort delivered ack
      if (me && m.senderId !== me.id) {
        socket.emit('message:delivered', { messageId: m.id })
      }
    }
    const onStatus = (u: { messageId: string; deliveredAt?: string; readAt?: string }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === u.messageId
            ? { ...m, deliveredAt: u.deliveredAt ?? m.deliveredAt, readAt: u.readAt ?? m.readAt }
            : m,
        ),
      )
    }
    const onTypingStart = (d: { conversationId: string; userId: string }) => {
      if (d.conversationId === conversationId && d.userId !== me?.id) setOtherTyping(true)
    }
    const onTypingStop = (d: { conversationId: string; userId: string }) => {
      if (d.conversationId === conversationId && d.userId !== me?.id) setOtherTyping(false)
    }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('message:new', onMessage)
    socket.on('message:status', onStatus)
    socket.on('typing:start', onTypingStart)
    socket.on('typing:stop', onTypingStop)

    return () => {
      socket.emit('conversation:leave', { conversationId })
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('message:new', onMessage)
      socket.off('message:status', onStatus)
      socket.off('typing:start', onTypingStart)
      socket.off('typing:stop', onTypingStop)
    }
  }, [conversationId, me])

  // Auto-scroll on new message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const send = useCallback(() => {
    const body = draft.trim()
    if (!body) return
    const clientMessageId = uuid()
    const socket = getSocket()
    socket.emit(
      'message:send',
      { conversationId, type: 'TEXT', body, clientMessageId },
      (res) => {
        if (!res.ok) console.error('send failed:', res.error)
      },
    )
    setDraft('')
    socket.emit('typing:stop', { conversationId })
  }, [conversationId, draft])

  const onDraftChange = (v: string) => {
    setDraft(v)
    const socket = getSocket()
    socket.emit('typing:start', { conversationId })
    if (typingTimeout.current) clearTimeout(typingTimeout.current)
    typingTimeout.current = setTimeout(() => {
      socket.emit('typing:stop', { conversationId })
    }, 1500)
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <header className="flex items-center justify-between border-b pb-3">
        <h1 className="text-lg font-semibold">Conversation</h1>
        <span className="text-xs text-muted-foreground">{status}</span>
      </header>
      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto py-4">
        {messages.map((m) => {
          const mine = m.senderId === me?.id
          return (
            <div
              key={m.id}
              className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${
                  mine ? 'bg-primary text-primary-foreground' : 'bg-muted'
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className={`mt-1 text-[10px] opacity-70`}>
                  {new Date(m.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {mine && (m.readAt ? ' · read' : m.deliveredAt ? ' · delivered' : ' · sent')}
                </p>
              </div>
            </div>
          )
        })}
        {otherTyping && (
          <p className="text-xs italic text-muted-foreground">typing…</p>
        )}
      </div>
      <div className="flex gap-2 border-t pt-3">
        <input
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          placeholder="Type a message…"
          className="flex-1 rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          onClick={send}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          disabled={!draft.trim()}
        >
          Send
        </button>
      </div>
    </div>
  )
}
