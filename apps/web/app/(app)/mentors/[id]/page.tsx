'use client'

import { useEffect, useState } from 'react'
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

export default function MentorProfilePage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const [mentor, setMentor] = useState<MentorDetail | null>(null)
  const [showRequest, setShowRequest] = useState(false)
  const [intro, setIntro] = useState('')
  const [busy, setBusy] = useState(false)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [requestSent, setRequestSent] = useState(false)

  useEffect(() => {
    if (!params.id) return
    getApiClient()
      .mentors.detail(params.id)
      .then(setMentor)
      .catch(() => {})
  }, [params.id])

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

  if (!mentor) return <p className="text-sm text-muted-foreground">Loading mentor…</p>

  const history = (mentor.attemptHistory ?? []) as AttemptYear[]

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header — top 60-70% per spec */}
      <div className="rounded-2xl border bg-card p-6">
        <div className="flex items-start gap-5">
          <LetterAvatar
            letter={mentor.avatarLetter}
            color={mentor.avatarColor}
            hasPurpleTick={mentor.hasPurpleTick}
            size={72}
          />
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{mentor.displayHandle}</h1>
              {mentor.isVerified && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                  Verified
                </span>
              )}
              {mentor.isFoundingPartner && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                  Founding partner
                </span>
              )}
            </div>
            {mentor.rankAchieved && (
              <p className="mt-1 text-sm text-muted-foreground">
                UPSC Rank — {mentor.rankAchieved}
              </p>
            )}
            <p className="mt-1 text-sm text-muted-foreground">
              ₹{mentor.hourlyRateInr}/hr · {mentor.languages.join(', ')}
            </p>
          </div>
        </div>

        {/* Year-by-year journey timeline — Section 1.18 */}
        {history.length > 0 && (
          <div className="mt-6">
            <p className="mb-2 text-sm font-medium">UPSC journey</p>
            <ul className="space-y-1 text-sm">
              {history.map((h, i) => (
                <li key={i} className="text-muted-foreground">
                  <span className="font-medium text-foreground">{h.year}</span> —{' '}
                  {[
                    h.prelims && 'Prelims cleared',
                    h.mains && 'Mains written',
                    h.interview && 'Interview attended',
                  ]
                    .filter(Boolean)
                    .join(', ') || 'Did not advance'}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Comfortable in providing */}
        {mentor.guidanceCategories.length > 0 && (
          <div className="mt-6">
            <p className="mb-2 text-sm font-medium">Comfortable guiding</p>
            <div className="flex flex-wrap gap-2">
              {mentor.guidanceCategories.map((c) => (
                <span
                  key={c}
                  className="rounded-full bg-muted/50 px-3 py-1 text-xs"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}
        {mentor.optionalSubject && (
          <p className="mt-3 text-sm text-muted-foreground">
            Optional subject: <span className="text-foreground">{mentor.optionalSubject}</span>
          </p>
        )}

        {/* CTAs */}
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={() => setShowRequest(true)}
            className="rounded-md bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Initiate connection
          </button>
          <button
            disabled
            className="rounded-md bg-amber-500/80 px-5 py-2 text-sm font-medium text-white opacity-60"
            title="1:1 sessions ship in v1.1"
          >
            Request 1-on-1 session
          </button>
        </div>
      </div>

      {/* Bottom 30-40% — metrics + reviews */}
      <div className="rounded-2xl border bg-card p-6">
        <div className="grid grid-cols-3 gap-4 text-center">
          <Stat label="Mentees" value={mentor.metrics.mentees} />
          <Stat label="Chats" value={mentor.metrics.chats} />
          <Stat label="Sessions" value={mentor.metrics.sessions} />
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-6">
        <p className="mb-4 text-sm font-medium">What mentees say</p>
        <p className="mb-3 text-xs text-muted-foreground">{COPY.rateHumans}</p>
        {mentor.reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">No reviews yet.</p>
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

      {/* 160-char intro request modal */}
      {showRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6">
          <div className="w-full max-w-md rounded-2xl bg-background p-6">
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
                  placeholder="Hi, I'm preparing for Prelims and struggling with…"
                  className="mt-3 h-28 w-full rounded-md border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <div className="mt-1 text-right text-xs text-muted-foreground">
                  {intro.length}/160
                </div>
                {requestError && (
                  <p className="mt-2 text-sm text-red-600">{requestError}</p>
                )}
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
                    {busy ? 'Sending…' : 'Send request'}
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
    <div>
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}
