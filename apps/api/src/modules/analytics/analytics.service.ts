import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Redis } from 'ioredis'
import { PrismaService } from '../../database/prisma.service'

const CACHE_KEY = 'admin:analytics:summary'
const CACHE_TTL_SECS = 60

// MRR tier prices (INR / month)
const TIER_PRICES: Record<string, number> = {
  BASIC: 399,
  PRO: 599,
  MAX: 999,
}

@Injectable()
export class AnalyticsService implements OnModuleDestroy {
  private readonly logger = new Logger(AnalyticsService.name)
  private readonly redis: Redis

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.redis = new Redis(this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6379/0')
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit().catch(() => undefined)
  }

  async getSummary() {
    // Cache hit
    try {
      const cached = await this.redis.get(CACHE_KEY)
      if (cached) {
        return JSON.parse(cached)
      }
    } catch (err) {
      this.logger.warn('Redis get failed for analytics cache', err)
    }

    const result = await this.computeSummary()

    // Cache set — fire-and-forget, non-blocking
    try {
      await this.redis.set(CACHE_KEY, JSON.stringify(result), 'EX', CACHE_TTL_SECS)
    } catch (err) {
      this.logger.warn('Redis set failed for analytics cache', err)
    }

    return result
  }

  private async computeSummary() {
    const now = new Date()
    const minus7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const minus30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    // ── Users ────────────────────────────────────────────────────────────
    // Single groupBy on (role, status) — one round-trip, all we need.
    // Index: @@index([role, status]) on User covers both dimensions.
    const userGroupBy = await this.prisma.user.groupBy({
      by: ['role', 'status'],
      where: { deletedAt: null },
      _count: { id: true },
    })

    const totalUsers = userGroupBy.reduce((s, r) => s + r._count.id, 0)

    const byRole: Record<string, number> = {
      ASPIRANT: 0,
      MENTOR: 0,
      COORDINATOR: 0,
      ADMIN: 0,
    }
    const byStatus: Record<string, number> = {
      ACTIVE: 0,
      SUSPENDED: 0,
      BANNED: 0,
      PENDING_VERIFICATION: 0,
    }
    for (const row of userGroupBy) {
      byRole[row.role] = (byRole[row.role] ?? 0) + row._count.id
      byStatus[row.status] = (byStatus[row.status] ?? 0) + row._count.id
    }

    // ── Signups daily counts ─────────────────────────────────────────────
    // We pull raw rows grouped by day using Prisma's raw query for efficiency.
    // Index: createdAt is implicitly indexed via @default(now()) on User.
    // At 10M MAU scale a partial index on createdAt range would help — noted below.
    const signupsLast7dRaw = await this.prisma.$queryRaw<Array<{ day: string; count: bigint }>>`
      SELECT
        TO_CHAR(DATE_TRUNC('day', "createdAt"), 'YYYY-MM-DD') AS day,
        COUNT(*) AS count
      FROM "User"
      WHERE "createdAt" >= ${minus7d} AND "deletedAt" IS NULL
      GROUP BY 1
      ORDER BY 1
    `

    const signupsLast30dRaw = await this.prisma.$queryRaw<Array<{ day: string; count: bigint }>>`
      SELECT
        TO_CHAR(DATE_TRUNC('day', "createdAt"), 'YYYY-MM-DD') AS day,
        COUNT(*) AS count
      FROM "User"
      WHERE "createdAt" >= ${minus30d} AND "deletedAt" IS NULL
      GROUP BY 1
      ORDER BY 1
    `

    // Fill in zero-count days so the chart always has a complete series.
    const signups7d = fillDailySeries(signupsLast7dRaw, minus7d, now)
    const signups30d = fillDailySeries(signupsLast30dRaw, minus30d, now)

    // ── Onboarding funnel ────────────────────────────────────────────────
    // mirrorCompletedAt on MenteeProfile signals Mirror completion.
    // mentorProfile.approvedAt signals mentor acceptance.
    // Index: MenteeProfile has no dedicated createdAt index — sequential scan on
    // small table is fine at MVP scale. At 10M scale add @@index([mirrorCompletedAt]).
    const [totalAspirants, mirrorCompleted, mentorApps, mentorsApproved] = await Promise.all([
      this.prisma.menteeProfile.count(),
      this.prisma.menteeProfile.count({ where: { mirrorCompletedAt: { not: null } } }),
      this.prisma.mentorProfile.count(),
      this.prisma.mentorProfile.count({ where: { isVerified: true } }),
    ])

    // ── Chat ─────────────────────────────────────────────────────────────
    // Index: @@index([mentorId, status]) on ChatRequest
    const [pendingRequests, acceptedRequests] = await Promise.all([
      this.prisma.chatRequest.count({ where: { status: 'PENDING' } }),
      this.prisma.chatRequest.count({ where: { status: 'ACCEPTED' } }),
    ])

    const last7dMessagesRaw = await this.prisma.$queryRaw<Array<{ day: string; count: bigint }>>`
      SELECT
        TO_CHAR(DATE_TRUNC('day', "createdAt"), 'YYYY-MM-DD') AS day,
        COUNT(*) AS count
      FROM "Message"
      WHERE "createdAt" >= ${minus7d} AND "deletedAt" IS NULL
      GROUP BY 1
      ORDER BY 1
    `
    const last7dMessages = fillDailySeries(last7dMessagesRaw, minus7d, now)

    // ── Subscriptions ────────────────────────────────────────────────────
    // Count ACTIVE subscriptions by tier.
    // Index: @@index([userId, status]) on Subscription
    const subGroupBy = await this.prisma.subscription.groupBy({
      by: ['tier'],
      where: { status: 'ACTIVE' },
      _count: { id: true },
    })

    const subCounts: Record<string, number> = { FREE: 0, BASIC: 0, PRO: 0, MAX: 0 }
    for (const row of subGroupBy) {
      subCounts[row.tier] = row._count.id
    }

    const mrrInr =
      (subCounts['BASIC'] ?? 0) * TIER_PRICES['BASIC'] +
      (subCounts['PRO'] ?? 0) * TIER_PRICES['PRO'] +
      (subCounts['MAX'] ?? 0) * TIER_PRICES['MAX']

    // ── Moderation ───────────────────────────────────────────────────────
    // Index: @@index([status, createdAt]) on MessageReport
    // Index: @@index([targetUserId, createdAt]) on ModerationActionLog
    const [openReports, last30dActionsRaw] = await Promise.all([
      this.prisma.messageReport.count({ where: { status: 'PENDING' } }),
      this.prisma.moderationActionLog.groupBy({
        by: ['action'],
        where: { createdAt: { gte: minus30d } },
        _count: { id: true },
      }),
    ])

    const last30dActions: Record<string, number> = {
      WARN: 0,
      DISMISS: 0,
      SUSPEND: 0,
      BAN: 0,
    }
    for (const row of last30dActionsRaw) {
      // Map moderation enum values to simplified display keys
      if (row.action.startsWith('BAN')) last30dActions['BAN'] += row._count.id
      else if (row.action.startsWith('SUSPEND')) last30dActions['SUSPEND'] += row._count.id
      else if (row.action === 'WARN') last30dActions['WARN'] += row._count.id
      else if (row.action === 'DISMISS') last30dActions['DISMISS'] += row._count.id
    }

    // ── Verification ─────────────────────────────────────────────────────
    // Index: @@index([reviewedAt]) on VerificationDocument
    const [pendingDocs, approvedLast7d, rejectedLast7d] = await Promise.all([
      // Docs submitted but not yet reviewed
      this.prisma.verificationDocument.count({
        where: { reviewedAt: null },
      }),
      // Approved in last 7 days: mentorProfile.approvedAt in range
      this.prisma.mentorProfile.count({
        where: { approvedAt: { gte: minus7d }, isVerified: true },
      }),
      // Rejected: verificationDocument reviewed, but mentorProfile not verified
      // We detect rejection by reviewedAt set + isVerified still false
      this.prisma.verificationDocument.count({
        where: {
          reviewedAt: { gte: minus7d },
          user: { mentorProfile: { isVerified: false } },
        },
      }),
    ])

    return {
      users: {
        total: totalUsers,
        byRole: {
          ASPIRANT: byRole['ASPIRANT'] ?? 0,
          MENTOR: byRole['MENTOR'] ?? 0,
          COORDINATOR: byRole['COORDINATOR'] ?? 0,
          ADMIN: byRole['ADMIN'] ?? 0,
        },
        byStatus: {
          ACTIVE: byStatus['ACTIVE'] ?? 0,
          SUSPENDED: byStatus['SUSPENDED'] ?? 0,
          BANNED: byStatus['BANNED'] ?? 0,
          PENDING_VERIFICATION: byStatus['PENDING_VERIFICATION'] ?? 0,
        },
      },
      signups: {
        last7d: signups7d,
        last30d: signups30d,
      },
      onboarding: {
        mirrorCompletionRate: safeRate(mirrorCompleted, totalAspirants),
        mentorApplicationRate: safeRate(mentorApps, totalUsers),
        mentorApprovalRate: safeRate(mentorsApproved, mentorApps),
      },
      chats: {
        pendingRequests,
        acceptedRequests,
        last7dMessages,
      },
      subscriptions: {
        free: subCounts['FREE'] ?? 0,
        basic: subCounts['BASIC'] ?? 0,
        pro: subCounts['PRO'] ?? 0,
        max: subCounts['MAX'] ?? 0,
        mrrInr,
      },
      moderation: {
        openReports,
        last30dActions,
      },
      verification: {
        pendingDocs,
        approvedLast7d,
        rejectedLast7d,
      },
      generatedAt: now.toISOString(),
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Given a sparse result set from a daily GROUP BY query, fill in missing days
 * with zero counts. Returns an array of numbers ordered oldest → newest.
 */
function fillDailySeries(
  rows: Array<{ day: string; count: bigint }>,
  from: Date,
  to: Date,
): number[] {
  const map = new Map<string, number>()
  for (const row of rows) {
    map.set(row.day, Number(row.count))
  }

  const result: number[] = []
  const cursor = new Date(from)
  // Normalize to midnight UTC
  cursor.setUTCHours(0, 0, 0, 0)
  const end = new Date(to)
  end.setUTCHours(0, 0, 0, 0)

  while (cursor <= end) {
    const key = cursor.toISOString().slice(0, 10)
    result.push(map.get(key) ?? 0)
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return result
}

/** Return a percentage (0–100) clamped to [0, 100], or 0 if denominator is 0. */
function safeRate(numerator: number, denominator: number): number {
  if (denominator === 0) return 0
  return Math.round((numerator / denominator) * 100 * 10) / 10
}
