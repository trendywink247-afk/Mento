'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { AvatarColor, AvatarLetter } from '@mento/types'
import { getApiClient } from '@/lib/api'
import { LetterAvatar } from '@/components/LetterAvatar'
import { COPY } from '@/lib/copy'

type AttemptYear = { year: number; prelims: boolean; mains: boolean; interview: boolean }

type MentorDetail = {
  userId: string
  displayHandle: string
  avatarLetter: AvatarLetter
  avatarColor: AvatarColor
  hasPurpleTick: boolean
  isVerified: boolean
  isFoundingPartner: boolean
  prelimsCleared: boolean
  mainsAttempts: number
  interviewAttempts: number
  attemptHistory: unknown
  rankAchieved: number | null
  optionalSubject: string | null
  guidanceCategories: string[]
  languages: string[]
  hourlyRateInr: number
  metrics: { chats: number; mentees: number; sessions: number }
  reviews: Array<{
    id: string
    body: string
    createdAt: string
    author: { displayHandle: string; avatarLetter: AvatarLetter; avatarColor: AvatarColor }
  }>
}

function buildJourneyOneLiner(m: MentorDetail): string {
  if (m.rankAchieved) return `IAS/IPS · Rank ${m.rankAchieved}`
  if (m.interviewAttempts > 0)
    return `Interview attended${m.interviewAttempts > 1 ? ` ${m.interviewAttempts}x` : ''}`
  if (m.mainsAttempts > 0)
    return `Mains written${m.mainsAttempts > 1 ? ` ${m.mainsAttempts}x` : ''}`
  if (m.prelimsCleared) return 'Prelims cleared'
  return 'Active mentor'
}

export default function MentorProfilePage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const [mentor, setMentor] = useState<MentorDetail | null>(null)
  const [showRequest, setShowRequest] = useState(false)
  const [intro, setIntro] = useState('')
  const [busy, setBusy] = useState(false)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [requestSent, setRequestSent] = useState(false)

  const heroRef = useRef<HTMLDivElement>(null)
  const [stickyVisible, setStickyVisible] = useState(false)

  useEffect(() => {
    if (!params.id) return
    getApiClient()
      .mentors.detail(params.id)
      .then(setMentor)
      .catch(() => {})
  }, [params.id])

  useEffect(() => {
    const el = heroRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => setStickyVisible(entry !== undefined && !entry.isIntersecting),
      { threshold: 0 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [mentor])

  async function send() {
    if (!mentor) return
    setBusy(true)
    setRequestError(null)
    try {
      await getApiClient().chatRequests.create(mentor.userId, intro.trim())
      setRequestSent(true)
      setTimeout(() => router.push('/chat'), 1500)
    } catch (err) {
      setRequestError(err instanceof Error ? err.message : 'Could not send')
    } finally {
      setBusy(false)
    }
  }

  if (!mentor)
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="h-44 animate-pulse rounded-2xl bg-muted" />
        <div className="h-24 animate-pulse rounded-2xl bg-muted" />
        <div className="h-48 animate-pulse rounded-2xl bg-muted" />
      </div>
    )

  const history = (mentor.attemptHistory ?? []) as AttemptYear[]
  const journeyOneLiner = buildJourneyOneLiner(mentor)

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-28">
      {/* Hero band */}
      <div
        ref={heroRef}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 ring-1 ring-primary/15"
      >
        <div className="flex items-start gap-5">
          <LetterAvatar
            letter={mentor.avatarLetter}
            color={mentor.avatarColor}
            hasPurpleTick={mentor.hasPurpleTick}
            size={88}
          />
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{mentor.displayHandle}</h1>
              {mentor.isVerified && (
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                  Verified
                </span>
              )}
              {mentor.isFoundingPartner && (
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                  Founding partner
                </span>
              )}
            </div>
            <p className="mt-1 text-sm font-medium text-primary">{journeyOneLiner}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {`Chat free · 1:1 ₹${mentor.hourlyRateInr}/hr · ${mentor.languages.join(', ')}`}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => setShowRequest(true)}
                className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                Initiate connection
              </button>
              <button
                disabled
                title="1:1 sessions coming soon"
                className="rounded-md border border-border bg-muted/50 px-5 py-2 text-sm font-medium text-muted-foreground opacity-60"
              >
                Request 1:1 session
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Guidance + optional subject */}
      {(mentor.guidanceCategories.length > 0 || mentor.optionalSubject) && (
        <div className="rounded-2xl border border-border bg-card p-5">
          {mentor.guidanceCategories.length > 0 && (
            <div>
              <p className="mb-2.5 text-sm font-semibold">Comfortable guiding</p>
              <div className="flex flex-wrap gap-2">
                {mentor.guidanceCategories.map((c) => (
                  <span
                    key={c}
                    className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}
          {mentor.optionalSubject && (
            <p className="mt-3 text-sm text-muted-foreground">
              Optional subject:{' '}
              <span className="font-medium text-foreground">{mentor.optionalSubject}</span>
            </p>
          )}
        </div>
      )}

      {/* Year-by-year timeline */}
      {history.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="mb-4 text-sm font-semibold">UPSC journey</p>
          <ol className="relative space-y-5 pl-6">
            <div
              className="absolute left-[9px] top-1 w-px bg-border"
              style={{ height: 'calc(100% - 1.5rem)' }}
            />
            {history.map((h, i) => {
              const events = [
                h.prelims && 'Prelims cleared',
                h.mains && 'Mains written',
                h.interview && 'Interview attended',
              ].filter(Boolean) as string[]
              return (
                <li key={i} className="relative flex items-start gap-3">
                  <span className="absolute -left-[3px] mt-1.5 h-3 w-3 rounded-full border-2 border-primary bg-background" />
                  <div className="flex-1">
                    <span className="text-sm font-semibold text-foreground">{h.year}</span>
                    <span className="ml-2 text-sm text-muted-foreground">
                      {events.length > 0 ? events.join(', ') : 'Did not advance'}
                    </span>
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      )}

      {/* Metrics strip */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="grid grid-cols-3 divide-x divide-border text-center">
          <Stat label="Mentees" value={mentor.metrics.mentees} />
          <Stat label="Chats" value={mentor.metrics.chats} />
          <Stat label="Sessions" value={mentor.metrics.sessions} />
        </div>
      </div>

      {/* Reviews */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="mb-1 text-sm font-semibold">What mentees say</p>
        <p className="mb-4 text-xs text-muted-foreground">{COPY.rateHumans}</p>
        {mentor.reviews.length === 0 ? (
          <p className="rounded-xl bg-muted/30 px-4 py-5 text-center text-sm text-muted-foreground">
            No reviews yet — be the first to write one after a meaningful conversation.
          </p>
        ) : (
          <ul className="space-y-4">
            {mentor.reviews.map((r) => (
              <li key={r.id} className="flex items-start gap-3">
                <LetterAvatar
                  letter={r.author.avatarLetter}
                  color={r.author.avatarColor}
                  size={28}
                />
                <div>
                  <p className="text-sm">{r.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {r.author.displayHandle} · {new Date(r.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Anonymity reassurance footer */}
      <div className="rounded-xl border border-dashed border-border bg-muted/20 px-5 py-4 text-center text-xs text-muted-foreground">
        You stay anonymous. They stay anonymous. Mento never reveals either side&apos;s name, phone,
        or photo.
      </div>

      {/* Sticky CTA bar */}
      <div
        className={`fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 py-3 backdrop-blur-sm transition-transform duration-200 ${
          stickyVisible ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <LetterAvatar
              letter={mentor.avatarLetter}
              color={mentor.avatarColor}
              size={36}
            />
            <span className="truncate text-sm font-medium">{mentor.displayHandle}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              disabled
              title="1:1 sessions coming soon"
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground opacity-60"
            >
              Request 1:1
            </button>
            <button
              onClick={() => setShowRequest(true)}
              className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Initiate connection
            </button>
          </div>
        </div>
      </div>

      {/* 160-char intro modal */}
      {showRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6">
          <div className="w-full max-w-md rounded-2xl bg-background p-6 shadow-xl">
            {requestSent ? (
              <div className="space-y-4 text-center">
                <p className="text-base font-medium">Request sent.</p>
                <p className="text-sm text-muted-foreground">
                  When the mentor accepts, your conversation will appear in Chats.
                </p>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-semibold">Send an intro</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  160 characters. Be honest. Tell them what you need.
                </p>
                <textarea
                  value={intro}
                  onChange={(e) => setIntro(e.target.value.slice(0, 160))}
                  placeholder="Hi, I'm preparing for Prelims and struggling with..."
                  className="mt-3 h-28 w-full rounded-md border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <div className="mt-1 text-right text-xs text-muted-foreground">
                  {intro.length}/160
                </div>
                {requestError && <p className="mt-2 text-sm text-red-600">{requestError}</p>}
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => setShowRequest(false)}
                    className="flex-1 rounded-md border px-4 py-2 text-sm hover:bg-accent"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={send}
                    disabled={!intro.trim() || busy}
                    className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                  >
                    {busy ? 'Sending...' : 'Send request'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="py-1">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}
