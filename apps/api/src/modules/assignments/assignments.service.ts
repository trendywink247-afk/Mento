import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Role } from '@prisma/client'
import { PrismaService } from '../../database/prisma.service'

@Injectable()
export class AssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(mentorId: string, aspirantId: string) {
    if (mentorId === aspirantId) {
      throw new BadRequestException('Mentor and aspirant must be different users')
    }
    const [mentor, aspirant] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: mentorId } }),
      this.prisma.user.findUnique({ where: { id: aspirantId } }),
    ])
    if (!mentor || mentor.role !== Role.MENTOR) {
      throw new BadRequestException('mentorId is not a MENTOR')
    }
    if (!aspirant || aspirant.role !== Role.ASPIRANT) {
      throw new BadRequestException('aspirantId is not an ASPIRANT')
    }

    return this.prisma.$transaction(async (tx) => {
      const assignment = await tx.mentorAspirantAssignment.upsert({
        where: { mentorId_aspirantId: { mentorId, aspirantId } },
        create: { mentorId, aspirantId },
        update: { status: 'ACTIVE', endedAt: null },
      })
      const conversation = await tx.conversation.upsert({
        where: { mentorId_aspirantId: { mentorId, aspirantId } },
        create: { mentorId, aspirantId },
        update: {},
      })
      return { assignment, conversation }
    })
  }

  async listByUser(userId: string) {
    const rows = await this.prisma.mentorAspirantAssignment.findMany({
      where: {
        OR: [{ mentorId: userId }, { aspirantId: userId }],
        status: 'ACTIVE',
      },
      include: {
        mentor: { include: { profile: true } },
        aspirant: { include: { profile: true } },
      },
    })
    return rows
  }

  async list() {
    const rows = await this.prisma.mentorAspirantAssignment.findMany({
      orderBy: { assignedAt: 'desc' },
      include: {
        mentor: { include: { profile: true } },
        aspirant: { include: { profile: true } },
      },
    })
    return rows
  }

  async end(id: string) {
    const a = await this.prisma.mentorAspirantAssignment.findUnique({ where: { id } })
    if (!a) throw new NotFoundException('Assignment not found')
    return this.prisma.mentorAspirantAssignment.update({
      where: { id },
      data: { status: 'ENDED', endedAt: new Date() },
    })
  }
}
