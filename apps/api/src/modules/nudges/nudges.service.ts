import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../database/prisma.service'
import { NotificationsService } from '../notifications/notifications.service'
import { Role, UserStatus } from '@prisma/client'

const CAP = 500
const DEDUPE_DAYS = 7

// --- Mirror nudge copy (no personal info) ---
const MIRROR_TITLE = 'Finish setting up your Mento profile'
const MIRROR_BODY =
  'Take 3 minutes to complete the Mirror — your matched mentors will be more relevant.'

// --- Mentor onboarding nudge copy (no personal info) ---
const MENTOR_TITLE = 'Complete your mentor profile'
const MENTOR_BODY =
  'Aspirants are waiting — finish adding your year-by-year journey to start receiving requests.'

export type NudgeType = 'mirror' | 'mentor'

@Injectable()
export class NudgesService {
  private readonly logger = new Logger(NudgesService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  // -----------------------------------------------------------------------
  // Cron: aspirant mirror-completion nudge — every 6 hours
  // -----------------------------------------------------------------------
  @Cron('0 */6 * * *')
  async runMirrorNudgeCron(): Promise<void> {
    if (!this.isNudgesEnabled()) return
    const start = Date.now()
    this.logger.log('Mirror nudge cron starting')

    const { found, nudged, skipped } = await this.sendMirrorNudges()

    this.logger.log(
      `Mirror nudge cron done in ${Date.now() - start}ms — found=${found} nudged=${nudged} skipped=${skipped}`,
    )
  }

  // -----------------------------------------------------------------------
  // Cron: mentor profile-completion nudge — every 12 hours
  // -----------------------------------------------------------------------
  @Cron('0 */12 * * *')
  async runMentorNudgeCron(): Promise<void> {
    if (!this.isNudgesEnabled()) return
    const start = Date.now()
    this.logger.log('Mentor nudge cron starting')

    const { found, nudged, skipped } = await this.sendMentorNudges()

    this.logger.log(
      `Mentor nudge cron done in ${Date.now() - start}ms — found=${found} nudged=${nudged} skipped=${skipped}`,
    )
  }

  // -----------------------------------------------------------------------
  // Public method for admin manual trigger
  // -----------------------------------------------------------------------
  async triggerNudges(type: NudgeType): Promise<{ count: number }> {
    if (type === 'mirror') {
      const { nudged } = await this.sendMirrorNudges()
      return { count: nudged }
    } else {
      const { nudged } = await this.sendMentorNudges()
      return { count: nudged }
    }
  }

  // -----------------------------------------------------------------------
  // Core: mirror nudge
  // -----------------------------------------------------------------------
  async sendMirrorNudges(): Promise<{ found: number; nudged: number; skipped: number }> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000) // > 24h ago
    const dedupeCutoff = new Date(Date.now() - DEDUPE_DAYS * 24 * 60 * 60 * 1000)

    // Find aspirants: active, signed up > 24h ago, mirror not completed.
    const candidates = await this.prisma.user.findMany({
      where: {
        role: Role.ASPIRANT,
        status: UserStatus.ACTIVE,
        createdAt: { lt: cutoff },
        menteeProfile: {
          mirrorCompletedAt: null,
        },
      },
      select: {
        id: true,
        createdAt: true,
      },
      take: CAP,
    })

    const found = candidates.length
    let nudged = 0
    let skipped = 0

    for (const user of candidates) {
      // Check if already nudged within 7 days.
      const recentNudge = await this.prisma.onboardingEvent.findFirst({
        where: {
          userId: user.id,
          step: 'mirror_nudge_sent',
          createdAt: { gte: dedupeCutoff },
        },
        select: { id: true },
      })

      if (recentNudge) {
        skipped++
        continue
      }

      // Send push (non-fatal if push tokens are absent).
      await this.notifications.send({
        userId: user.id,
        title: MIRROR_TITLE,
        body: MIRROR_BODY,
        data: { screen: 'mirror' },
      })

      // Write audit row.
      await this.prisma.onboardingEvent.create({
        data: {
          userId: user.id,
          sessionId: `nudge-mirror-${user.id}`,
          step: 'mirror_nudge_sent',
          metadata: { sentAt: new Date().toISOString() },
        },
      })

      nudged++
    }

    return { found, nudged, skipped }
  }

  // -----------------------------------------------------------------------
  // Core: mentor onboarding nudge
  // -----------------------------------------------------------------------
  async sendMentorNudges(): Promise<{ found: number; nudged: number; skipped: number }> {
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000) // > 48h ago
    const dedupeCutoff = new Date(Date.now() - DEDUPE_DAYS * 24 * 60 * 60 * 1000)

    // Find mentors: active, profile created > 48h ago, attemptHistory null.
    const candidatesNullHistory = await this.prisma.user.findMany({
      where: {
        role: Role.MENTOR,
        status: UserStatus.ACTIVE,
        mentorProfile: {
          createdAt: { lt: cutoff },
        },
      },
      select: {
        id: true,
        mentorProfile: {
          select: {
            attemptHistory: true,
            createdAt: true,
          },
        },
      },
      take: CAP,
    })

    // Filter to those whose attemptHistory is null or an empty array.
    const merged = candidatesNullHistory
      .filter((u) => {
        const h = u.mentorProfile?.attemptHistory
        return h === null || (Array.isArray(h) && h.length === 0)
      })
      .slice(0, CAP)

    const found = merged.length
    let nudged = 0
    let skipped = 0

    for (const user of merged) {
      // Check 7-day dedupe.
      const recentNudge = await this.prisma.onboardingEvent.findFirst({
        where: {
          userId: user.id,
          step: 'mentor_nudge_sent',
          createdAt: { gte: dedupeCutoff },
        },
        select: { id: true },
      })

      if (recentNudge) {
        skipped++
        continue
      }

      await this.notifications.send({
        userId: user.id,
        title: MENTOR_TITLE,
        body: MENTOR_BODY,
        data: { screen: 'mentor-onboarding' },
      })

      await this.prisma.onboardingEvent.create({
        data: {
          userId: user.id,
          sessionId: `nudge-mentor-${user.id}`,
          step: 'mentor_nudge_sent',
          metadata: { sentAt: new Date().toISOString() },
        },
      })

      nudged++
    }

    return { found, nudged, skipped }
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------
  private isNudgesEnabled(): boolean {
    return this.config.get<string>('NUDGES_ENABLED', 'true') !== 'false'
  }
}
