import { Injectable, NotFoundException } from '@nestjs/common'
import { ModerationAction, Role, UserStatus } from '@prisma/client'
import { PrismaService } from '../../database/prisma.service'
import { StorageService } from '../storage/storage.service'
import { MentorsService } from '../mentors/mentors.service'

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly mentors: MentorsService,
  ) {}

  async listUsers(role?: Role, status?: UserStatus) {
    const rows = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        ...(role ? { role } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { profile: true, mentorProfile: true },
      take: 200,
    })
    return rows.map((u) => ({
      id: u.id,
      phone: u.phone,
      email: u.email,
      role: u.role,
      status: u.status,
      createdAt: u.createdAt.toISOString(),
      displayHandle: u.profile?.displayHandle ?? null,
      avatarLetter: u.profile?.avatarLetter ?? null,
      avatarColor: u.profile?.avatarColor ?? null,
      hasPurpleTick: u.profile?.hasPurpleTick ?? false,
      mentorVerified: u.mentorProfile?.isVerified ?? false,
    }))
  }

  async setUserRole(userId: string, role: Role, actorId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new NotFoundException('User not found')

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({ where: { id: userId }, data: { role } })

      // Ensure role-specific profile rows exist.
      if (role === Role.MENTOR) {
        await tx.mentorProfile.upsert({
          where: { userId },
          create: { userId },
          update: {},
        })
      }
      if (role === Role.ASPIRANT) {
        await tx.menteeProfile.upsert({
          where: { userId },
          create: { userId },
          update: {},
        })
      }

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'user.role.changed',
          targetType: 'User',
          targetId: userId,
          metadata: { from: user.role, to: role },
        },
      })
      return updated
    })
  }

  async listPendingMentors() {
    const rows = await this.prisma.user.findMany({
      where: {
        role: Role.MENTOR,
        deletedAt: null,
        mentorProfile: { isVerified: false },
        verification: { submittedAt: { not: undefined } },
      },
      orderBy: { createdAt: 'asc' },
      include: {
        profile: true,
        mentorProfile: true,
        verification: true,
      },
    })

    // Generate signed read URLs for each document (admin-only, 5-min TTL).
    const result = await Promise.all(
      rows.map(async (u) => {
        const v = u.verification
        const [aadhaarSignedUrl, hallTicketSignedUrl, marksSheetSignedUrl] =
          await Promise.all([
            v?.aadhaarUrl ? this.storage.presignRead(v.aadhaarUrl) : Promise.resolve(null),
            v?.hallTicketUrl ? this.storage.presignRead(v.hallTicketUrl) : Promise.resolve(null),
            v?.marksSheetUrl ? this.storage.presignRead(v.marksSheetUrl) : Promise.resolve(null),
          ])

        return {
          id: u.id,
          displayHandle: u.profile?.displayHandle ?? null,
          avatarLetter: u.profile?.avatarLetter ?? null,
          avatarColor: u.profile?.avatarColor ?? null,
          hasPurpleTick: u.profile?.hasPurpleTick ?? false,
          status: u.status,
          createdAt: u.createdAt.toISOString(),
          mentorProfile: u.mentorProfile
            ? {
                journeyType: u.mentorProfile.journeyType,
                prelimsCleared: u.mentorProfile.prelimsCleared,
                mainsAttempts: u.mentorProfile.mainsAttempts,
                interviewAttempts: u.mentorProfile.interviewAttempts,
                isVerified: u.mentorProfile.isVerified,
              }
            : null,
          verification: v
            ? {
                submittedAt: v.submittedAt.toISOString(),
                reviewedAt: v.reviewedAt?.toISOString() ?? null,
                reviewNote: v.reviewNote ?? null,
                // Signed read URLs (5 min TTL). Raw storage keys are NOT exposed.
                aadhaarSignedUrl,
                hallTicketSignedUrl,
                marksSheetSignedUrl,
                hasBankAccount: !!v.bankAccount,
                hasMarksSheet: !!v.marksSheetUrl,
              }
            : null,
        }
      }),
    )

    return result
  }

  async approveMentor(userId: string, actorId: string, reviewNote?: string) {
    const mentor = await this.prisma.mentorProfile.findUnique({ where: { userId } })
    if (!mentor) {
      throw new NotFoundException('Mentor profile not found (set role to MENTOR first)')
    }

    const verification = await this.prisma.verificationDocument.findUnique({
      where: { userId },
    })

    const result = await this.prisma.$transaction(async (tx) => {
      // If marks_sheet was uploaded, grant purple tick.
      const grantPurpleTick = !!verification?.marksSheetUrl

      await tx.mentorProfile.update({
        where: { userId },
        data: { isVerified: true, approvedAt: new Date(), approvedBy: actorId },
      })

      await tx.profile.update({
        where: { userId },
        data: { hasPurpleTick: grantPurpleTick },
      })

      await tx.user.update({
        where: { id: userId },
        data: { status: UserStatus.ACTIVE },
      })

      if (verification) {
        await tx.verificationDocument.update({
          where: { userId },
          data: {
            reviewedAt: new Date(),
            reviewedBy: actorId,
            reviewNote: reviewNote ?? null,
          },
        })
      }

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'mentor.approved',
          targetType: 'User',
          targetId: userId,
          metadata: { grantedPurpleTick: grantPurpleTick, reviewNote: reviewNote ?? null },
        },
      })

      return { approved: true, hasPurpleTick: grantPurpleTick }
    })

    // Bust mentor-list cache after transaction commits so the newly approved
    // mentor appears on the next request rather than waiting up to 30 s.
    void this.mentors.invalidateMentorListCache()
    return result
  }

  /**
   * Reject a mentor's verification submission.
   * Sets user status to SUSPENDED so they cannot operate, but does NOT ban
   * the Aadhaar. The mentor can re-submit with corrected documents.
   */
  async rejectMentor(userId: string, actorId: string, reason: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { verification: true },
    })
    if (!user) throw new NotFoundException('User not found')

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { status: UserStatus.SUSPENDED },
      })

      if (user.verification) {
        await tx.verificationDocument.update({
          where: { userId },
          data: {
            reviewedAt: new Date(),
            reviewedBy: actorId,
            reviewNote: reason,
          },
        })
      }

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'mentor.rejected',
          targetType: 'User',
          targetId: userId,
          metadata: { reason },
        },
      })

      return { rejected: true }
    })

    void this.mentors.invalidateMentorListCache()
    return result
  }

  /**
   * Ban a mentor permanently.
   * Adds the Aadhaar hash to MentorDenylist so future sign-ups with the same
   * (userId, last-4) pair are blocked at verification submission.
   * Sets User.status = BANNED and writes a ModerationActionLog entry.
   */
  async banMentor(userId: string, actorId: string, reason: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { verification: true },
    })
    if (!user) throw new NotFoundException('User not found')

    const result = await this.prisma.$transaction(async (tx) => {
      // Add to denylist if we have an Aadhaar hash.
      if (user.verification?.aadhaarHash) {
        await tx.mentorDenylist.upsert({
          where: { aadhaarHash: user.verification.aadhaarHash },
          create: {
            aadhaarHash: user.verification.aadhaarHash,
            reason,
            bannedBy: actorId,
          },
          update: {
            reason,
            bannedBy: actorId,
            bannedAt: new Date(),
          },
        })
      }

      await tx.user.update({
        where: { id: userId },
        data: { status: UserStatus.BANNED, bannedAt: new Date() },
      })

      // Update verification review fields.
      if (user.verification) {
        await tx.verificationDocument.update({
          where: { userId },
          data: {
            reviewedAt: new Date(),
            reviewedBy: actorId,
            reviewNote: `BANNED: ${reason}`,
          },
        })
      }

      await tx.moderationActionLog.create({
        data: {
          targetUserId: userId,
          reason,
          action: ModerationAction.BAN_MENTOR,
          bannedByAdmin: actorId,
          evidenceMessageIds: [],
        },
      })

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'mentor.banned',
          targetType: 'User',
          targetId: userId,
          metadata: { reason, aadhaarHashed: !!user.verification?.aadhaarHash },
        },
      })

      return { banned: true }
    })

    void this.mentors.invalidateMentorListCache()
    return result
  }

  async listAuditLogs(limit = 100) {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
    })
  }
}
