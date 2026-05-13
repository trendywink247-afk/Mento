import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { ModerationAction, ReportStatus, Role, UserStatus } from '@prisma/client'
import { PrismaService } from '../../database/prisma.service'
import { MetricsService } from '../metrics/metrics.service'
import { ResolveAction } from './dto/resolve-report.dto'

@Injectable()
export class ModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metricsService: MetricsService,
  ) {}

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private anonymizeUser(user: {
    id: string
    profile: { displayHandle: string; avatarLetter: string; avatarColor: string } | null
  }) {
    return {
      id: user.id,
      displayHandle: user.profile?.displayHandle ?? `User_${user.id.slice(0, 4)}`,
      avatarLetter: user.profile?.avatarLetter ?? 'B',
      avatarColor: user.profile?.avatarColor ?? 'SLATE',
    }
  }

  // ─── Reports list ─────────────────────────────────────────────────────────

  async listReports(params: {
    status?: 'PENDING' | 'REVIEWED_NO_ACTION' | 'REVIEWED_BANNED'
    limit?: number
    cursor?: string
  }) {
    const limit = Math.min(params.limit ?? 50, 100)

    const rows = await this.prisma.messageReport.findMany({
      where: {
        ...(params.status ? { status: params.status as ReportStatus } : {}),
        ...(params.cursor ? { id: { lt: params.cursor } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        reporter: { include: { profile: true } },
        message: {
          include: {
            sender: { include: { profile: true } },
            conversation: { select: { id: true } },
          },
        },
      },
    })

    const nextCursor = rows.length === limit ? rows[rows.length - 1]?.id : null

    return {
      items: rows.map((r) => ({
        id: r.id,
        createdAt: r.createdAt.toISOString(),
        status: r.status,
        reason: r.reason,
        reporter: this.anonymizeUser(r.reporter),
        target: this.anonymizeUser(r.message.sender),
        messageSnippet: (r.message.body ?? '').slice(0, 200),
        conversationId: r.message.conversation.id,
      })),
      nextCursor,
    }
  }

  // ─── Report detail ────────────────────────────────────────────────────────

  async getReport(reportId: string) {
    const report = await this.prisma.messageReport.findUnique({
      where: { id: reportId },
      include: {
        reporter: { include: { profile: true } },
        message: {
          include: {
            sender: { include: { profile: true } },
            conversation: { select: { id: true } },
          },
        },
      },
    })
    if (!report) throw new NotFoundException('Report not found')

    // 5 most-recent messages from the same author in the same conversation.
    const contextMessages = await this.prisma.message.findMany({
      where: {
        conversationId: report.message.conversationId,
        senderId: report.message.senderId,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, body: true, type: true, createdAt: true },
    })

    return {
      id: report.id,
      createdAt: report.createdAt.toISOString(),
      status: report.status,
      reason: report.reason,
      outcome: report.outcome,
      reviewedAt: report.reviewedAt?.toISOString() ?? null,
      reporter: this.anonymizeUser(report.reporter),
      target: this.anonymizeUser(report.message.sender),
      targetUserId: report.message.senderId,
      message: {
        id: report.message.id,
        body: report.message.body,
        type: report.message.type,
        createdAt: report.message.createdAt.toISOString(),
      },
      conversationId: report.message.conversation.id,
      contextMessages: contextMessages.map((m) => ({
        id: m.id,
        body: m.body,
        type: m.type,
        createdAt: m.createdAt.toISOString(),
      })),
    }
  }

  // ─── Resolve report ───────────────────────────────────────────────────────

  async resolveReport(
    reportId: string,
    adminId: string,
    action: ResolveAction,
    notes?: string,
  ) {
    const report = await this.prisma.messageReport.findUnique({
      where: { id: reportId },
      include: {
        message: { include: { sender: { include: { verification: true } } } },
      },
    })
    if (!report) throw new NotFoundException('Report not found')

    const targetUser = report.message.sender
    const targetUserId = targetUser.id

    await this.prisma.$transaction(async (tx) => {
      // Always mark the report as reviewed.
      await tx.messageReport.update({
        where: { id: reportId },
        data: {
          status: action === ResolveAction.DISMISS
            ? ReportStatus.REVIEWED_NO_ACTION
            : ReportStatus.REVIEWED_BANNED,
          reviewedAt: new Date(),
          reviewedBy: adminId,
          outcome: `${action}${notes ? `: ${notes}` : ''}`,
        },
      })

      // Write a ModerationActionLog for every resolution — including DISMISS — so
      // the audit trail is complete and dismissals are reviewable later.
      const moderationActionMap: Record<ResolveAction, ModerationAction> = {
        [ResolveAction.DISMISS]: ModerationAction.DISMISS,
        [ResolveAction.WARN]: ModerationAction.WARN,
        [ResolveAction.SUSPEND]: targetUser.role === Role.MENTOR
          ? ModerationAction.SUSPEND_MENTOR
          : ModerationAction.SUSPEND_ASPIRANT,
        [ResolveAction.BAN]: targetUser.role === Role.MENTOR
          ? ModerationAction.BAN_MENTOR
          : ModerationAction.BAN_ASPIRANT,
      }

      await tx.moderationActionLog.create({
        data: {
          targetUserId,
          reason: notes ?? `Report ${reportId} resolved with action ${action}`,
          evidenceMessageIds: [report.messageId],
          action: moderationActionMap[action],
          bannedByAdmin: adminId,
        },
      })

      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action: `moderation.${action.toLowerCase()}`,
          targetType: 'User',
          targetId: targetUserId,
          metadata: { reportId, notes: notes ?? null },
        },
      })

      if (action === ResolveAction.DISMISS || action === ResolveAction.WARN) {
        // DISMISS and WARN do not change user status — audit-log only.
        return
      }

      // SUSPEND or BAN: flip user status, revoke tokens, delete push tokens.
      const newStatus =
        action === ResolveAction.BAN ? UserStatus.BANNED : UserStatus.SUSPENDED

      await tx.user.update({
        where: { id: targetUserId },
        data: {
          status: newStatus,
          ...(action === ResolveAction.BAN ? { bannedAt: new Date() } : {}),
        },
      })

      // Revoke all active refresh tokens.
      await tx.refreshToken.updateMany({
        where: { userId: targetUserId, revokedAt: null },
        data: { revokedAt: new Date() },
      })

      // Remove push tokens so they cannot receive notifications.
      await tx.pushToken.deleteMany({ where: { userId: targetUserId } })

      // BAN: also add to MentorDenylist if the target is/was a mentor with Aadhaar on file.
      if (action === ResolveAction.BAN) {
        const verification = targetUser.verification
        if (verification?.aadhaarHash) {
          await tx.mentorDenylist.upsert({
            where: { aadhaarHash: verification.aadhaarHash },
            create: {
              aadhaarHash: verification.aadhaarHash,
              reason: notes ?? `Banned via report ${reportId}`,
              bannedBy: adminId,
            },
            update: {
              reason: notes ?? `Banned via report ${reportId}`,
              bannedBy: adminId,
              bannedAt: new Date(),
            },
          })
        }
      }
    })

    this.metricsService.moderationActionTotal.inc({ action: action.toLowerCase() })
    return { ok: true, action }
  }

  // ─── Admin user detail ────────────────────────────────────────────────────

  async getUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        mentorProfile: true,
        verification: true,
      },
    })
    if (!user) throw new NotFoundException('User not found')

    const actionHistory = await this.prisma.moderationActionLog.findMany({
      where: { targetUserId: userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    return {
      id: user.id,
      phone: user.phone,
      email: user.email,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt.toISOString(),
      bannedAt: user.bannedAt?.toISOString() ?? null,
      profile: user.profile
        ? {
            displayHandle: user.profile.displayHandle,
            avatarLetter: user.profile.avatarLetter,
            avatarColor: user.profile.avatarColor,
            hasPurpleTick: user.profile.hasPurpleTick,
          }
        : null,
      mentorProfile: user.mentorProfile
        ? {
            isVerified: user.mentorProfile.isVerified,
            journeyType: user.mentorProfile.journeyType,
          }
        : null,
      verification: user.verification
        ? {
            submittedAt: user.verification.submittedAt.toISOString(),
            reviewedAt: user.verification.reviewedAt?.toISOString() ?? null,
            // Show only last 4 of Aadhaar hash (hash suffix), never plaintext.
            aadhaarHashSuffix: user.verification.aadhaarHash
              ? user.verification.aadhaarHash.slice(-4)
              : null,
            hasAadhaar: !!user.verification.aadhaarUrl,
          }
        : null,
      actionHistory: actionHistory.map((a) => ({
        id: a.id,
        action: a.action,
        reason: a.reason,
        createdAt: a.createdAt.toISOString(),
      })),
    }
  }

  // ─── Direct status change ─────────────────────────────────────────────────

  async setUserStatus(
    userId: string,
    adminId: string,
    status: UserStatus,
    reason?: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { verification: true },
    })
    if (!user) throw new NotFoundException('User not found')

    // Prevent admin self-modification.
    if (userId === adminId) throw new ForbiddenException('Cannot modify own status')

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          status,
          ...(status === UserStatus.BANNED ? { bannedAt: new Date() } : {}),
        },
      })

      if (status === UserStatus.SUSPENDED || status === UserStatus.BANNED) {
        await tx.refreshToken.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: new Date() },
        })
        await tx.pushToken.deleteMany({ where: { userId } })
      }

      if (status === UserStatus.BANNED && user.verification?.aadhaarHash) {
        await tx.mentorDenylist.upsert({
          where: { aadhaarHash: user.verification.aadhaarHash },
          create: {
            aadhaarHash: user.verification.aadhaarHash,
            reason: reason ?? 'Banned by admin',
            bannedBy: adminId,
          },
          update: {
            reason: reason ?? 'Banned by admin',
            bannedBy: adminId,
            bannedAt: new Date(),
          },
        })
      }

      const moderationAction =
        status === UserStatus.BANNED
          ? user.role === Role.MENTOR
            ? ModerationAction.BAN_MENTOR
            : ModerationAction.BAN_ASPIRANT
          : user.role === Role.MENTOR
          ? ModerationAction.SUSPEND_MENTOR
          : ModerationAction.SUSPEND_ASPIRANT

      if (status === UserStatus.SUSPENDED || status === UserStatus.BANNED) {
        await tx.moderationActionLog.create({
          data: {
            targetUserId: userId,
            reason: reason ?? `Status set to ${status} by admin`,
            evidenceMessageIds: [],
            action: moderationAction,
            bannedByAdmin: adminId,
          },
        })
      }

      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action: 'user.status.changed',
          targetType: 'User',
          targetId: userId,
          metadata: { from: user.status, to: status, reason: reason ?? null },
        },
      })
    })

    if (status === UserStatus.SUSPENDED || status === UserStatus.BANNED) {
      this.metricsService.moderationActionTotal.inc({ action: status === UserStatus.BANNED ? 'ban' : 'suspend' })
    }
    return { ok: true, status }
  }
}
