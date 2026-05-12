import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import {
  Journal,
  JournalAuditAction,
  JournalCategory,
  JournalEntryType,
  Prisma,
} from '@prisma/client'
import { PrismaService } from '../../database/prisma.service'

@Injectable()
export class JournalsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List a user's journals, grouped per category.
   * Includes the per-mentor shared journals as separate rows.
   */
  async listForUser(userId: string) {
    const rows = await this.prisma.journal.findMany({
      where: { ownerId: userId },
      orderBy: [{ updatedAt: 'desc' }],
      include: {
        conversation: {
          include: {
            mentor: { include: { profile: true } },
            aspirant: { include: { profile: true } },
          },
        },
        _count: { select: { entries: true } },
      },
    })

    return rows.map((j) => {
      const counterpart =
        j.conversation && j.conversation.mentorId === userId
          ? j.conversation.aspirant
          : j.conversation?.mentor
      return {
        id: j.id,
        category: j.category,
        title: j.title,
        isShared: j.isShared,
        isLocked: j.isLocked,
        conversationId: j.conversationId,
        entryCount: j._count.entries,
        updatedAt: j.updatedAt.toISOString(),
        sharedWith: counterpart
          ? {
              id: counterpart.id,
              displayHandle: counterpart.profile?.displayHandle ?? '—',
              avatarLetter: counterpart.profile?.avatarLetter ?? 'B',
              avatarColor: counterpart.profile?.avatarColor ?? 'SLATE',
            }
          : null,
      }
    })
  }

  async upsert(userId: string, category: JournalCategory, conversationId?: string, title?: string) {
    // Postgres treats NULLs as not-equal-to-each-other inside unique indexes, so
    // `prisma.upsert` on a compound key that contains a nullable column will
    // happily create duplicates AND fail to match the existing row.
    // findFirst + create/update sidesteps that — at the small cost of a non-atomic
    // 2-statement path, which is fine for journals (no contention).
    const existing = await this.prisma.journal.findFirst({
      where: { ownerId: userId, category, conversationId: conversationId ?? null },
    })
    if (existing) {
      if (title && title !== existing.title) {
        return this.prisma.journal.update({ where: { id: existing.id }, data: { title } })
      }
      return existing
    }
    return this.prisma.journal.create({
      data: {
        ownerId: userId,
        category,
        conversationId: conversationId ?? null,
        isShared: !!conversationId,
        title,
      },
    })
  }

  async getJournal(journalId: string, userId: string) {
    const journal = await this.prisma.journal.findUnique({
      where: { id: journalId },
      include: {
        entries: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          include: { author: { include: { profile: true } } },
        },
        conversation: { include: { presenceState: true } },
      },
    })
    if (!journal) throw new NotFoundException('Journal not found')

    const isOwner = journal.ownerId === userId
    const isCounterpart =
      journal.conversation &&
      (journal.conversation.mentorId === userId || journal.conversation.aspirantId === userId)

    if (!isOwner && !isCounterpart) throw new ForbiddenException('Not your journal')

    const canEdit = await this.canEdit(journal, userId)
    return {
      id: journal.id,
      category: journal.category,
      title: journal.title,
      isShared: journal.isShared,
      isLocked: journal.isLocked,
      canEdit,
      entries: journal.entries.map((e) => ({
        id: e.id,
        type: e.type,
        content: e.content,
        sourceMessageId: e.sourceMessageId,
        createdAt: e.createdAt.toISOString(),
        updatedAt: e.updatedAt.toISOString(),
        author: {
          id: e.author.id,
          displayHandle: e.author.profile?.displayHandle ?? '—',
          avatarLetter: e.author.profile?.avatarLetter ?? 'B',
          avatarColor: e.author.profile?.avatarColor ?? 'SLATE',
        },
      })),
    }
  }

  async createEntry(
    journalId: string,
    userId: string,
    body: { type: JournalEntryType; content: string; sourceMessageId?: string },
  ) {
    const journal = await this.prisma.journal.findUnique({
      where: { id: journalId },
      include: { conversation: { include: { presenceState: true } } },
    })
    if (!journal) throw new NotFoundException('Journal not found')

    const canEdit = await this.canEdit(journal, userId)
    if (!canEdit) {
      throw new ForbiddenException(
        journal.isLocked
          ? 'This journal is permanently locked.'
          : 'Both participants must be active to edit a shared journal.',
      )
    }

    const entry = await this.prisma.$transaction(async (tx) => {
      const e = await tx.journalEntry.create({
        data: {
          journalId,
          authorId: userId,
          type: body.type,
          content: body.content,
          sourceMessageId: body.sourceMessageId,
        },
      })
      await tx.journalAuditLog.create({
        data: {
          journalId,
          userId,
          action: JournalAuditAction.APPEND,
          diff: { entryId: e.id, contentLength: body.content.length } as never,
        },
      })
      await tx.journal.update({
        where: { id: journalId },
        data: { lastActivePairSeenAt: new Date() },
      })
      return e
    })

    return entry
  }

  async updateEntry(
    entryId: string,
    userId: string,
    content: string,
  ) {
    const entry = await this.prisma.journalEntry.findUnique({
      where: { id: entryId },
      include: { journal: { include: { conversation: { include: { presenceState: true } } } } },
    })
    if (!entry) throw new NotFoundException('Entry not found')
    if (entry.authorId !== userId) {
      throw new ForbiddenException('Only the author can edit')
    }

    const canEdit = await this.canEdit(entry.journal, userId)
    if (!canEdit) throw new ForbiddenException('Cannot edit right now')

    const before = entry.content

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.journalEntry.update({
        where: { id: entryId },
        data: { content },
      })
      await tx.journalAuditLog.create({
        data: {
          journalId: entry.journalId,
          userId,
          action: JournalAuditAction.EDIT,
          diff: { entryId, before, after: content } as never,
        },
      })
      return updated
    })
  }

  async deleteEntry(entryId: string, userId: string) {
    const entry = await this.prisma.journalEntry.findUnique({
      where: { id: entryId },
      include: { journal: true },
    })
    if (!entry) throw new NotFoundException('Entry not found')
    if (entry.authorId !== userId && entry.journal.ownerId !== userId) {
      throw new ForbiddenException('Cannot delete')
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.journalEntry.update({
        where: { id: entryId },
        data: { deletedAt: new Date() },
      })
      await tx.journalAuditLog.create({
        data: {
          journalId: entry.journalId,
          userId,
          action: JournalAuditAction.DELETE,
          diff: { entryId } as never,
        },
      })
    })
  }

  async getAuditLog(journalId: string, userId: string) {
    const journal = await this.prisma.journal.findUnique({
      where: { id: journalId },
      include: { conversation: true },
    })
    if (!journal) throw new NotFoundException('Journal not found')
    const isOwner = journal.ownerId === userId
    const isCounterpart =
      journal.conversation &&
      (journal.conversation.mentorId === userId || journal.conversation.aspirantId === userId)
    if (!isOwner && !isCounterpart) throw new ForbiddenException('Not your journal')

    return this.prisma.journalAuditLog.findMany({
      where: { journalId },
      orderBy: { timestamp: 'desc' },
      take: 200,
      include: { user: { include: { profile: true } } },
    })
  }

  /** Long-press save: copies a message into a category journal. */
  async saveMessageToJournal(messageId: string, userId: string, category: JournalCategory) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { conversation: true },
    })
    if (!message) throw new NotFoundException('Message not found')
    if (
      message.conversation.mentorId !== userId &&
      message.conversation.aspirantId !== userId
    ) {
      throw new ForbiddenException('Not your conversation')
    }

    const journal = await this.upsert(userId, category)
    return this.createEntry(journal.id, userId, {
      type: JournalEntryType.SAVED_CHAT,
      content: message.body ?? '(media message)',
      sourceMessageId: message.id,
    })
  }

  /**
   * Edit gating for shared journals — Section 1.10.
   * Personal journals: owner can always edit.
   * Shared journals: both participants must be active in the conversation.
   * Locked journals: nobody can edit.
   */
  private async canEdit(
    journal: Journal & { conversation?: { presenceState?: { mentorActive: boolean; menteeActive: boolean } | null } | null },
    userId: string,
  ): Promise<boolean> {
    if (journal.isLocked) return false
    if (!journal.isShared) return journal.ownerId === userId
    if (!journal.conversationId) return false

    // Pull fresh presence state if not provided.
    const presence =
      journal.conversation?.presenceState ??
      (await this.prisma.conversationPresence.findUnique({
        where: { conversationId: journal.conversationId },
      }))
    if (!presence) return false
    return presence.mentorActive && presence.menteeActive
  }

  /** Called by chat gateway when a participant connects/joins/leaves. */
  async setPresence(conversationId: string, userId: string, active: boolean) {
    const conv = await this.prisma.conversation.findUnique({ where: { id: conversationId } })
    if (!conv) return
    const isMentor = conv.mentorId === userId
    const isMentee = conv.aspirantId === userId
    if (!isMentor && !isMentee) return

    await this.prisma.conversationPresence.upsert({
      where: { conversationId },
      create: {
        conversationId,
        mentorActive: isMentor && active,
        menteeActive: isMentee && active,
        mentorLastSeen: isMentor ? new Date() : null,
        menteeLastSeen: isMentee ? new Date() : null,
      },
      update: {
        ...(isMentor && { mentorActive: active, mentorLastSeen: new Date() }),
        ...(isMentee && { menteeActive: active, menteeLastSeen: new Date() }),
      } as Prisma.ConversationPresenceUpdateInput,
    })
  }

  async lockSharedJournalsForConversation(conversationId: string, actorId?: string) {
    const journal = await this.prisma.journal.findFirst({ where: { conversationId } })
    if (!journal || journal.isLocked) return
    await this.prisma.$transaction(async (tx) => {
      await tx.journal.update({ where: { id: journal.id }, data: { isLocked: true } })
      await tx.journalAuditLog.create({
        data: {
          journalId: journal.id,
          userId: actorId ?? journal.ownerId,
          action: JournalAuditAction.LOCK,
          diff: { reason: 'conversation_archived' } as never,
        },
      })
    })
  }
}
