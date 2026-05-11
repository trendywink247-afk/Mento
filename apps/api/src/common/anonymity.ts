import { AvatarColor, AvatarLetter, JourneyStage, MentorJourney, Role } from '@prisma/client'
import { randomInt } from 'crypto'

const HANDLE_PREFIX_BY_LETTER: Record<AvatarLetter, string> = {
  B: 'Aspirant',
  A: 'Aspirant',
  P: 'Mentor_P',
  M: 'Mentor_M',
  I: 'Mentor_I',
  F: 'Founder',
}

const COLOR_BY_LETTER: Record<AvatarLetter, AvatarColor> = {
  B: AvatarColor.SLATE,
  A: AvatarColor.AMBER,
  P: AvatarColor.SKY,
  M: AvatarColor.FOREST,
  I: AvatarColor.PURPLE,
  F: AvatarColor.GOLD,
}

export function generateDisplayHandle(letter: AvatarLetter, salt?: string): string {
  // 4-digit random suffix from CSPRNG; pre-check uniqueness at insert time and retry on conflict.
  const random = randomInt(1000, 10_000)
  const seed = salt ? `_${salt.slice(0, 4)}` : ''
  return `${HANDLE_PREFIX_BY_LETTER[letter]}${seed}_${random}`
}

export function colorForLetter(letter: AvatarLetter): AvatarColor {
  return COLOR_BY_LETTER[letter]
}

// Letter taxonomy from spec section 1.17 — show HIGHEST achievement only.
export function letterForMenteeStage(stage: JourneyStage): AvatarLetter {
  switch (stage) {
    case JourneyStage.PRELIMS_CLEARED:
      return AvatarLetter.P
    case JourneyStage.MAINS_WRITTEN:
      return AvatarLetter.M
    case JourneyStage.INTERVIEW_ATTEMPTED:
    case JourneyStage.MULTI_INTERVIEW:
      return AvatarLetter.I
    case JourneyStage.MULTI_PRELIMS_NO_CLEAR:
    case JourneyStage.ONE_PRELIMS_ATTEMPT:
      return AvatarLetter.A
    case JourneyStage.ABOUT_TO_START:
    case JourneyStage.ONE_YEAR_IN:
    case JourneyStage.TWO_YEARS_IN_NO_PRELIMS:
    default:
      return AvatarLetter.B
  }
}

export function letterForMentorJourney(
  journey: MentorJourney,
  isFoundingPartner: boolean,
): AvatarLetter {
  if (isFoundingPartner) return AvatarLetter.F
  switch (journey) {
    case MentorJourney.INTERVIEW_ONCE:
    case MentorJourney.INTERVIEW_MULTI:
    case MentorJourney.DONE_CLEARED:
      return AvatarLetter.I
    case MentorJourney.MAINS_ONCE:
    case MentorJourney.MAINS_MULTI:
      return AvatarLetter.M
    case MentorJourney.PRELIMS_CLEARED:
    case MentorJourney.STILL_PREPARING:
    case MentorJourney.WORKING_AND_PREPARING:
    case MentorJourney.DONE_NOT_PREPARING:
    default:
      return AvatarLetter.P
  }
}

export function defaultLetterForRole(role: Role): AvatarLetter {
  switch (role) {
    case Role.MENTOR:
      return AvatarLetter.P
    case Role.ADMIN:
      return AvatarLetter.F
    case Role.ASPIRANT:
    case Role.COORDINATOR:
    default:
      return AvatarLetter.B
  }
}
