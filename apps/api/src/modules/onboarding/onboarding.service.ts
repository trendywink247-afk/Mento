import { BadRequestException, Injectable } from '@nestjs/common'
import { Role } from '@prisma/client'
import { PrismaService } from '../../database/prisma.service'
import {
  colorForLetter,
  letterForMenteeStage,
  letterForMentorJourney,
} from '../../common/anonymity'
import type { MirrorSubmitDto } from './dto/mirror-submit.dto'
import type { MentorOnboardingSubmitDto } from './dto/mentor-onboarding-submit.dto'

@Injectable()
export class OnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  async trackEvent(input: {
    sessionId: string
    step: string
    userId?: string
    metadata?: Record<string, unknown>
  }) {
    await this.prisma.onboardingEvent.create({
      data: {
        sessionId: input.sessionId,
        step: input.step,
        userId: input.userId,
        metadata: (input.metadata ?? {}) as never,
      },
    })
  }

  async submitMirror(userId: string, body: MirrorSubmitDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new BadRequestException('User not found')
    if (user.role !== Role.ASPIRANT && user.role !== Role.MENTOR) {
      throw new BadRequestException('Mirror only applies to mentee/mentor accounts')
    }

    const letter = letterForMenteeStage(body.journeyStage)
    const color = colorForLetter(letter)

    return this.prisma.$transaction(async (tx) => {
      await tx.menteeProfile.upsert({
        where: { userId },
        create: {
          userId,
          journeyStage: body.journeyStage,
          background: body.background,
          knowledge: body.knowledge as never,
          challenges: body.challenges,
          mirrorCompletedAt: new Date(),
        },
        update: {
          journeyStage: body.journeyStage,
          background: body.background,
          knowledge: body.knowledge as never,
          challenges: body.challenges,
          mirrorCompletedAt: new Date(),
        },
      })

      // Bump letter/color on profile if we have a higher achievement signal.
      await tx.profile.update({
        where: { userId },
        data: { avatarLetter: letter, avatarColor: color },
      })

      return tx.menteeProfile.findUnique({ where: { userId } })
    })
  }

  async submitMentorOnboarding(userId: string, body: MentorOnboardingSubmitDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new BadRequestException('User not found')

    const letter = letterForMentorJourney(body.journeyType, false)
    const color = colorForLetter(letter)

    return this.prisma.$transaction(async (tx) => {
      // Promote to MENTOR role if currently ASPIRANT — they came in via role-pick=mentor.
      if (user.role === Role.ASPIRANT) {
        await tx.user.update({ where: { id: userId }, data: { role: Role.MENTOR } })
      }

      await tx.mentorProfile.upsert({
        where: { userId },
        create: {
          userId,
          journeyType: body.journeyType,
          prelimsCleared: body.prelimsCleared,
          mainsAttempts: body.mainsAttempts,
          interviewAttempts: body.interviewAttempts,
          attemptHistory: body.attemptHistory as never,
          rankAchieved: body.rankAchieved,
          optionalSubject: body.optionalSubject,
          guidanceCategories: body.guidanceCategories,
          languages: body.languages,
          hourlyRateInr: body.hourlyRateInr ?? 400,
          isFoundingPartner: body.journeyType === 'FOUNDING_MENTOR_PARTNER',
        },
        update: {
          journeyType: body.journeyType,
          prelimsCleared: body.prelimsCleared,
          mainsAttempts: body.mainsAttempts,
          interviewAttempts: body.interviewAttempts,
          attemptHistory: body.attemptHistory as never,
          rankAchieved: body.rankAchieved,
          optionalSubject: body.optionalSubject,
          guidanceCategories: body.guidanceCategories,
          languages: body.languages,
          hourlyRateInr: body.hourlyRateInr ?? 400,
        },
      })

      await tx.profile.update({
        where: { userId },
        data: { avatarLetter: letter, avatarColor: color },
      })

      return tx.mentorProfile.findUnique({ where: { userId } })
    })
  }

  async getOnboardingState(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { menteeProfile: true, mentorProfile: true, verification: true },
    })
    if (!user) return null

    const isMentee = user.role === Role.ASPIRANT
    const isMentor = user.role === Role.MENTOR
    const isAdmin = user.role === Role.ADMIN

    const mirrorComplete = !!user.menteeProfile?.mirrorCompletedAt
    const mentorOnboardingSubmitted = !!user.mentorProfile
    const mentorVerified = !!user.mentorProfile?.isVerified
    const verificationDocsSubmitted = !!user.verification?.submittedAt

    let nextStep: string | null = null
    if (isAdmin) {
      nextStep = null
    } else if (isMentor) {
      if (!mentorOnboardingSubmitted) nextStep = 'mentor.journey'
      else if (!verificationDocsSubmitted) nextStep = 'mentor.credentials'
      else if (!mentorVerified) nextStep = 'mentor.waiting_verification'
      else nextStep = null
    } else if (isMentee) {
      if (!mirrorComplete) nextStep = 'mentee.mirror'
      else nextStep = null
    }

    return {
      role: user.role,
      mirrorComplete,
      mentorOnboardingSubmitted,
      mentorVerified,
      verificationDocsSubmitted,
      nextStep,
    }
  }
}
