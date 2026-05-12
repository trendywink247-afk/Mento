'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Users, BookOpen, MessageSquare, ArrowRight, PenLine, RefreshCw } from 'lucide-react'
import { useAuthStore } from '@/lib/auth-store'
import { getApiClient } from '@/lib/api'

// ─── Static data ─────────────────────────────────────────────────────────────

const DAILY_PROMPTS = [
  "What's the one thing you're avoiding studying? Why?",
  'If you had to explain Federalism to a 10-year-old today, what would you say?',
  "What's your biggest fear about this attempt?",
  'Write down 3 things you understood well this week and 1 that still feels blurry.',
  "Which subject feels like a wall right now? What's one crack in it?",
  'If you had unlimited time today, how would you spend it studying?',
  'What does success feel like to you — not rank, but the feeling?',
]

const SAMPLE_QUESTIONS = [
  'How relevant is reading the newspaper for Prelims?',
  'How should I plan my first 6 months of preparation?',
  'Did you struggle with Mains writing speed? What helped?',
  'How did you handle the emotional dip after a failed Prelims?',
  'Coaching or self-study — when does each make sense?',
  'What single book or source had the biggest impact for you?',
]

function getTodayPrompt(): string {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000,
  )
  return DAILY_PROMPTS[dayOfYear % DAILY_PROMPTS.length]
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface OnboardingState {
  mirrorComplete: boolean
  nextStep: string | null
}

interface JournalSummary {
  id: string
  category: string
  title: string | null
  entryCount: number
  updatedAt: string
}

interface ConversationSummary {
  id: string
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border bg-muted/30 p-6">
      <div className="mb-3 h-4 w-1/3 rounded bg-muted" />
      <div className="mb-2 h-3 w-2/3 rounded bg-muted" />
      <div className="h-3 w-1/2 rounded bg-muted" />
    </div>
  )
}

// ─── Dashboard page ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, profile } = useAuthStore()

  const [onboarding, setOnboarding] = useState<OnboardingState | null>(null)
  const [journals, setJournals] = useState<JournalSummary[] | null>(null)
  const [conversations, setConversations] = useState<ConversationSummary[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const api = getApiClient()
    Promise.all([
      api.onboarding.state().catch(() => null),
      api.journals.list().catch(() => []),
      api.chat.listConversations().catch(() => []),
    ]).then(([obs, jnls, convos]) => {
      setOnboarding(obs as OnboardingState | null)
      setJournals(jnls as JournalSummary[])
      setConversations(convos as ConversationSummary[])
      setLoading(false)
    })
  }, [])

  const displayHandle = profile?.displayHandle ?? 'there'
  const isMirrorComplete = onboarding?.mirrorComplete ?? false
  const isAspirant = user?.role === 'ASPIRANT'
  const conversationCount = conversations?.length ?? 0
  const recentJournals = (journals ?? []).filter((j) => j.entryCount > 0).slice(0, 3)
  const todayPrompt = getTodayPrompt()

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Welcome line */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Welcome, {displayHandle}.</h1>
        <p className="mt-1 text-sm text-muted-foreground">It&apos;s good to see you again.</p>
      </div>

      {/* Today's reflection prompt */}
      <div className="rounded-2xl border bg-blue-50/60 p-6">
        <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600">
          <PenLine size={13} />
          Today&apos;s reflection
        </div>
        <p className="mt-2 text-base font-medium text-foreground">{todayPrompt}</p>
        <div className="mt-4">
          <Link
            href="/journals"
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Open Personal journal
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      {/* 3-column next-step cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {loading ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : (
          <>
            {/* Card A — Find a mentor */}
            <div className="flex flex-col rounded-2xl border bg-slate-50 p-6">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-slate-600">
                <Users size={20} />
              </div>
              <h2 className="text-base font-semibold">Find a mentor</h2>
              <p className="mt-1 flex-1 text-sm text-muted-foreground">
                Browse anonymous, verified mentors who&apos;ve walked your path.
              </p>
              <Link
                href="/mentors"
                className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
              >
                Browse mentors <ArrowRight size={13} />
              </Link>
            </div>

            {/* Card B — Mirror status */}
            {isMirrorComplete ? (
              <div className="flex flex-col rounded-2xl border bg-violet-50 p-6">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-violet-200 text-violet-700">
                  <BookOpen size={20} />
                </div>
                <h2 className="text-base font-semibold">Your Mirror is complete</h2>
                <p className="mt-1 flex-1 text-sm text-muted-foreground">
                  Your journey profile is up to date. Mentors can see where you are.
                </p>
                <Link
                  href="/onboarding/mirror"
                  className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-violet-600 hover:underline"
                >
                  Update Mirror <RefreshCw size={13} />
                </Link>
              </div>
            ) : (
              <div className="flex flex-col rounded-2xl border bg-amber-50 p-6">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-amber-200 text-amber-700">
                  <BookOpen size={20} />
                </div>
                <h2 className="text-base font-semibold">Complete your Mirror</h2>
                <p className="mt-1 flex-1 text-sm text-muted-foreground">
                  Tell us where you are in your journey so mentors can find the right words.
                </p>
                <Link
                  href="/onboarding/mirror"
                  className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-amber-700 hover:underline"
                >
                  Continue Mirror <ArrowRight size={13} />
                </Link>
              </div>
            )}

            {/* Card C — Conversations */}
            <div className="flex flex-col rounded-2xl border bg-emerald-50 p-6">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-200 text-emerald-700">
                <MessageSquare size={20} />
              </div>
              <h2 className="text-base font-semibold">
                {conversationCount > 0
                  ? `${conversationCount} conversation${conversationCount === 1 ? '' : 's'}`
                  : 'Your conversations'}
              </h2>
              <p className="mt-1 flex-1 text-sm text-muted-foreground">
                {conversationCount > 0
                  ? 'Pick up where you left off.'
                  : 'No conversations yet — say hi to a mentor.'}
              </p>
              <Link
                href={conversationCount > 0 ? '/chat' : '/mentors'}
                className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:underline"
              >
                {conversationCount > 0 ? 'Go to chat' : 'Browse mentors'}{' '}
                <ArrowRight size={13} />
              </Link>
            </div>
          </>
        )}
      </div>

      {/* Sample questions — only for aspirants with complete Mirror */}
      {!loading && isMirrorComplete && isAspirant && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Questions to ask a mentor
          </h2>
          <div className="divide-y rounded-2xl border bg-card">
            {SAMPLE_QUESTIONS.map((q) => (
              <Link
                key={q}
                href="/mentors"
                className="flex items-center justify-between px-5 py-3.5 text-sm hover:bg-accent"
              >
                <span>{q}</span>
                <span className="ml-4 flex-shrink-0 text-xs text-muted-foreground">
                  Send to a mentor &rarr;
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent journal entries strip */}
      {!loading && recentJournals.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Recent journal activity
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {recentJournals.map((j) => (
              <Link
                key={j.id}
                href={`/journals/${j.id}`}
                className="rounded-xl border bg-card px-4 py-3.5 hover:bg-accent"
              >
                <p className="truncate text-sm font-medium">{j.title ?? j.category}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {j.entryCount} {j.entryCount === 1 ? 'entry' : 'entries'} &middot;{' '}
                  {new Date(j.updatedAt).toLocaleDateString()}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
