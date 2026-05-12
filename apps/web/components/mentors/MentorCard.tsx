'use client'

import Link from 'next/link'
import type { AvatarColor, AvatarLetter } from '@mento/types'
import { LetterAvatar } from '@/components/LetterAvatar'

export type MentorListItem = {
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
  online?: boolean
}

function buildTrustLine(m: MentorListItem): string {
  const parts: string[] = []
  if (m.interviewAttempts > 0) {
    parts.push(`Interview attended${m.interviewAttempts > 1 ? ` ${m.interviewAttempts}×` : ''}`)
  } else if (m.mainsAttempts > 0) {
    parts.push(`Mains written${m.mainsAttempts > 1 ? ` ${m.mainsAttempts}×` : ''}`)
  } else if (m.prelimsCleared) {
    parts.push('Prelims cleared')
  }
  if (m.rankAchieved) {
    parts.push(`Rank ${m.rankAchieved}`)
  }
  return parts.join(' · ') || 'Active mentor'
}

export function MentorCard({ m }: { m: MentorListItem }) {
  const trustLine = buildTrustLine(m)

  return (
    <li>
      <Link
        href={`/mentors/${m.userId}`}
        className="group flex flex-col rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/30 hover:shadow-md hover:shadow-primary/5"
      >
        {/* Header row */}
        <div className="flex items-start gap-3">
          <div className="relative">
            <LetterAvatar
              letter={m.avatarLetter}
              color={m.avatarColor}
              hasPurpleTick={m.hasPurpleTick}
              size={48}
            />
            {m.online && (
              <span
                className="absolute -bottom-0.5 -left-0.5 h-3 w-3 rounded-full border-2 border-background bg-green-500"
                aria-label="Online now"
                title="Online now"
              />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="truncate text-base font-semibold leading-tight">
                {m.displayHandle}
              </span>
              {m.isVerified && (
                <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium tracking-wide text-emerald-700">
                  Verified
                </span>
              )}
              {m.isFoundingPartner && (
                <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium tracking-wide text-amber-800">
                  Founding
                </span>
              )}
            </div>

            {/* Trust line — most credible signal */}
            <p className="mt-0.5 text-sm font-medium text-foreground/70">{trustLine}</p>
          </div>
        </div>

        {/* Language pills */}
        {m.languages.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {m.languages.slice(0, 4).map((lang) => (
              <span
                key={lang}
                className="rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground"
              >
                {lang}
              </span>
            ))}
          </div>
        )}

        {/* Guidance categories */}
        {m.guidanceCategories.length > 0 && (
          <p className="mt-2.5 text-xs text-muted-foreground">
            <span className="font-medium text-foreground/60">Guides:</span>{' '}
            {m.guidanceCategories.slice(0, 4).join(' · ')}
          </p>
        )}

        {/* Rate row */}
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-primary/8 px-2.5 py-1 text-[11px] font-medium text-primary">
              Chat free
            </span>
            <span className="rounded-full bg-muted/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              1:1 ₹{m.hourlyRateInr}/hr
            </span>
          </div>
          <span className="text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
            View profile →
          </span>
        </div>
      </Link>
    </li>
  )
}
