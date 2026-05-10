import { Injectable, NotFoundException } from '@nestjs/common'
import { Role, UserStatus } from '@prisma/client'
import { PrismaService } from '../../database/prisma.service'

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

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
      displayName: u.profile?.displayName ?? null,
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
        await tx.aspirantProfile.upsert({
          where: { userId },
          create: { userId, targetExam: 'UPSC_CSE', targetYear: new Date().getFullYear() + 1 },
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

  async approveMentor(userId: string, actorId: string) {
    const mentor = await this.prisma.mentorProfile.findUnique({ where: { userId } })
    if (!mentor) {
      throw new NotFoundException('Mentor profile not found (set role to MENTOR first)')
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.mentorProfile.update({
        where: { userId },
        data: { isVerified: true, approvedAt: new Date(), approvedBy: actorId },
      })
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'mentor.approved',
          targetType: 'User',
          targetId: userId,
        },
      })
      return updated
    })
  }

  async listAuditLogs(limit = 100) {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
    })
  }
}
