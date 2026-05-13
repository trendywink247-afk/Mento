'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { BookOpen, Copy, MoreVertical, X } from 'lucide-react'
import { v4 as uuid } from '@/lib/uuid'
import type { Message } from '@mento/types'
import { getApiClient } from '@/lib/api'
import { getSocket } from '@/lib/socket'
import { useAuthStore } from '@/lib/auth-store'
import { MENTEES_COPY } from '@/lib/copy'

// ---- Inline toast ----

interface ToastState {
  id: number
  message: string
  type: 'success' | 'error'
}

function Toast({ toast, onDismiss }: { toast: ToastState; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(toast.id), 4000)
    return () => clearTimeout(t)
  }, [toast.id, onDismiss])

  return (
    <div
      className={[
        'flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg',
        toast.type === 'success'
          ? 'bg-green-600 text-white'
          : 'bg-destructive text-destructive-foreground',
      ].join(' ')}
    >
      {toast.message}
      <button onClick={() => onDismiss(toast.id)} className="ml-1 opacity-70 hover:opacity-100">
        <X size={13} />
      </button>
    </div>
  )
}

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastState[]
  onDismiss: (id: number) => void
}) {
  if (toasts.length === 0) return null
  return (
    <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 flex-col gap-2">
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

// ---- Report dialog ----

const REPORT_REASONS = [
  'Inappropriate',
  'Personal details shared',
  'Harassment',
  'Spam',
  'Other',
] as const

type ReportReason = (typeof REPORT_REASONS)[number]

function ReportDialog({
  messageId,
  onClose,
  onSuccess,
}: {
  messageId: string
  onClose: () => void
  onSuccess: (messageId: string) => void
}) {
  const [reason, setReason] = useState<ReportReason>('Inappropriate')
  const [details, setDetails] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await getApiClient().chat.reportMessage(messageId, reason, details.trim() || undefined)
      onSuccess(messageId)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit report')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-xl border bg-background p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">Report message</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">
              Reason
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as ReportReason)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {REPORT_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">
              Details{' '}
              <span className="font-normal text-muted-foreground">(optional, max 200 chars)</span>
            </label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value.slice(0, 200))}
              rows={3}
              placeholder="Describe what happened…"
              className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="mt-0.5 text-right text-[10px] text-muted-foreground">
              {details.length}/200
            </p>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? 'Submitting…' : 'Submit report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---- Save to journal dialog ----

interface JournalItem {
  id: string
  category: string
  title: string | null
}

function SaveToJournalDialog({
  messageId,
  onClose,
  onSuccess,
  onError,
}: {
  messageId: string
  onClose: () => void
  onSuccess: (category: string) => void
  onError: (msg: string) => void
}) {
  const [journals, setJournals] = useState<JournalItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
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
  }, [])

  async function handlePick(category: string) {
    setSaving(true)
    try {
      await getApiClient().journals.saveFromChat(messageId, category)
      onSuccess(category)
      onClose()
    } catch (err: unknown) {
      // 402 is normally surfaced by the global paywall interceptor. We still pass
      // a hint to the parent so it can show a fallback toast if the interceptor
      // ever fails to mount.
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 402) {
        onError('Saving chat to journal needs PRO.')
        onClose()
      } else {
        onError(err instanceof Error ? err.message : 'Failed to save')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-xs rounded-xl border bg-background p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-primary" />
            <h2 className="text-sm font-semibold">Save to journal</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <div className="space-y-2 py-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-9 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        ) : journals.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No personal journals yet. Create one from the Journals page first.
          </p>
        ) : (
          <div className="space-y-1">
            {journals.map((j) => (
              <button
                key={j.id}
                disabled={saving}
                onClick={() => handlePick(j.category)}
                className="flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-sm text-foreground hover:bg-accent disabled:opacity-50"
              >
                <BookOpen size={13} className="shrink-0 text-muted-foreground" />
                <span className="flex-1 capitalize">
                  {j.title ?? j.category.replace(/_/g, ' ').toLowerCase()}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ---- Message bubble with more-menu ----

interface MessageBubbleProps {
  m: Message
  mine: boolean
  reported: boolean
  onReport: (id: string) => void
  onSaveToJournal: (id: string) => void
}

function MessageBubble({ m, mine, reported, onReport, onSaveToJournal }: MessageBubbleProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!menuOpen) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  // Right-click context menu
  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault()
    setMenuOpen(true)
  }

  // Long-press via pointer events (500ms)
  function handlePointerDown() {
    longPressTimer.current = setTimeout(() => {
      setMenuOpen(true)
    }, 500)
  }

  function handlePointerUp() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  function handleCopy() {
    if (m.body) {
      navigator.clipboard.writeText(m.body).catch(() => {})
    }
    setMenuOpen(false)
  }

  return (
    <div className={`group flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className="relative flex max-w-[70%] flex-col">
        <div
          onContextMenu={handleContextMenu}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          className={[
            'rounded-lg px-3 py-2 text-sm select-none',
            mine ? 'bg-primary text-primary-foreground' : 'bg-muted',
            reported ? 'ring-1 ring-red-400' : '',
          ].join(' ')}
        >
          <p className="whitespace-pre-wrap break-words">{m.body}</p>
          <p className="mt-1 text-[10px] opacity-70">
            {new Date(m.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
            {mine && (m.readAt ? ' · read' : m.deliveredAt ? ' · delivered' : ' · sent')}
          </p>
        </div>
        {reported && (
          <span className="mt-0.5 self-end rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-red-600">
            Reported
          </span>
        )}

        {/* More menu button — visible on hover for non-mine messages */}
        {!mine && (
          <div
            className="absolute -right-7 top-1 opacity-0 group-hover:opacity-100"
            ref={menuRef}
          >
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Message options"
            >
              <MoreVertical size={14} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-7 z-10 min-w-[11rem] rounded-lg border bg-background py-1 shadow-lg">
                <button
                  onClick={() => {
                    setMenuOpen(false)
                    onSaveToJournal(m.id)
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-accent"
                >
                  <BookOpen size={13} className="text-primary" />
                  Save to journal
                </button>
                <button
                  onClick={handleCopy}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-accent"
                >
                  <Copy size={13} className="text-muted-foreground" />
                  Copy text
                </button>
                <div className="border-t my-0.5" />
                <button
                  onClick={() => {
                    setMenuOpen(false)
                    onReport(m.id)
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                >
                  Report message
                </button>
              </div>
            )}
          </div>
        )}

        {/* Own messages also get a context menu for save/copy (right-click / long-press only) */}
        {mine && menuOpen && (
          <div
            ref={menuRef}
            className="absolute right-0 top-full z-10 mt-1 min-w-[11rem] rounded-lg border bg-background py-1 shadow-lg"
          >
            <button
              onClick={() => {
                setMenuOpen(false)
                onSaveToJournal(m.id)
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-accent"
            >
              <BookOpen size={13} className="text-primary" />
              Save to journal
            </button>
            <button
              onClick={handleCopy}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-accent"
            >
              <Copy size={13} className="text-muted-foreground" />
              Copy text
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ---- Main page ----

export default function ChatThreadPage() {
  const params = useParams<{ id: string }>()
  const conversationId = params.id
  const me = useAuthStore((s) => s.user)
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [status, setStatus] = useState<'connecting' | 'open' | 'closed'>('connecting')
  const [otherTyping, setOtherTyping] = useState(false)
  const [reportingMessageId, setReportingMessageId] = useState<string | null>(null)
  const [savingMessageId, setSavingMessageId] = useState<string | null>(null)
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set())
  const [toasts, setToasts] = useState<ToastState[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toastCounter = useRef(0)

  function pushToast(message: string, type: ToastState['type'] = 'success') {
    const id = ++toastCounter.current
    setToasts((prev) => [...prev, { id, message, type }])
  }

  function dismissToast(id: number) {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

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

  function handleReportSuccess(messageId: string) {
    setReportedIds((prev) => new Set([...prev, messageId]))
    pushToast('Reported. Our team will review.', 'success')
  }

  function handleSaveSuccess(category: string) {
    pushToast(MENTEES_COPY.savedToJournal(category), 'success')
  }

  function handleSaveError(msg: string) {
    pushToast(msg, 'error')
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
            <MessageBubble
              key={m.id}
              m={m}
              mine={mine}
              reported={reportedIds.has(m.id)}
              onReport={(id) => setReportingMessageId(id)}
              onSaveToJournal={(id) => setSavingMessageId(id)}
            />
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

      {reportingMessageId && (
        <ReportDialog
          messageId={reportingMessageId}
          onClose={() => setReportingMessageId(null)}
          onSuccess={handleReportSuccess}
        />
      )}

      {savingMessageId && (
        <SaveToJournalDialog
          messageId={savingMessageId}
          onClose={() => setSavingMessageId(null)}
          onSuccess={handleSaveSuccess}
          onError={handleSaveError}
        />
      )}

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
