import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { ModerationAction, Role, UserStatus, ReportStatus } from '@prisma/client'
import { ModerationService as ModerationSvcClass } from './moderation.service'
import { ResolveAction } from './dto/resolve-report.dto'

// ---------------------------------------------------------------------------
// Prisma mock factory — creates isolated instances so tests don't share state
// ---------------------------------------------------------------------------

function makeTxMock() {
  return {
    messageReport: {
      update: vi.fn().mockResolvedValue({}),
    },
    moderationActionLog: {
      create: vi.fn().mockResolvedValue({}),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({}),
    },
    user: {
      update: vi.fn().mockResolvedValue({}),
    },
    refreshToken: {
      updateMany: vi.fn().mockResolvedValue({}),
    },
    pushToken: {
      deleteMany: vi.fn().mockResolvedValue({}),
    },
    mentorDenylist: {
      upsert: vi.fn().mockResolvedValue({}),
    },
  }
}

function makePrismaMock() {
  const txMock = makeTxMock()
  return {
    messageReport: {
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
    message: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    moderationActionLog: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    user: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn().mockImplementation(async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock)),
    _tx: txMock,
  }
}

type PrismaMock = ReturnType<typeof makePrismaMock>

function makeMetricsMock() {
  const counter = { inc: vi.fn() }
  return {
    otpRequestTotal: counter,
    otpVerifyTotal: counter,
    signupTotal: counter,
    paywallTotal: counter,
    subscriptionChangeTotal: counter,
    moderationActionTotal: counter,
    chatRequestTotal: counter,
    sessionRequestTotal: counter,
    httpRequestDuration: { startTimer: vi.fn().mockReturnValue(vi.fn()) },
  }
}

function makeService(prisma: PrismaMock): ModerationSvcClass {
  const metrics = makeMetricsMock()
  return new ModerationSvcClass(
    prisma as unknown as import('../../database/prisma.service').PrismaService,
    metrics as unknown as import('../metrics/metrics.service').MetricsService,
  )
}

// ---------------------------------------------------------------------------
// Minimal report fixture
// ---------------------------------------------------------------------------

function makeReport(overrides: Record<string, unknown> = {}) {
  return {
    id: 'report-1',
    messageId: 'msg-1',
    status: ReportStatus.PENDING,
    reason: 'spam',
    outcome: null,
    reviewedAt: null,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    message: {
      id: 'msg-1',
      body: 'bad message',
      type: 'TEXT',
      conversationId: 'conv-1',
      createdAt: new Date('2025-01-01T00:00:00Z'),
      conversation: { id: 'conv-1' },
      sender: {
        id: 'target-user-1',
        role: Role.ASPIRANT,
        verification: null,
        profile: { displayHandle: 'Aspirant_1234', avatarLetter: 'B', avatarColor: 'SLATE' },
      },
    },
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// resolveReport — DISMISS
// ---------------------------------------------------------------------------

describe('ModerationService.resolveReport — DISMISS', () => {
  let prisma: PrismaMock
  let svc: ModerationSvcClass

  beforeEach(() => {
    prisma = makePrismaMock()
    svc = makeService(prisma)
    prisma.messageReport.findUnique.mockResolvedValue(makeReport())
  })

  it('marks the report as REVIEWED_NO_ACTION', async () => {
    const result = await svc.resolveReport('report-1', 'admin-1', ResolveAction.DISMISS)
    expect(result).toEqual({ ok: true, action: ResolveAction.DISMISS })
    const txMock = prisma._tx
    expect(txMock.messageReport.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: ReportStatus.REVIEWED_NO_ACTION }),
      }),
    )
  })

  it('writes a ModerationActionLog row (DISMISS)', async () => {
    await svc.resolveReport('report-1', 'admin-1', ResolveAction.DISMISS, 'no harm found')
    const txMock = prisma._tx
    expect(txMock.moderationActionLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: ModerationAction.DISMISS }),
      }),
    )
  })

  it('writes an auditLog row for DISMISS', async () => {
    await svc.resolveReport('report-1', 'admin-1', ResolveAction.DISMISS)
    const txMock = prisma._tx
    expect(txMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'moderation.dismiss' }),
      }),
    )
  })

  it('does NOT update user status on DISMISS', async () => {
    // DISMISS must short-circuit after writing the audit log — no status flip,
    // no token revocation, no push-token deletion.
    await svc.resolveReport('report-1', 'admin-1', ResolveAction.DISMISS)
    const txMock = prisma._tx
    expect(txMock.messageReport.update).toHaveBeenCalled()
    expect(txMock.user.update).not.toHaveBeenCalled()
    expect(txMock.refreshToken.updateMany).not.toHaveBeenCalled()
    expect(txMock.pushToken.deleteMany).not.toHaveBeenCalled()
  })

  it('throws NotFoundException when report does not exist', async () => {
    prisma.messageReport.findUnique.mockResolvedValue(null)
    await expect(
      svc.resolveReport('nonexistent', 'admin-1', ResolveAction.DISMISS),
    ).rejects.toThrow(NotFoundException)
  })
})

// ---------------------------------------------------------------------------
// resolveReport — SUSPEND
// ---------------------------------------------------------------------------

describe('ModerationService.resolveReport — SUSPEND', () => {
  let prisma: PrismaMock
  let svc: ModerationSvcClass

  beforeEach(() => {
    prisma = makePrismaMock()
    svc = makeService(prisma)
    prisma.messageReport.findUnique.mockResolvedValue(makeReport())
  })

  it('updates user status to SUSPENDED', async () => {
    await svc.resolveReport('report-1', 'admin-1', ResolveAction.SUSPEND)
    const txMock = prisma._tx
    expect(txMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: UserStatus.SUSPENDED }),
      }),
    )
  })

  it('revokes all refresh tokens', async () => {
    await svc.resolveReport('report-1', 'admin-1', ResolveAction.SUSPEND)
    const txMock = prisma._tx
    expect(txMock.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'target-user-1', revokedAt: null }),
        data: expect.objectContaining({ revokedAt: expect.any(Date) }),
      }),
    )
  })

  it('deletes push tokens', async () => {
    await svc.resolveReport('report-1', 'admin-1', ResolveAction.SUSPEND)
    const txMock = prisma._tx
    expect(txMock.pushToken.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'target-user-1' } }),
    )
  })

  it('writes SUSPEND_ASPIRANT action log for aspirant', async () => {
    await svc.resolveReport('report-1', 'admin-1', ResolveAction.SUSPEND)
    const txMock = prisma._tx
    expect(txMock.moderationActionLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: ModerationAction.SUSPEND_ASPIRANT }),
      }),
    )
  })

  it('writes SUSPEND_MENTOR action log when target is mentor', async () => {
    const mentorReport = makeReport({
      message: {
        ...makeReport().message,
        sender: {
          id: 'target-mentor-1',
          role: Role.MENTOR,
          verification: null,
          profile: { displayHandle: 'Mentor_P_1234', avatarLetter: 'P', avatarColor: 'SKY' },
        },
      },
    })
    prisma.messageReport.findUnique.mockResolvedValue(mentorReport)
    await svc.resolveReport('report-1', 'admin-1', ResolveAction.SUSPEND)
    const txMock = prisma._tx
    expect(txMock.moderationActionLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: ModerationAction.SUSPEND_MENTOR }),
      }),
    )
  })
})

// ---------------------------------------------------------------------------
// resolveReport — BAN (verified mentor with aadhaarHash)
// ---------------------------------------------------------------------------

describe('ModerationService.resolveReport — BAN verified mentor', () => {
  let prisma: PrismaMock
  let svc: ModerationSvcClass

  beforeEach(() => {
    prisma = makePrismaMock()
    svc = makeService(prisma)

    const mentorReport = makeReport({
      message: {
        ...makeReport().message,
        sender: {
          id: 'mentor-id-1',
          role: Role.MENTOR,
          verification: { aadhaarHash: 'abc123hash' },
          profile: { displayHandle: 'Mentor_I_5678', avatarLetter: 'I', avatarColor: 'PURPLE' },
        },
      },
    })
    prisma.messageReport.findUnique.mockResolvedValue(mentorReport)
  })

  it('sets user status to BANNED', async () => {
    await svc.resolveReport('report-1', 'admin-1', ResolveAction.BAN)
    const txMock = prisma._tx
    expect(txMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: UserStatus.BANNED }),
      }),
    )
  })

  it('adds aadhaarHash to MentorDenylist', async () => {
    await svc.resolveReport('report-1', 'admin-1', ResolveAction.BAN, 'harassment')
    const txMock = prisma._tx
    expect(txMock.mentorDenylist.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { aadhaarHash: 'abc123hash' },
        create: expect.objectContaining({ aadhaarHash: 'abc123hash' }),
      }),
    )
  })

  it('revokes refresh tokens on BAN', async () => {
    await svc.resolveReport('report-1', 'admin-1', ResolveAction.BAN)
    const txMock = prisma._tx
    expect(txMock.refreshToken.updateMany).toHaveBeenCalled()
  })

  it('writes BAN_MENTOR action log', async () => {
    await svc.resolveReport('report-1', 'admin-1', ResolveAction.BAN)
    const txMock = prisma._tx
    expect(txMock.moderationActionLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: ModerationAction.BAN_MENTOR }),
      }),
    )
  })
})

// ---------------------------------------------------------------------------
// BAN — no aadhaarHash (non-verified mentor or aspirant)
// ---------------------------------------------------------------------------

describe('ModerationService.resolveReport — BAN without aadhaarHash', () => {
  let prisma: PrismaMock
  let svc: ModerationSvcClass

  beforeEach(() => {
    prisma = makePrismaMock()
    svc = makeService(prisma)
    prisma.messageReport.findUnique.mockResolvedValue(makeReport())
  })

  it('does NOT call mentorDenylist.upsert when no aadhaarHash', async () => {
    await svc.resolveReport('report-1', 'admin-1', ResolveAction.BAN)
    const txMock = prisma._tx
    expect(txMock.mentorDenylist.upsert).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// listReports — counterpart serialization never leaks phone / email
// ---------------------------------------------------------------------------

describe('ModerationService.listReports — anonymization', () => {
  let prisma: PrismaMock
  let svc: ModerationSvcClass

  beforeEach(() => {
    prisma = makePrismaMock()
    svc = makeService(prisma)
  })

  it('returned items have no phone or email keys', async () => {
    const fakeRows = [
      {
        id: 'report-1',
        createdAt: new Date(),
        status: ReportStatus.PENDING,
        reason: 'harassment',
        reporter: {
          id: 'user-1',
          phone: '+919999999999',
          email: 'user1@example.com',
          profile: { displayHandle: 'Aspirant_1234', avatarLetter: 'B', avatarColor: 'SLATE' },
        },
        message: {
          id: 'msg-1',
          body: 'some message',
          type: 'TEXT',
          conversation: { id: 'conv-1' },
          sender: {
            id: 'user-2',
            phone: '+918888888888',
            email: 'user2@example.com',
            profile: { displayHandle: 'Aspirant_5678', avatarLetter: 'A', avatarColor: 'AMBER' },
          },
        },
      },
    ]

    prisma.messageReport.findMany.mockResolvedValue(fakeRows as unknown[])

    const result = await svc.listReports({})
    const json = JSON.stringify(result)

    expect(json).not.toContain('+919999999999')
    expect(json).not.toContain('+918888888888')
    expect(json).not.toContain('user1@example.com')
    expect(json).not.toContain('user2@example.com')
  })

  it('returned items include displayHandle, avatarLetter, avatarColor', async () => {
    const fakeRows = [
      {
        id: 'report-2',
        createdAt: new Date(),
        status: ReportStatus.PENDING,
        reason: 'spam',
        reporter: {
          id: 'user-3',
          profile: { displayHandle: 'Aspirant_0001', avatarLetter: 'B', avatarColor: 'SLATE' },
        },
        message: {
          id: 'msg-2',
          body: 'spam content',
          type: 'TEXT',
          conversation: { id: 'conv-2' },
          sender: {
            id: 'user-4',
            profile: { displayHandle: 'Mentor_P_9999', avatarLetter: 'P', avatarColor: 'SKY' },
          },
        },
      },
    ]

    prisma.messageReport.findMany.mockResolvedValue(fakeRows as unknown[])

    const result = await svc.listReports({})
    expect(result.items[0]).toMatchObject({
      reporter: { displayHandle: 'Aspirant_0001', avatarLetter: 'B', avatarColor: 'SLATE' },
      target: { displayHandle: 'Mentor_P_9999', avatarLetter: 'P', avatarColor: 'SKY' },
    })
  })
})

// ---------------------------------------------------------------------------
// getReport — basic retrieval and NotFoundException
// ---------------------------------------------------------------------------

describe('ModerationService.getReport', () => {
  let prisma: PrismaMock
  let svc: ModerationSvcClass

  beforeEach(() => {
    prisma = makePrismaMock()
    svc = makeService(prisma)
  })

  it('throws NotFoundException when report is not found', async () => {
    prisma.messageReport.findUnique.mockResolvedValue(null)
    await expect(svc.getReport('nonexistent-id')).rejects.toThrow(NotFoundException)
  })

  it('returns anonymized reporter and target', async () => {
    const reportRow = {
      id: 'report-1',
      messageId: 'msg-1',
      status: ReportStatus.PENDING,
      reason: 'spam',
      outcome: null,
      reviewedAt: null,
      createdAt: new Date('2025-01-01T00:00:00Z'),
      reporter: {
        id: 'reporter-user',
        phone: '+919000000001',
        email: 'reporter@test.com',
        profile: { displayHandle: 'Aspirant_0001', avatarLetter: 'B', avatarColor: 'SLATE' },
      },
      message: {
        id: 'msg-1',
        body: 'bad content',
        type: 'TEXT',
        createdAt: new Date('2025-01-01T00:00:00Z'),
        conversationId: 'conv-1',
        senderId: 'sender-user',
        conversation: { id: 'conv-1' },
        sender: {
          id: 'sender-user',
          phone: '+918000000001',
          email: 'sender@test.com',
          profile: { displayHandle: 'Mentor_P_9999', avatarLetter: 'P', avatarColor: 'SKY' },
        },
      },
    }
    prisma.messageReport.findUnique.mockResolvedValue(reportRow)
    prisma.message.findMany.mockResolvedValue([])

    const result = await svc.getReport('report-1')
    const json = JSON.stringify(result)
    // No raw phone / email in output
    expect(json).not.toContain('+919000000001')
    expect(json).not.toContain('+918000000001')
    expect(json).not.toContain('reporter@test.com')
    expect(json).not.toContain('sender@test.com')
    expect(result).toHaveProperty('reporter.displayHandle', 'Aspirant_0001')
    expect(result).toHaveProperty('target.displayHandle', 'Mentor_P_9999')
  })
})

// ---------------------------------------------------------------------------
// setUserStatus — ForbiddenException on self-modification
// ---------------------------------------------------------------------------

describe('ModerationService.setUserStatus', () => {
  let prisma: PrismaMock
  let svc: ModerationSvcClass

  beforeEach(() => {
    prisma = makePrismaMock()
    svc = makeService(prisma)
  })

  it('throws NotFoundException when user does not exist', async () => {
    prisma.user.findUnique.mockResolvedValue(null)
    await expect(svc.setUserStatus('no-user', 'admin-1', UserStatus.SUSPENDED)).rejects.toThrow(
      NotFoundException,
    )
  })

  it('throws ForbiddenException when admin tries to modify own status', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'admin-1',
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
      verification: null,
    })
    await expect(svc.setUserStatus('admin-1', 'admin-1', UserStatus.SUSPENDED)).rejects.toThrow(
      ForbiddenException,
    )
  })

  it('calls user.update with new status on success', async () => {
    const targetUser = {
      id: 'user-target',
      role: Role.ASPIRANT,
      status: UserStatus.ACTIVE,
      verification: null,
    }
    prisma.user.findUnique.mockResolvedValue(targetUser)
    const txMock = prisma._tx
    const result = await svc.setUserStatus('user-target', 'admin-1', UserStatus.SUSPENDED)
    expect(result).toEqual({ ok: true, status: UserStatus.SUSPENDED })
    expect(txMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-target' },
        data: expect.objectContaining({ status: UserStatus.SUSPENDED }),
      }),
    )
  })

  it('revokes tokens on SUSPENDED status', async () => {
    const targetUser = {
      id: 'user-target-2',
      role: Role.ASPIRANT,
      status: UserStatus.ACTIVE,
      verification: null,
    }
    prisma.user.findUnique.mockResolvedValue(targetUser)
    const txMock = prisma._tx
    await svc.setUserStatus('user-target-2', 'admin-1', UserStatus.SUSPENDED)
    expect(txMock.refreshToken.updateMany).toHaveBeenCalled()
    expect(txMock.pushToken.deleteMany).toHaveBeenCalled()
  })

  it('adds to denylist on BAN when aadhaarHash present', async () => {
    const targetUser = {
      id: 'mentor-target',
      role: Role.MENTOR,
      status: UserStatus.ACTIVE,
      verification: { aadhaarHash: 'mentor-hash-xyz' },
    }
    prisma.user.findUnique.mockResolvedValue(targetUser)
    const txMock = prisma._tx
    await svc.setUserStatus('mentor-target', 'admin-1', UserStatus.BANNED)
    expect(txMock.mentorDenylist.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { aadhaarHash: 'mentor-hash-xyz' } }),
    )
  })
})
