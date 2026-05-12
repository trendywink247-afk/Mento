'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { AvatarColor, AvatarLetter } from '@mento/types'
import { getApiClient } from '@/lib/api'
import { LetterAvatar } from '@/components/LetterAvatar'
import { MotionFade, MotionStagger, MotionStaggerItem, MotionTap } from '@/components/motion'

type Mentor = {
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
  optionalSubject: string | null
  guidanceCategories: string[]
  languages: string[]
  hourlyRateInr: number
  rankAchieved: number | null
}

export default function MentorsPage() {
  const [mentors, setMentors] = useState<Mentor[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [interviewOnly, setInterviewOnly] = useState(false)

  useEffect(() => {
    let mounted = true
    getApiClient()
      .mentors.list({
        isVerified: verifiedOnly ? true : undefined,
        interviewAttempted: interviewOnly ? true : undefined,
      })
      .then((rows) => mounted && setMentors(rows))
      .catch((err: unknown) =>
        mounted && setError(err instanceof Error ? err.message : 'Failed'),
      )
    return () => {
      mounted = false
    }
  }, [verifiedOnly, interviewOnly])

  return (
    <div className="space-y-6">
      <MotionFade>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mentors</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Verified, anonymous mentors who&apos;ve walked the UPSC path.
          </p>
        </div>
      </MotionFade>

      <MotionFade delay={0.06}>
        <div className="flex flex-wrap gap-2">
          <Toggle label="Verified only" value={verifiedOnly} onChange={setVerifiedOnly} />
          <Toggle label="Interview-attempted" value={interviewOnly} onChange={setInterviewOnly} />
        </div>
      </MotionFade>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {mentors === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : mentors.length === 0 ? (
        <MotionFade>
          <div className="rounded-lg border bg-muted/30 p-6 text-sm text-muted-foreground">
            No mentors match your filters yet. Mentors are joining every week.
          </div>
        </MotionFade>
      ) : (
        <MotionStagger staggerDelay={0.05} className="grid gap-3 md:grid-cols-2">
          {mentors.slice(0, 12).map((m) => (
            <MotionStaggerItem key={m.userId}>
              <MotionTap>
                <Link
                  href={`/mentors/${m.userId}`}
                  className="block rounded-2xl border bg-card p-5 transition-shadow hover:shadow-sm"
                >
                  <div className="flex items-start gap-4">
                    <LetterAvatar
                      letter={m.avatarLetter}
                      color={m.avatarColor}
                      hasPurpleTick={m.hasPurpleTick}
                      size={48}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-base font-medium">{m.displayHandle}</p>
                        {m.isVerified && (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                            Verified
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {m.interviewAttempts > 0
                          ? `Interview · ${m.interviewAttempts}×`
                          : m.mainsAttempts > 0
                            ? `Mains · ${m.mainsAttempts}×`
                            : m.prelimsCleared
                              ? 'Prelims cleared'
                              : 'Aspirant'}
                        {m.rankAchieved && ` · Rank ${m.rankAchieved}`}
                      </p>
                      {m.guidanceCategories.length > 0 && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {m.guidanceCategories.slice(0, 4).join(' · ')}
                        </p>
                      )}
                      <p className="mt-2 text-xs text-muted-foreground">
                        ₹{m.hourlyRateInr}/hr · {m.languages.join(', ')}
                      </p>
                    </div>
                  </div>
                </Link>
              </MotionTap>
            </MotionStaggerItem>
          ))}
          {/* Remaining mentors beyond the first 12 fade in without stagger */}
          {mentors.length > 12 && mentors.slice(12).map((m) => (
            <MotionFade key={m.userId}>
              <MotionTap>
                <Link
                  href={`/mentors/${m.userId}`}
                  className="block rounded-2xl border bg-card p-5 transition-shadow hover:shadow-sm"
                >
                  <div className="flex items-start gap-4">
                    <LetterAvatar
                      letter={m.avatarLetter}
                      color={m.avatarColor}
                      hasPurpleTick={m.hasPurpleTick}
                      size={48}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-base font-medium">{m.displayHandle}</p>
                        {m.isVerified && (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                            Verified
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {m.interviewAttempts > 0
                          ? `Interview · ${m.interviewAttempts}×`
                          : m.mainsAttempts > 0
                            ? `Mains · ${m.mainsAttempts}×`
                            : m.prelimsCleared
                              ? 'Prelims cleared'
                              : 'Aspirant'}
                        {m.rankAchieved && ` · Rank ${m.rankAchieved}`}
                      </p>
                      {m.guidanceCategories.length > 0 && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {m.guidanceCategories.slice(0, 4).join(' · ')}
                        </p>
                      )}
                      <p className="mt-2 text-xs text-muted-foreground">
                        ₹{m.hourlyRateInr}/hr · {m.languages.join(', ')}
                      </p>
                    </div>
                  </div>
                </Link>
              </MotionTap>
            </MotionFade>
          ))}
        </MotionStagger>
      )}
    </div>
  )
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <MotionTap>
      <button
        onClick={() => onChange(!value)}
        className={`rounded-full border px-3 py-1 text-xs ${
          value ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-background'
        }`}
      >
        {label}
      </button>
    </MotionTap>
  )
}
