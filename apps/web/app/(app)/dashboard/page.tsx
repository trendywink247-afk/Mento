'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Users, BookOpen, MessageSquare, ArrowRight, PenLine, RefreshCw } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useAuthStore } from '@/lib/auth-store'
import { getApiClient } from '@/lib/api'
import { MotionFade, MotionStagger, MotionStaggerItem, MotionTap } from '@/components/motion'

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
  const t = useTranslations('dashboard')

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
      <MotionFade>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('welcome', { handle: displayHandle })}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subline')}</p>
        </div>
      </MotionFade>

      {/* Today's reflection prompt */}
      <MotionFade delay={0.08}>
        <div className="rounded-2xl border bg-primary/5 p-6">
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
            <PenLine size={13} />
            {t('todayReflection')}
          </div>
          <p className="mt-2 text-base font-medium text-foreground">{todayPrompt}</p>
          <div className="mt-4">
            <MotionTap>
              <Link
                href="/journals"
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                {t('openPersonalJournal')}
                <ArrowRight size={14} />
              </Link>
            </MotionTap>
          </div>
        </div>
      </MotionFade>

      {/* 3-column next-step cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {loading ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : (
          <MotionStagger staggerDelay={0.07} className="contents">
            {/* Card A — Find a mentor */}
            <MotionStaggerItem>
              <MotionTap>
                <div className="flex h-full flex-col rounded-2xl border bg-muted/30 p-6">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Users size={20} />
                  </div>
                  <h2 className="text-base font-semibold">{t('findMentor.title')}</h2>
                  <p className="mt-1 flex-1 text-sm text-muted-foreground">
                    {t('findMentor.description')}
                  </p>
                  <Link
                    href="/mentors"
                    className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    {t('findMentor.link')} <ArrowRight size={13} />
                  </Link>
                </div>
              </MotionTap>
            </MotionStaggerItem>

            {/* Card B — Mirror status */}
            <MotionStaggerItem>
              <MotionTap>
                {isMirrorComplete ? (
                  <div className="flex h-full flex-col rounded-2xl border bg-violet-50 dark:bg-violet-950/30 p-6">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-violet-200 dark:bg-violet-900/60 text-violet-700 dark:text-violet-300">
                      <BookOpen size={20} />
                    </div>
                    <h2 className="text-base font-semibold">{t('mirrorComplete.title')}</h2>
                    <p className="mt-1 flex-1 text-sm text-muted-foreground">
                      {t('mirrorComplete.description')}
                    </p>
                    <Link
                      href="/onboarding/mirror"
                      className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-violet-600 dark:text-violet-400 hover:underline"
                    >
                      {t('mirrorComplete.link')} <RefreshCw size={13} />
                    </Link>
                  </div>
                ) : (
                  <div className="flex h-full flex-col rounded-2xl border bg-amber-50 dark:bg-amber-950/30 p-6">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-amber-200 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300">
                      <BookOpen size={20} />
                    </div>
                    <h2 className="text-base font-semibold">{t('mirrorIncomplete.title')}</h2>
                    <p className="mt-1 flex-1 text-sm text-muted-foreground">
                      {t('mirrorIncomplete.description')}
                    </p>
                    <Link
                      href="/onboarding/mirror"
                      className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-amber-700 dark:text-amber-400 hover:underline"
                    >
                      {t('mirrorIncomplete.link')} <ArrowRight size={13} />
                    </Link>
                  </div>
                )}
              </MotionTap>
            </MotionStaggerItem>

            {/* Card C — Conversations */}
            <MotionStaggerItem>
              <MotionTap>
                <div className="flex h-full flex-col rounded-2xl border bg-emerald-50 dark:bg-emerald-950/30 p-6">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-200 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                    <MessageSquare size={20} />
                  </div>
                  <h2 className="text-base font-semibold">
                    {conversationCount > 0
                      ? t('conversations.titleWithCount', { count: conversationCount })
                      : t('conversations.titleEmpty')}
                  </h2>
                  <p className="mt-1 flex-1 text-sm text-muted-foreground">
                    {conversationCount > 0
                      ? t('conversations.descWithCount')
                      : t('conversations.descEmpty')}
                  </p>
                  <Link
                    href={conversationCount > 0 ? '/chat' : '/mentors'}
                    className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-emerald-700 dark:text-emerald-400 hover:underline"
                  >
                    {conversationCount > 0 ? t('conversations.linkChat') : t('conversations.linkMentors')}{' '}
                    <ArrowRight size={13} />
                  </Link>
                </div>
              </MotionTap>
            </MotionStaggerItem>
          </MotionStagger>
        )}
      </div>

      {/* Sample questions — only for aspirants with complete Mirror */}
      {!loading && isMirrorComplete && isAspirant && (
        <MotionFade delay={0.15}>
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {t('questionsToAskMentor')}
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
                    {t('sendToMentor')} &rarr;
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </MotionFade>
      )}

      {/* Recent journal entries strip */}
      {!loading && recentJournals.length > 0 && (
        <MotionFade delay={0.2}>
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {t('recentJournalActivity')}
            </h2>
            <MotionStagger staggerDelay={0.05} className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {recentJournals.map((j) => (
                <MotionStaggerItem key={j.id}>
                  <MotionTap>
                    <Link
                      href={`/journals/${j.id}`}
                      className="block rounded-xl border bg-card px-4 py-3.5 hover:bg-accent"
                    >
                      <p className="truncate text-sm font-medium">{j.title ?? j.category}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {t('journalEntry', { count: j.entryCount })} &middot;{' '}
                        {new Date(j.updatedAt).toLocaleDateString()}
                      </p>
                    </Link>
                  </MotionTap>
                </MotionStaggerItem>
              ))}
            </MotionStagger>
          </div>
        </MotionFade>
      )}
    </div>
  )
}
