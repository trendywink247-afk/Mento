import { Injectable, NotFoundException } from '@nestjs/common'
import { Prisma, Role } from '@prisma/client'
import { PrismaService } from '../../database/prisma.service'

export interface MentorListFilters {
  prelimsCleared?: boolean
  mainsAttempts?: number
  interviewAttempted?: boolean
  language?: string
  optionalSubject?: string
  guidanceCategory?: string
  maxRateInr?: number
  search?: string
  isVerified?: boolean
}

@Injectable()
export class MentorsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(filters: MentorListFilters = {}) {
    const where: Prisma.MentorProfileWhereInput = {
      user: {
        role: Role.MENTOR,
        status: 'ACTIVE',
        deletedAt: null,
        bannedAt: null,
      },
    }
    if (filters.prelimsCleared !== undefined) where.prelimsCleared = filters.prelimsCleared
    if (filters.mainsAttempts !== undefined) where.mainsAttempts = { gte: filters.mainsAttempts }
    if (filters.interviewAttempted) where.interviewAttempts = { gte: 1 }
    if (filters.optionalSubject) where.optionalSubject = filters.optionalSubject
    if (filters.guidanceCategory) where.guidanceCategories = { has: filters.guidanceCategory }
    if (filters.language) where.languages = { has: filters.language }
    if (filters.maxRateInr !== undefined) where.hourlyRateInr = { lte: filters.maxRateInr }
    if (filters.isVerified !== undefined) where.isVerified = filters.isVerified

    const rows = await this.prisma.mentorProfile.findMany({
      where,
      orderBy: [{ isVerified: 'desc' }, { isFoundingPartner: 'desc' }, { createdAt: 'desc' }],
      include: {
        user: { include: { profile: true } },
      },
      take: 100,
    })

    return rows.map((m) => ({
      userId: m.userId,
      displayHandle: m.user.profile?.displayHandle ?? `Mentor_${m.userId.slice(0, 4)}`,
      avatarLetter: m.user.profile?.avatarLetter ?? 'P',
      avatarColor: m.user.profile?.avatarColor ?? 'SKY',
      hasPurpleTick: m.user.profile?.hasPurpleTick ?? false,
      isVerified: m.isVerified,
      isFoundingPartner: m.isFoundingPartner,
      prelimsCleared: m.prelimsCleared,
      mainsAttempts: m.mainsAttempts,
      interviewAttempts: m.interviewAttempts,
      optionalSubject: m.optionalSubject,
      guidanceCategories: m.guidanceCategories,
      languages: m.languages,
      hourlyRateInr: m.hourlyRateInr,
      rankAchieved: m.rankAchieved,
    }))
  }

  async detail(userId: string) {
    const mentor = await this.prisma.mentorProfile.findUnique({
      where: { userId },
      include: { user: { include: { profile: true } } },
    })
    if (!mentor || mentor.user.role !== Role.MENTOR) {
      throw new NotFoundException('Mentor not found')
    }

    const reviews = await this.prisma.review.findMany({
      where: { subjectId: userId, isPublished: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { author: { include: { profile: true } } },
    })

    const messageCount = await this.prisma.message.count({
      where: { conversation: { mentorId: userId } },
    })
    const conversationCount = await this.prisma.conversation.count({
      where: { mentorId: userId },
    })
    const sessionCount = await this.prisma.session.count({
      where: { request: { mentorId: userId } },
    })

    return {
      userId: mentor.userId,
      displayHandle: mentor.user.profile?.displayHandle ?? `Mentor_${userId.slice(0, 4)}`,
      avatarLetter: mentor.user.profile?.avatarLetter ?? 'P',
      avatarColor: mentor.user.profile?.avatarColor ?? 'SKY',
      hasPurpleTick: mentor.user.profile?.hasPurpleTick ?? false,
      isVerified: mentor.isVerified,
      isFoundingPartner: mentor.isFoundingPartner,
      prelimsCleared: mentor.prelimsCleared,
      mainsAttempts: mentor.mainsAttempts,
      interviewAttempts: mentor.interviewAttempts,
      attemptHistory: mentor.attemptHistory,
      rankAchieved: mentor.rankAchieved,
      optionalSubject: mentor.optionalSubject,
      guidanceCategories: mentor.guidanceCategories,
      languages: mentor.languages,
      hourlyRateInr: mentor.hourlyRateInr,
      metrics: {
        chats: messageCount,
        mentees: conversationCount,
        sessions: sessionCount,
      },
      reviews: reviews.map((r) => ({
        id: r.id,
        body: r.body,
        createdAt: r.createdAt.toISOString(),
        author: {
          displayHandle: r.author.profile?.displayHandle ?? '—',
          avatarLetter: r.author.profile?.avatarLetter ?? 'B',
          avatarColor: r.author.profile?.avatarColor ?? 'SLATE',
        },
      })),
    }
  }
}
