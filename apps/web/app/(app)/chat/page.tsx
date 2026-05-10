'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { ConversationSummary } from '@mento/types'
import { getApiClient } from '@/lib/api'
import { LetterAvatar } from '@/components/LetterAvatar'

export default function ChatListPage() {
  const [convs, setConvs] = useState<ConversationSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    getApiClient()
      .chat.listConversations()
      .then((rows) => mounted && setConvs(rows))
      .catch((err: unknown) =>
        mounted && setError(err instanceof Error ? err.message : 'Failed to load'),
      )
    return () => {
      mounted = false
    }
  }, [])

  if (error) return <p className="text-sm text-red-600">{error}</p>
  if (!convs) return <p className="text-sm text-muted-foreground">Loading conversations…</p>
  if (convs.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/30 p-6 text-sm text-muted-foreground">
        No conversations yet. An admin will assign you a mentor or aspirant soon.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Conversations</h1>
      <ul className="divide-y rounded-lg border bg-card">
        {convs.map((c) => (
          <li key={c.id}>
            <Link
              href={`/chat/${c.id}`}
              className="flex items-start gap-3 p-4 hover:bg-accent/50"
            >
              <LetterAvatar
                letter={c.counterpart.avatarLetter}
                color={c.counterpart.avatarColor}
                hasPurpleTick={c.counterpart.hasPurpleTick}
              />
              <div className="min-w-0 flex-1">
                <div className="flex justify-between">
                  <span className="font-medium">{c.counterpart.displayHandle}</span>
                  <span className="text-xs text-muted-foreground">
                    {c.lastMessageAt ? formatTime(c.lastMessageAt) : ''}
                  </span>
                </div>
                <p className="truncate text-sm text-muted-foreground">
                  {c.lastMessage?.body ?? 'No messages yet'}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

function formatTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString()
}
