import { describe, it, expect } from 'vitest'
import { AvatarColor, AvatarLetter, JourneyStage, MentorJourney, Role } from '@prisma/client'
import {
  generateDisplayHandle,
  colorForLetter,
  defaultLetterForRole,
  letterForMenteeStage,
  letterForMentorJourney,
} from './anonymity'

describe('generateDisplayHandle', () => {
  it('returns a string for every AvatarLetter', () => {
    const letters = Object.values(AvatarLetter) as AvatarLetter[]
    for (const letter of letters) {
      const handle = generateDisplayHandle(letter)
      expect(typeof handle).toBe('string')
      expect(handle.length).toBeGreaterThan(0)
    }
  })

  it('format matches "{Prefix}_{NNNN}" — 4-digit numeric suffix', () => {
    const handle = generateDisplayHandle(AvatarLetter.B)
    // Ends with underscore + 4 digits
    expect(handle).toMatch(/_\d{4}$/)
  })

  it('includes a salt slice when salt is provided', () => {
    const handle = generateDisplayHandle(AvatarLetter.A, 'abcd')
    // Prefix contains _abcd_ from the salt
    expect(handle).toContain('_abcd_')
  })

  it('produces high-entropy handles — handles are not all identical in 1000 calls', () => {
    const handles = new Set<string>()
    for (let i = 0; i < 1000; i++) {
      handles.add(generateDisplayHandle(AvatarLetter.B))
    }
    // 9000 possible suffixes (1000–9999).
    // Birthday-problem math: expected unique count ≈ 9000*(1 - e^(-1000/9000)) ≈ 946.
    // Threshold of 800 is >4σ below the mean — would only fail with broken PRNG.
    expect(handles.size).toBeGreaterThanOrEqual(800)
  })

  it('letter B uses Aspirant prefix', () => {
    const handle = generateDisplayHandle(AvatarLetter.B)
    expect(handle.startsWith('Aspirant')).toBe(true)
  })

  it('letter A uses Aspirant prefix', () => {
    const handle = generateDisplayHandle(AvatarLetter.A)
    expect(handle.startsWith('Aspirant')).toBe(true)
  })

  it('letter P uses Mentor_P prefix', () => {
    const handle = generateDisplayHandle(AvatarLetter.P)
    expect(handle.startsWith('Mentor_P')).toBe(true)
  })

  it('letter M uses Mentor_M prefix', () => {
    const handle = generateDisplayHandle(AvatarLetter.M)
    expect(handle.startsWith('Mentor_M')).toBe(true)
  })

  it('letter I uses Mentor_I prefix', () => {
    const handle = generateDisplayHandle(AvatarLetter.I)
    expect(handle.startsWith('Mentor_I')).toBe(true)
  })

  it('letter F uses Founder prefix', () => {
    const handle = generateDisplayHandle(AvatarLetter.F)
    expect(handle.startsWith('Founder')).toBe(true)
  })
})

describe('defaultLetterForRole', () => {
  it('ASPIRANT -> B', () => {
    expect(defaultLetterForRole(Role.ASPIRANT)).toBe(AvatarLetter.B)
  })

  it('MENTOR -> P', () => {
    expect(defaultLetterForRole(Role.MENTOR)).toBe(AvatarLetter.P)
  })

  it('ADMIN -> F', () => {
    expect(defaultLetterForRole(Role.ADMIN)).toBe(AvatarLetter.F)
  })

  it('COORDINATOR -> B (fallback)', () => {
    expect(defaultLetterForRole(Role.COORDINATOR)).toBe(AvatarLetter.B)
  })
})

describe('colorForLetter', () => {
  // Snapshot the full mapping so regressions are visible.
  const expectedMapping: Record<AvatarLetter, AvatarColor> = {
    [AvatarLetter.B]: AvatarColor.SLATE,
    [AvatarLetter.A]: AvatarColor.AMBER,
    [AvatarLetter.P]: AvatarColor.SKY,
    [AvatarLetter.M]: AvatarColor.FOREST,
    [AvatarLetter.I]: AvatarColor.PURPLE,
    [AvatarLetter.F]: AvatarColor.GOLD,
  }

  const letters = Object.values(AvatarLetter) as AvatarLetter[]
  for (const letter of letters) {
    it(`letter ${letter} -> ${expectedMapping[letter]}`, () => {
      expect(colorForLetter(letter)).toBe(expectedMapping[letter])
    })
  }

  it('returns a valid AvatarColor for every letter', () => {
    const validColors = new Set(Object.values(AvatarColor))
    for (const letter of letters) {
      expect(validColors.has(colorForLetter(letter))).toBe(true)
    }
  })
})

describe('letterForMenteeStage', () => {
  it('PRELIMS_CLEARED -> P', () => {
    expect(letterForMenteeStage(JourneyStage.PRELIMS_CLEARED)).toBe(AvatarLetter.P)
  })

  it('MAINS_WRITTEN -> M', () => {
    expect(letterForMenteeStage(JourneyStage.MAINS_WRITTEN)).toBe(AvatarLetter.M)
  })

  it('INTERVIEW_ATTEMPTED -> I', () => {
    expect(letterForMenteeStage(JourneyStage.INTERVIEW_ATTEMPTED)).toBe(AvatarLetter.I)
  })

  it('MULTI_INTERVIEW -> I', () => {
    expect(letterForMenteeStage(JourneyStage.MULTI_INTERVIEW)).toBe(AvatarLetter.I)
  })

  it('ONE_PRELIMS_ATTEMPT -> A', () => {
    expect(letterForMenteeStage(JourneyStage.ONE_PRELIMS_ATTEMPT)).toBe(AvatarLetter.A)
  })

  it('MULTI_PRELIMS_NO_CLEAR -> A', () => {
    expect(letterForMenteeStage(JourneyStage.MULTI_PRELIMS_NO_CLEAR)).toBe(AvatarLetter.A)
  })

  it('ABOUT_TO_START -> B', () => {
    expect(letterForMenteeStage(JourneyStage.ABOUT_TO_START)).toBe(AvatarLetter.B)
  })

  it('ONE_YEAR_IN -> B', () => {
    expect(letterForMenteeStage(JourneyStage.ONE_YEAR_IN)).toBe(AvatarLetter.B)
  })

  it('TWO_YEARS_IN_NO_PRELIMS -> B', () => {
    expect(letterForMenteeStage(JourneyStage.TWO_YEARS_IN_NO_PRELIMS)).toBe(AvatarLetter.B)
  })
})

describe('letterForMentorJourney', () => {
  it('FOUNDING_MENTOR_PARTNER with isFoundingPartner=true -> F regardless of journey', () => {
    expect(letterForMentorJourney(MentorJourney.STILL_PREPARING, true)).toBe(AvatarLetter.F)
  })

  it('INTERVIEW_ONCE -> I', () => {
    expect(letterForMentorJourney(MentorJourney.INTERVIEW_ONCE, false)).toBe(AvatarLetter.I)
  })

  it('INTERVIEW_MULTI -> I', () => {
    expect(letterForMentorJourney(MentorJourney.INTERVIEW_MULTI, false)).toBe(AvatarLetter.I)
  })

  it('DONE_CLEARED -> I', () => {
    expect(letterForMentorJourney(MentorJourney.DONE_CLEARED, false)).toBe(AvatarLetter.I)
  })

  it('MAINS_ONCE -> M', () => {
    expect(letterForMentorJourney(MentorJourney.MAINS_ONCE, false)).toBe(AvatarLetter.M)
  })

  it('MAINS_MULTI -> M', () => {
    expect(letterForMentorJourney(MentorJourney.MAINS_MULTI, false)).toBe(AvatarLetter.M)
  })

  it('PRELIMS_CLEARED -> P', () => {
    expect(letterForMentorJourney(MentorJourney.PRELIMS_CLEARED, false)).toBe(AvatarLetter.P)
  })

  it('STILL_PREPARING -> P', () => {
    expect(letterForMentorJourney(MentorJourney.STILL_PREPARING, false)).toBe(AvatarLetter.P)
  })

  it('WORKING_AND_PREPARING -> P', () => {
    expect(letterForMentorJourney(MentorJourney.WORKING_AND_PREPARING, false)).toBe(AvatarLetter.P)
  })

  it('DONE_NOT_PREPARING -> P', () => {
    expect(letterForMentorJourney(MentorJourney.DONE_NOT_PREPARING, false)).toBe(AvatarLetter.P)
  })
})
