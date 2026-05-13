import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { Message, MessageType } from '@prisma/client'
import { PrismaService } from '../../database/prisma.service'

interface SendMessageInput {
  senderId: string
  conversationId: string
  type: MessageType
  body?: string | null
  attachmentUrl?: string | null
  clientMessageId: string
}

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  async listConversations(userId: string) {
    const rows = await this.prisma.conversation.findMany({
      where: { OR: [{ mentorId: userId }, { aspirantId: userId }] },
      orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        mentor: { include: { profile: true } },
        aspirant: { include: { profile: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    })
    return rows.map((c) => {
      const counterpart = c.mentorId === userId ? c.aspirant : c.mentor
      const last = c.messages[0]
      return {
        id: c.id,
        mentorId: c.mentorId,
        aspirantId: c.aspirantId,
        lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
        createdAt: c.createdAt.toISOString(),
        counterpart: {
          id: counterpart.id,
          displayHandle: counterpart.profile?.displayHandle ?? `User_${counterpart.id.slice(0, 4)}`,
          avatarLetter: counterpart.profile?.avatarLetter ?? 'B',
          avatarColor: counterpart.profile?.avatarColor ?? 'SLATE',
          hasPurpleTick: counterpart.profile?.hasPurpleTick ?? false,
        },
        archivedByMentee: c.archivedByMentee,
        archivedByMentor: c.archivedByMentor,
        lastMessage: last
          ? {
              id: last.id,
              type: last.type,
              body: last.body,
              createdAt: last.createdAt.toISOString(),
              senderId: last.senderId,
            }
          : null,
      }
    })
  }

  async assertConversationParticipant(conversationId: string, userId: string) {
    const conv = await this.prisma.conversation.findUnique({ where: { id: conversationId } })
    if (!conv) throw new NotFoundException('Conversation not found')
    if (conv.mentorId !== userId && conv.aspirantId !== userId) {
      throw new ForbiddenException('Not a participant')
    }
    return conv
  }

  async getMessages(
    conversationId: string,
    userId: string,
    opts: { limit?: number; before?: string },
  ) {
    await this.assertConversationParticipant(conversationId, userId)
    const limit = Math.min(opts.limit ?? 50, 100)
    const where = {
      conversationId,
      deletedAt: null,
      ...(opts.before ? { createdAt: { lt: new Date(opts.before) } } : {}),
    }
    const rows = await this.prisma.message.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    return rows.reverse().map(this.serialize)
  }

  async sendMessage(input: SendMessageInput): Promise<Message> {
    await this.assertConversationParticipant(input.conversationId, input.senderId)

    // Idempotent insert keyed by (senderId, clientMessageId).
    const existing = await this.prisma.message.findUnique({
      where: {
        senderId_clientMessageId: {
          senderId: input.senderId,
          clientMessageId: input.clientMessageId,
        },
      },
    })
    if (existing) return existing

    const created = await this.prisma.$transaction(async (tx) => {
      const m = await tx.message.create({
        data: {
          conversationId: input.conversationId,
          senderId: input.senderId,
          type: input.type,
          body: input.body ?? null,
          attachmentUrl: input.attachmentUrl ?? null,
          clientMessageId: input.clientMessageId,
        },
      })
      await tx.conversation.update({
        where: { id: input.conversationId },
        data: { lastMessageAt: m.createdAt },
      })
      return m
    })
    return created
  }

  async markDelivered(messageId: string, userId: string): Promise<Message | null> {
    const msg = await this.prisma.message.findUnique({ where: { id: messageId } })
    if (!msg) return null
    await this.assertConversationParticipant(msg.conversationId, userId)
    if (msg.senderId === userId) return msg // sender doesn't deliver to self
    if (msg.deliveredAt) return msg
    return this.prisma.message.update({
      where: { id: messageId },
      data: { deliveredAt: new Date() },
    })
  }

  async markRead(messageId: string, userId: string): Promise<Message | null> {
    const msg = await this.prisma.message.findUnique({ where: { id: messageId } })
    if (!msg) return null
    await this.assertConversationParticipant(msg.conversationId, userId)
    if (msg.senderId === userId) return msg
    if (msg.readAt) return msg
    return this.prisma.message.update({
      where: { id: messageId },
      data: {
        deliveredAt: msg.deliveredAt ?? new Date(),
        readAt: new Date(),
      },
    })
  }

  async archiveConversation(conversationId: string, userId: string) {
    const conv = await this.prisma.conversation.findUnique({ where: { id: conversationId } })
    if (!conv) throw new NotFoundException('Conversation not found')
    if (conv.mentorId !== userId && conv.aspirantId !== userId) {
      throw new ForbiddenException('Not a participant')
    }
    const isMentor = conv.mentorId === userId
    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: isMentor ? { archivedByMentor: true } : { archivedByMentee: true },
    })
  }

  async reportMessage(messageId: string, reporterId: string, reason: string, details?: string) {
    const msg = await this.prisma.message.findUnique({ where: { id: messageId } })
    if (!msg) throw new NotFoundException('Message not found')
    await this.assertConversationParticipant(msg.conversationId, reporterId)
    if (msg.senderId === reporterId) throw new BadRequestException('Cannot report your own message')

    // Check for duplicate report by the same user.
    const existing = await this.prisma.messageReport.findFirst({
      where: { messageId, reporterId },
    })
    if (existing) return { id: existing.id }

    const report = await this.prisma.$transaction(async (tx) => {
      const r = await tx.messageReport.create({
        data: { messageId, reporterId, reason: details ? `${reason}: ${details}` : reason },
      })
      await tx.message.update({ where: { id: messageId }, data: { isReported: true } })
      return r
    })
    return { id: report.id }
  }

  /**
   * Returns the displayHandle for a given user, used as a push notification title.
   * Falls back to a safe placeholder — never exposes phone or email.
   */
  async getSenderProfile(userId: string): Promise<string> {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { displayHandle: true },
    })
    return profile?.displayHandle ?? `User_${userId.slice(0, 4)}`
  }

  serialize = (m: Message) => ({
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    type: m.type,
    body: m.body,
    attachmentUrl: m.attachmentUrl,
    attachmentMeta: m.attachmentMeta as Record<string, unknown> | null,
    deliveredAt: m.deliveredAt?.toISOString() ?? null,
    readAt: m.readAt?.toISOString() ?? null,
    createdAt: m.createdAt.toISOString(),
  })
}
