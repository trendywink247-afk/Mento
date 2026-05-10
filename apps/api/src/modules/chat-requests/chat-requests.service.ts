import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { ChatRequestStatus, MessageType, Role } from '@prisma/client'
import { PrismaService } from '../../database/prisma.service'

@Injectable()
export class ChatRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(menteeId: string, mentorId: string, intro: string) {
    if (menteeId === mentorId) {
      throw new BadRequestException("You can't request yourself")
    }

    const [mentee, mentor] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: menteeId } }),
      this.prisma.user.findUnique({ where: { id: mentorId } }),
    ])
    if (!mentee || mentee.role !== Role.ASPIRANT) {
      throw new ForbiddenException('Only aspirants can send chat requests')
    }
    if (!mentor || mentor.role !== Role.MENTOR) {
      throw new NotFoundException('Mentor not found')
    }

    // Daily abuse rate limit: max 30 new requests / day per mentee.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const recent = await this.prisma.chatRequest.count({
      where: { menteeId, createdAt: { gte: since } },
    })
    if (recent >= 30) {
      throw new BadRequestException('Daily chat-request limit reached. Try again tomorrow.')
    }

    // If conversation already exists, no need for a request.
    const existingConv = await this.prisma.conversation.findUnique({
      where: { mentorId_aspirantId: { mentorId, aspirantId: menteeId } },
    })
    if (existingConv) {
      throw new BadRequestException(
        'You already have a conversation with this mentor — open it from Chats.',
      )
    }

    // If a pending request already exists, return it idempotently.
    const existingPending = await this.prisma.chatRequest.findFirst({
      where: { menteeId, mentorId, status: ChatRequestStatus.PENDING },
    })
    if (existingPending) return existingPending

    return this.prisma.chatRequest.create({
      data: {
        menteeId,
        mentorId,
        intro: intro.slice(0, 160),
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 day TTL
      },
    })
  }

  async listForUser(userId: string, role: Role) {
    if (role === Role.MENTOR) {
      return this.prisma.chatRequest.findMany({
        where: { mentorId: userId },
        orderBy: { createdAt: 'desc' },
        include: { mentee: { include: { profile: true } } },
      })
    }
    return this.prisma.chatRequest.findMany({
      where: { menteeId: userId },
      orderBy: { createdAt: 'desc' },
      include: { mentor: { include: { profile: true } } },
    })
  }

  async accept(requestId: string, mentorId: string) {
    const req = await this.prisma.chatRequest.findUnique({ where: { id: requestId } })
    if (!req) throw new NotFoundException('Request not found')
    if (req.mentorId !== mentorId) throw new ForbiddenException('Not your request')
    if (req.status !== ChatRequestStatus.PENDING) {
      throw new BadRequestException(`Request already ${req.status.toLowerCase()}`)
    }

    return this.prisma.$transaction(async (tx) => {
      // Open or upsert the conversation between mentor and mentee.
      const conv = await tx.conversation.upsert({
        where: { mentorId_aspirantId: { mentorId, aspirantId: req.menteeId } },
        create: { mentorId, aspirantId: req.menteeId },
        update: {},
      })

      // Plant the intro as the first message from the mentee.
      await tx.message.create({
        data: {
          conversationId: conv.id,
          senderId: req.menteeId,
          type: MessageType.TEXT,
          body: req.intro,
        },
      })

      const updated = await tx.chatRequest.update({
        where: { id: requestId },
        data: {
          status: ChatRequestStatus.ACCEPTED,
          conversationId: conv.id,
          respondedAt: new Date(),
        },
      })

      // Bump conversation last-message-at
      await tx.conversation.update({
        where: { id: conv.id },
        data: { lastMessageAt: new Date() },
      })

      return updated
    })
  }

  async decline(requestId: string, mentorId: string) {
    const req = await this.prisma.chatRequest.findUnique({ where: { id: requestId } })
    if (!req) throw new NotFoundException('Request not found')
    if (req.mentorId !== mentorId) throw new ForbiddenException('Not your request')
    if (req.status !== ChatRequestStatus.PENDING) return req

    return this.prisma.chatRequest.update({
      where: { id: requestId },
      data: { status: ChatRequestStatus.DECLINED, respondedAt: new Date() },
    })
  }

  async archive(requestId: string, userId: string) {
    const req = await this.prisma.chatRequest.findUnique({ where: { id: requestId } })
    if (!req) throw new NotFoundException('Request not found')
    if (req.menteeId !== userId && req.mentorId !== userId) {
      throw new ForbiddenException('Not your request')
    }
    return this.prisma.chatRequest.update({
      where: { id: requestId },
      data: { status: ChatRequestStatus.ARCHIVED },
    })
  }
}
