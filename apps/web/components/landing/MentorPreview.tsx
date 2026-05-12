import type { AvatarColor, AvatarLetter } from '@mento/types'
import { LetterAvatar } from '@/components/LetterAvatar'

interface MentorCard {
  userId: string
  displayHandle: string
  avatarLetter: AvatarLetter
  avatarColor: AvatarColor
  hasPurpleTick: boolean
  prelimsCleared: boolean
  mainsAttempts: number
  interviewAttempts: number
  guidanceCategories: string[]
}

function buildJourneyLabel(mentor: MentorCard): string {
  if (mentor.interviewAttempts > 0) {
    return `Interview ${mentor.interviewAttempts > 1 ? `(${mentor.interviewAttempts}×)` : ''} • Mains cleared`
  }
  if (mentor.mainsAttempts > 0) {
    return `Mains written ${mentor.mainsAttempts > 1 ? `${mentor.mainsAttempts}×` : ''}`
  }
  if (mentor.prelimsCleared) return 'Prelims cleared'
  return 'Experienced aspirant'
}

interface Props {
  mentors: MentorCard[]
}

export function MentorPreview({ mentors }: Props) {
  if (mentors.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Mentors are joining. Be among the first.
      </p>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {mentors.slice(0, 6).map((mentor) => (
        <div
          key={mentor.userId}
          className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
        >
          <LetterAvatar
            letter={mentor.avatarLetter}
            color={mentor.avatarColor}
            hasPurpleTick={mentor.hasPurpleTick}
            size={44}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{mentor.displayHandle}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{buildJourneyLabel(mentor)}</p>
          </div>
          {mentor.guidanceCategories.length > 0 && (
            <span className="flex-shrink-0 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              {mentor.guidanceCategories[0]}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
