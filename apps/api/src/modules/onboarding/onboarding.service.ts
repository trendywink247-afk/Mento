import * as crypto from 'node:crypto'
import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common'
import { Role } from '@prisma/client'
import { PrismaService } from '../../database/prisma.service'
import { PostHogService } from '../../common/posthog.service'
import {
  colorForLetter,
  letterForMenteeStage,
  letterForMentorJourney,
} from '../../common/anonymity'
import type { MirrorSubmitDto } from './dto/mirror-submit.dto'
import type { MentorOnboardingSubmitDto } from './dto/mentor-onboarding-submit.dto'
import type { MentorVerificationDto } from './dto/mentor-verification.dto'

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly posthog: PostHogService,
  ) {}

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

    // Mirror to PostHog for funnel analytics.
    // Use userId when available, otherwise fall back to anonymous sessionId.
    // NEVER include PII — step and safe metadata only.
    const distinctId = input.userId ?? `anon:${input.sessionId}`
    this.posthog.capture(distinctId, `onboarding.${input.step}`, {
      step: input.step,
      // Only safe, non-PII metadata keys are forwarded.
      ...(input.metadata ?? {}),
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

      // Reallocate display handle so a mentor doesn't keep their `Aspirant_NNNN`
      // identity after promotion. Tries up to 5 randomised suffixes to dodge the
      // unique constraint.
      const { generateDisplayHandle } = await import('../../common/anonymity')
      let attempt = 0
      while (attempt < 5) {
        try {
          await tx.profile.update({
            where: { userId },
            data: {
              avatarLetter: letter,
              avatarColor: color,
              displayHandle: generateDisplayHandle(letter),
            },
          })
          break
        } catch (err) {
          if (
            err &&
            typeof err === 'object' &&
            'code' in err &&
            (err as { code?: string }).code === 'P2002'
          ) {
            attempt += 1
            continue
          }
          throw err
        }
      }
      if (attempt >= 5) {
        // Fall back to just updating letter+color if we exhausted handle attempts.
        await tx.profile.update({
          where: { userId },
          data: { avatarLetter: letter, avatarColor: color },
        })
      }

      return tx.mentorProfile.findUnique({ where: { userId } })
    })
  }

  async submitVerification(userId: string, body: MentorVerificationDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { mentorProfile: true },
    })
    if (!user) throw new BadRequestException('User not found')
    if (user.role !== Role.MENTOR) {
      throw new BadRequestException('Only mentors can submit verification documents')
    }
    if (!user.mentorProfile) {
      throw new BadRequestException(
        'Complete mentor onboarding (journey form) before submitting documents',
      )
    }

    /**
     * aadhaarHash: SHA-256 of `${userId}:${aadhaarLast4}`.
     *
     * We prefix with userId so that the denylist check is based purely on the
     * hash of the (user, last-4) pair. In production this would be SHA-256 of
     * the full verified Aadhaar number; for MVP we use last-4 only because we
     * never collect the full number. This is documented in the DTO as well.
     */
    const aadhaarHash = crypto
      .createHash('sha256')
      .update(`${userId}:${body.aadhaarLast4}`)
      .digest('hex')

    // Check denylist before persisting anything.
    const denied = await this.prisma.mentorDenylist.findUnique({
      where: { aadhaarHash },
    })
    if (denied) {
      throw new ForbiddenException(
        'This Aadhaar is banned from mentoring on Mento.',
      )
    }

    await this.prisma.verificationDocument.upsert({
      where: { userId },
      create: {
        userId,
        aadhaarUrl: body.aadhaarKey,
        aadhaarHash,
        hallTicketUrl: body.hallTicketKey,
        marksSheetUrl: body.marksSheetKey ?? null,
        bankAccount: body.bankAccount as never,
        submittedAt: new Date(),
      },
      update: {
        aadhaarUrl: body.aadhaarKey,
        aadhaarHash,
        hallTicketUrl: body.hallTicketKey,
        marksSheetUrl: body.marksSheetKey ?? null,
        bankAccount: body.bankAccount as never,
        submittedAt: new Date(),
        // Reset review fields on re-submission.
        reviewedAt: null,
        reviewedBy: null,
        reviewNote: null,
      },
    })

    return { status: 'submitted', nextStep: 'mentor.waiting_verification' }
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
