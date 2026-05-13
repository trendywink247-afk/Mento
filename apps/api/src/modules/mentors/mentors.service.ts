import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Prisma, Role } from '@prisma/client'
import { Redis } from 'ioredis'
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

// Cache all mentor-list responses for 30 seconds.
// New mentor verifications take at most 30 s to appear publicly.
const CACHE_KEY_PREFIX = 'mentors:list:'
const CACHE_TTL_SECS = 30

@Injectable()
export class MentorsService {
  private readonly logger = new Logger(MentorsService.name)
  private readonly redis: Redis

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.redis = new Redis(this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6379/0')
  }

  async list(filters: MentorListFilters = {}) {
    const cacheKey = `${CACHE_KEY_PREFIX}${JSON.stringify(filters)}`

    // Cache read — non-blocking; on error fall through to DB.
    try {
      const hit = await this.redis.get(cacheKey)
      if (hit) {
        return JSON.parse(hit) as object[]
      }
    } catch (err) {
      this.logger.warn('Redis get failed for mentors list cache', err)
    }

    const rows = await this.fetchFromDb(filters)

    // Cache write — fire-and-forget; failure does not break the response.
    try {
      await this.redis.set(cacheKey, JSON.stringify(rows), 'EX', CACHE_TTL_SECS)
    } catch (err) {
      this.logger.warn('Redis set failed for mentors list cache', err)
    }

    return rows
  }

  /**
   * Invalidate all cached mentor-list responses.
   * Call this whenever a mentor's visibility changes (approve, reject, ban).
   */
  async invalidateMentorListCache() {
    try {
      // KEYS is acceptable here: the key-space is small (< 100 distinct filter combos).
      const keys = await this.redis.keys(`${CACHE_KEY_PREFIX}*`)
      if (keys.length > 0) {
        await this.redis.del(...keys)
        this.logger.log(`Invalidated ${keys.length} mentor-list cache key(s)`)
      }
    } catch (err) {
      this.logger.warn('Redis DEL failed during mentor-list cache invalidation', err)
    }
  }

  private async fetchFromDb(filters: MentorListFilters) {
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

    return this.buildMentorDtoArray(rows)
  }

  private buildMentorDtoArray(
    rows: Awaited<ReturnType<typeof this.prisma.mentorProfile.findMany<{ include: { user: { include: { profile: true } } } }>>>,
  ) {
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

  /** Mentor-only: list all accepted aspirants this mentor has a conversation with. */
  async listMentees(mentorId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: { mentorId },
      orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        aspirant: { include: { profile: true } },
        sharedJournal: true,
      },
    })

    // Fetch last message + unread count per conversation separately (avoids take inside include)
    const results = await Promise.all(
      conversations.map(async (c) => {
        const lastMessages = await this.prisma.message.findMany({
          where: { conversationId: c.id, deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 1,
        })
        const unreadCount = await this.prisma.message.count({
          where: {
            conversationId: c.id,
            deletedAt: null,
            senderId: { not: mentorId },
            readAt: null,
          },
        })

        const last = lastMessages[0]
        const aspirant = c.aspirant

        return {
          conversationId: c.id,
          lastMessageAt: c.lastMessageAt?.toISOString() ?? c.createdAt.toISOString(),
          unreadCount,
          sharedJournalId: c.sharedJournal?.id ?? null,
          aspirant: {
            id: aspirant.id,
            displayHandle: aspirant.profile?.displayHandle ?? `User_${aspirant.id.slice(0, 4)}`,
            avatarLetter: aspirant.profile?.avatarLetter ?? 'B',
            avatarColor: aspirant.profile?.avatarColor ?? 'SLATE',
            hasPurpleTick: aspirant.profile?.hasPurpleTick ?? false,
          },
          lastMessage: last
            ? { id: last.id, body: last.body, senderId: last.senderId, createdAt: last.createdAt.toISOString() }
            : null,
        }
      }),
    )

    return results
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
