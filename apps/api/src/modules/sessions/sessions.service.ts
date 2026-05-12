import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import {
  PaymentStatus,
  Role,
  SessionRequestStatus,
  WalletTxnType,
} from '@prisma/client'
import { PrismaService } from '../../database/prisma.service'

type AnonProfile = {
  id: string
  displayHandle: string
  avatarLetter: string
  avatarColor: string
  hasPurpleTick: boolean
}

function anonProfile(user: {
  id: string
  profile: { displayHandle: string; avatarLetter: string; avatarColor: string; hasPurpleTick: boolean } | null
}): AnonProfile {
  return {
    id: user.id,
    displayHandle: user.profile?.displayHandle ?? `User_${user.id.slice(0, 4)}`,
    avatarLetter: user.profile?.avatarLetter ?? 'B',
    avatarColor: user.profile?.avatarColor ?? 'SLATE',
    hasPurpleTick: user.profile?.hasPurpleTick ?? false,
  }
}

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Availability ──────────────────────────────────────────────────────

  async getMentorAvailability(mentorId: string) {
    const mentor = await this.prisma.mentorProfile.findUnique({
      where: { userId: mentorId },
      select: { availability: true, hourlyRateInr: true },
    })
    if (!mentor) throw new NotFoundException('Mentor not found')
    return {
      availability: mentor.availability ?? null,
      hourlyRateInr: mentor.hourlyRateInr,
    }
  }

  async setAvailability(mentorId: string, availability: Record<string, unknown>) {
    const updated = await this.prisma.mentorProfile.update({
      where: { userId: mentorId },
      data: { availability: availability as object },
      select: { availability: true, hourlyRateInr: true },
    })
    return updated
  }

  // ─── Session Requests ──────────────────────────────────────────────────

  async createRequest(
    menteeId: string,
    mentorId: string,
    scheduledAt: string,
    durationMin: number = 60,
    message?: string,
  ) {
    if (menteeId === mentorId) throw new BadRequestException("You can't request yourself")

    const [mentor, mentorProfile] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: mentorId, role: Role.MENTOR } }),
      this.prisma.mentorProfile.findUnique({ where: { userId: mentorId } }),
    ])
    if (!mentor) throw new NotFoundException('Mentor not found')
    if (!mentorProfile) throw new NotFoundException('Mentor profile not found')

    const scheduled = new Date(scheduledAt)
    if (isNaN(scheduled.getTime())) throw new BadRequestException('Invalid scheduledAt date')
    if (scheduled < new Date()) throw new BadRequestException('Scheduled time must be in the future')

    const hourlyRateInr = mentorProfile.hourlyRateInr
    const amountInr = Math.ceil((hourlyRateInr * durationMin) / 60)

    return this.prisma.$transaction(async (tx) => {
      const request = await tx.sessionRequest.create({
        data: {
          menteeId,
          mentorId,
          scheduledAt: scheduled,
          durationMin,
          hourlyRateInr,
          message: message?.slice(0, 200),
          status: SessionRequestStatus.PENDING,
          paymentStatus: PaymentStatus.SIMULATED,
          expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        },
      })

      await tx.walletTransaction.create({
        data: {
          userId: menteeId,
          type: WalletTxnType.HOLD,
          amountInr,
          sessionId: request.id,
          reference: `session-hold-${request.id}`,
          status: PaymentStatus.SIMULATED,
          metadata: { note: 'Simulated hold for MVP — no card charged', requestId: request.id },
        },
      })

      return { id: request.id, status: request.status, paymentStatus: request.paymentStatus, amountInr }
    })
  }

  async listRequests(userId: string, role: Role) {
    const isMentor = role === Role.MENTOR

    const rows = isMentor
      ? await this.prisma.sessionRequest.findMany({
          where: { mentorId: userId },
          orderBy: { createdAt: 'desc' },
          include: {
            mentee: { include: { profile: true } },
            session: true,
          },
        })
      : await this.prisma.sessionRequest.findMany({
          where: { menteeId: userId },
          orderBy: { createdAt: 'desc' },
          include: {
            mentor: { include: { profile: true } },
            session: true,
          },
        })

    return rows.map((r) => {
      const counterpartUser = isMentor
        ? (r as typeof r & { mentee: Parameters<typeof anonProfile>[0] }).mentee
        : (r as typeof r & { mentor: Parameters<typeof anonProfile>[0] }).mentor

      return {
        id: r.id,
        scheduledAt: r.scheduledAt.toISOString(),
        durationMin: r.durationMin,
        hourlyRateInr: r.hourlyRateInr,
        amountInr: Math.ceil((r.hourlyRateInr * r.durationMin) / 60),
        status: r.status,
        paymentStatus: r.paymentStatus,
        message: r.message,
        createdAt: r.createdAt.toISOString(),
        respondedAt: r.respondedAt?.toISOString() ?? null,
        expiresAt: r.expiresAt?.toISOString() ?? null,
        session: (r as typeof r & { session: { id: string } | null }).session
          ? { id: (r as typeof r & { session: { id: string } | null }).session!.id }
          : null,
        counterpart: anonProfile(counterpartUser),
      }
    })
  }

  async acceptRequest(requestId: string, mentorId: string) {
    const req = await this.prisma.sessionRequest.findUnique({ where: { id: requestId } })
    if (!req) throw new NotFoundException('Session request not found')
    if (req.mentorId !== mentorId) throw new ForbiddenException('Not your request')
    if (req.status !== SessionRequestStatus.PENDING) {
      throw new BadRequestException(`Request already ${req.status.toLowerCase()}`)
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.sessionRequest.update({
        where: { id: requestId },
        data: { status: SessionRequestStatus.ACCEPTED, respondedAt: new Date() },
      })

      await tx.session.create({
        data: {
          requestId,
        },
      })

      return { id: updated.id, status: updated.status }
    })
  }

  async declineRequest(requestId: string, userId: string, reason?: string) {
    const req = await this.prisma.sessionRequest.findUnique({ where: { id: requestId } })
    if (!req) throw new NotFoundException('Session request not found')
    if (req.mentorId !== userId) throw new ForbiddenException('Not your request')
    if (req.status !== SessionRequestStatus.PENDING) {
      throw new BadRequestException(`Request already ${req.status.toLowerCase()}`)
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.sessionRequest.update({
        where: { id: requestId },
        data: {
          status: SessionRequestStatus.DECLINED,
          respondedAt: new Date(),
          message: reason ? `[Declined] ${reason}` : req.message,
        },
      })

      // Simulated refund of the hold
      await tx.walletTransaction.create({
        data: {
          userId: req.menteeId,
          type: WalletTxnType.REFUND,
          amountInr: Math.ceil((req.hourlyRateInr * req.durationMin) / 60),
          sessionId: requestId,
          reference: `session-refund-${requestId}`,
          status: PaymentStatus.SIMULATED,
          metadata: { note: 'Simulated refund — session declined', requestId },
        },
      })

      return { id: updated.id, status: updated.status }
    })
  }

  async cancelRequest(requestId: string, menteeId: string) {
    const req = await this.prisma.sessionRequest.findUnique({ where: { id: requestId } })
    if (!req) throw new NotFoundException('Session request not found')
    if (req.menteeId !== menteeId) throw new ForbiddenException('Not your request')
    if (
      req.status === SessionRequestStatus.CANCELLED ||
      req.status === SessionRequestStatus.COMPLETED
    ) {
      throw new BadRequestException(`Request already ${req.status.toLowerCase()}`)
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.sessionRequest.update({
        where: { id: requestId },
        data: { status: SessionRequestStatus.CANCELLED, respondedAt: new Date() },
      })

      await tx.walletTransaction.create({
        data: {
          userId: menteeId,
          type: WalletTxnType.REFUND,
          amountInr: Math.ceil((req.hourlyRateInr * req.durationMin) / 60),
          sessionId: requestId,
          reference: `session-cancel-${requestId}`,
          status: PaymentStatus.SIMULATED,
          metadata: { note: 'Simulated refund — session cancelled by mentee', requestId },
        },
      })

      return { id: updated.id, status: updated.status }
    })
  }

  // ─── Wallet ────────────────────────────────────────────────────────────

  async listWallet(userId: string) {
    const txns = await this.prisma.walletTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    return txns.map((t) => ({
      id: t.id,
      type: t.type,
      amountInr: t.amountInr,
      status: t.status,
      reference: t.reference,
      sessionId: t.sessionId,
      metadata: t.metadata,
      createdAt: t.createdAt.toISOString(),
    }))
  }
}
