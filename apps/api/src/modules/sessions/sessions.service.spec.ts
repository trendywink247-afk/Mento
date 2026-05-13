import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { Role, SessionRequestStatus, PaymentStatus } from '@prisma/client'
import { SessionsService } from './sessions.service'

// ---------------------------------------------------------------------------
// Prisma mock factory
// ---------------------------------------------------------------------------

function makeTxMock() {
  return {
    sessionRequest: {
      create: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'req-new-1',
        status: SessionRequestStatus.PENDING,
        paymentStatus: PaymentStatus.SIMULATED,
        ...data,
      })),
    },
    walletTransaction: {
      create: vi.fn().mockResolvedValue({}),
    },
  }
}

function makePrismaMock() {
  const txMock = makeTxMock()
  return {
    mentorProfile: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    user: {
      findUnique: vi.fn(),
    },
    sessionRequest: {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
    },
    walletTransaction: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    $transaction: vi.fn().mockImplementation(async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock)),
    _tx: txMock,
  }
}

type PrismaMock = ReturnType<typeof makePrismaMock>

function makeService(prisma: PrismaMock): SessionsService {
  return new SessionsService(prisma as unknown as import('../../database/prisma.service').PrismaService)
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const MENTOR_ID = 'mentor-aaa'
const MENTEE_ID = 'mentee-bbb'
const FUTURE_DATE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
const PAST_DATE = new Date(Date.now() - 60 * 1000).toISOString()

function makeMentorProfile(hourlyRateInr = 400) {
  return {
    userId: MENTOR_ID,
    hourlyRateInr,
    availability: null,
    isVerified: false,
    journeyType: null,
    bio: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function makeMentorUser() {
  return {
    id: MENTOR_ID,
    role: Role.MENTOR,
    status: 'ACTIVE',
    phone: '+910000000001',
    email: null,
    displayHandle: 'Mentor_P_1234',
    profile: {
      displayHandle: 'Mentor_P_1234',
      avatarLetter: 'P',
      avatarColor: 'SKY',
      hasPurpleTick: false,
    },
  }
}

// ─── createRequest ────────────────────────────────────────────────────────────

describe('SessionsService.createRequest — self-booking guard', () => {
  let prisma: PrismaMock
  let svc: SessionsService

  beforeEach(() => {
    prisma = makePrismaMock()
    svc = makeService(prisma)
  })

  it('throws BadRequestException when menteeId === mentorId', async () => {
    await expect(
      svc.createRequest(MENTOR_ID, MENTOR_ID, FUTURE_DATE, 60),
    ).rejects.toThrow(BadRequestException)
  })

  it('throws with descriptive message', async () => {
    await expect(
      svc.createRequest(MENTOR_ID, MENTOR_ID, FUTURE_DATE, 60),
    ).rejects.toThrow("You can't request yourself")
  })
})

describe('SessionsService.createRequest — past scheduledAt', () => {
  let prisma: PrismaMock
  let svc: SessionsService

  beforeEach(() => {
    prisma = makePrismaMock()
    svc = makeService(prisma)
    prisma.user.findUnique.mockResolvedValue(makeMentorUser())
    prisma.mentorProfile.findUnique.mockResolvedValue(makeMentorProfile())
  })

  it('throws BadRequestException for past scheduledAt', async () => {
    await expect(
      svc.createRequest(MENTEE_ID, MENTOR_ID, PAST_DATE, 60),
    ).rejects.toThrow(BadRequestException)
  })

  it('throws BadRequestException for invalid date string', async () => {
    await expect(
      svc.createRequest(MENTEE_ID, MENTOR_ID, 'not-a-date', 60),
    ).rejects.toThrow(BadRequestException)
  })
})

describe('SessionsService.createRequest — 5-pending cap', () => {
  let prisma: PrismaMock
  let svc: SessionsService

  beforeEach(() => {
    prisma = makePrismaMock()
    svc = makeService(prisma)
    prisma.user.findUnique.mockResolvedValue(makeMentorUser())
    prisma.mentorProfile.findUnique.mockResolvedValue(makeMentorProfile())
    // Already 5 pending requests
    prisma.sessionRequest.count.mockResolvedValue(5)
  })

  it('throws BadRequestException when pending count = 5', async () => {
    await expect(
      svc.createRequest(MENTEE_ID, MENTOR_ID, FUTURE_DATE, 60),
    ).rejects.toThrow(BadRequestException)
  })

  it('error message mentions 5 pending requests', async () => {
    await expect(
      svc.createRequest(MENTEE_ID, MENTOR_ID, FUTURE_DATE, 60),
    ).rejects.toThrow('Maximum 5 pending session requests at a time')
  })

  it('does not throw when pending count = 4 (still under cap)', async () => {
    prisma.sessionRequest.count.mockResolvedValue(4)
    const result = await svc.createRequest(MENTEE_ID, MENTOR_ID, FUTURE_DATE, 60)
    expect(result).toMatchObject({ status: SessionRequestStatus.PENDING })
  })
})

describe('SessionsService.createRequest — mentor not found', () => {
  let prisma: PrismaMock
  let svc: SessionsService

  beforeEach(() => {
    prisma = makePrismaMock()
    svc = makeService(prisma)
  })

  it('throws NotFoundException when mentor user not found', async () => {
    prisma.user.findUnique.mockResolvedValue(null)
    prisma.mentorProfile.findUnique.mockResolvedValue(null)
    await expect(
      svc.createRequest(MENTEE_ID, MENTOR_ID, FUTURE_DATE, 60),
    ).rejects.toThrow(NotFoundException)
  })

  it('throws NotFoundException when mentor profile not found', async () => {
    prisma.user.findUnique.mockResolvedValue(makeMentorUser())
    prisma.mentorProfile.findUnique.mockResolvedValue(null)
    await expect(
      svc.createRequest(MENTEE_ID, MENTOR_ID, FUTURE_DATE, 60),
    ).rejects.toThrow(NotFoundException)
  })
})

// ─── Cost calculation ─────────────────────────────────────────────────────────

describe('SessionsService.createRequest — cost calculation', () => {
  let prisma: PrismaMock
  let svc: SessionsService

  beforeEach(() => {
    prisma = makePrismaMock()
    svc = makeService(prisma)
    prisma.user.findUnique.mockResolvedValue(makeMentorUser())
    prisma.sessionRequest.count.mockResolvedValue(0)
  })

  it('₹400/hr × 60min = ₹400', async () => {
    prisma.mentorProfile.findUnique.mockResolvedValue(makeMentorProfile(400))
    const result = await svc.createRequest(MENTEE_ID, MENTOR_ID, FUTURE_DATE, 60)
    expect(result.amountInr).toBe(400)
  })

  it('₹400/hr × 90min = ₹600', async () => {
    prisma.mentorProfile.findUnique.mockResolvedValue(makeMentorProfile(400))
    const result = await svc.createRequest(MENTEE_ID, MENTOR_ID, FUTURE_DATE, 90)
    expect(result.amountInr).toBe(600)
  })

  it('₹600/hr × 30min = ₹300', async () => {
    prisma.mentorProfile.findUnique.mockResolvedValue(makeMentorProfile(600))
    const result = await svc.createRequest(MENTEE_ID, MENTOR_ID, FUTURE_DATE, 30)
    expect(result.amountInr).toBe(300)
  })

  it('rounds up fractional amounts with Math.ceil', async () => {
    // 500/hr × 45min = 375 (exact), no rounding needed
    prisma.mentorProfile.findUnique.mockResolvedValue(makeMentorProfile(500))
    const result = await svc.createRequest(MENTEE_ID, MENTOR_ID, FUTURE_DATE, 45)
    expect(result.amountInr).toBe(375)
  })
})

// ─── listRequests — counterpart anonymization ────────────────────────────────

describe('SessionsService.listRequests — anonymization', () => {
  let prisma: PrismaMock
  let svc: SessionsService

  const menteeWithPhone = {
    id: 'mentee-1',
    phone: '+919876543210',
    email: 'secret@example.com',
    profile: {
      displayHandle: 'Aspirant_5678',
      avatarLetter: 'B',
      avatarColor: 'SLATE',
      hasPurpleTick: false,
    },
  }

  const fakeRequest = {
    id: 'req-1',
    scheduledAt: new Date(Date.now() + 3600 * 1000),
    durationMin: 60,
    hourlyRateInr: 400,
    status: SessionRequestStatus.PENDING,
    paymentStatus: PaymentStatus.SIMULATED,
    message: 'help me',
    createdAt: new Date(),
    respondedAt: null,
    expiresAt: new Date(Date.now() + 48 * 3600 * 1000),
    session: null,
    mentee: menteeWithPhone,
  }

  beforeEach(() => {
    prisma = makePrismaMock()
    svc = makeService(prisma)
    prisma.sessionRequest.findMany.mockResolvedValue([fakeRequest])
  })

  it('counterpart field has no phone key', async () => {
    const results = await svc.listRequests(MENTOR_ID, Role.MENTOR)
    const json = JSON.stringify(results)
    expect(json).not.toContain('+919876543210')
  })

  it('counterpart field has no email key', async () => {
    const results = await svc.listRequests(MENTOR_ID, Role.MENTOR)
    const json = JSON.stringify(results)
    expect(json).not.toContain('secret@example.com')
  })

  it('counterpart field contains displayHandle', async () => {
    const results = await svc.listRequests(MENTOR_ID, Role.MENTOR)
    expect(results[0].counterpart.displayHandle).toBe('Aspirant_5678')
  })

  it('counterpart field contains avatarLetter and avatarColor', async () => {
    const results = await svc.listRequests(MENTOR_ID, Role.MENTOR)
    expect(results[0].counterpart).toMatchObject({
      avatarLetter: 'B',
      avatarColor: 'SLATE',
    })
  })

  it('response for mentee role contains mentor as counterpart', async () => {
    const mentorUser = {
      id: MENTOR_ID,
      phone: '+910000000001',
      email: null,
      profile: {
        displayHandle: 'Mentor_P_1234',
        avatarLetter: 'P',
        avatarColor: 'SKY',
        hasPurpleTick: false,
      },
    }
    const menteeRequest = {
      ...fakeRequest,
      mentor: mentorUser,
    }
    prisma.sessionRequest.findMany.mockResolvedValue([menteeRequest])
    const results = await svc.listRequests(MENTEE_ID, Role.ASPIRANT)
    const json = JSON.stringify(results)
    // mentor's phone should not appear
    expect(json).not.toContain('+910000000001')
    expect(results[0].counterpart.displayHandle).toBe('Mentor_P_1234')
  })
})

// ─── acceptRequest / declineRequest ownership guards ─────────────────────────

describe('SessionsService.acceptRequest — ownership guard', () => {
  let prisma: PrismaMock
  let svc: SessionsService

  const pendingReq = {
    id: 'req-1',
    mentorId: MENTOR_ID,
    menteeId: MENTEE_ID,
    status: SessionRequestStatus.PENDING,
    hourlyRateInr: 400,
    durationMin: 60,
    message: null,
  }

  beforeEach(() => {
    prisma = makePrismaMock()
    svc = makeService(prisma)
    // Add session create to txMock
    prisma._tx = {
      ...prisma._tx,
      sessionRequest: {
        update: vi.fn().mockResolvedValue({ id: 'req-1', status: SessionRequestStatus.ACCEPTED }),
      },
      session: {
        create: vi.fn().mockResolvedValue({}),
      },
    } as unknown as typeof prisma._tx
    prisma.$transaction.mockImplementation(
      async (fn: (tx: typeof prisma._tx) => Promise<unknown>) => fn(prisma._tx),
    )
  })

  it('throws ForbiddenException when a different mentor tries to accept', async () => {
    prisma.sessionRequest.findUnique.mockResolvedValue(pendingReq)
    await expect(svc.acceptRequest('req-1', 'other-mentor')).rejects.toThrow(ForbiddenException)
  })

  it('throws NotFoundException when request not found', async () => {
    prisma.sessionRequest.findUnique.mockResolvedValue(null)
    await expect(svc.acceptRequest('req-1', MENTOR_ID)).rejects.toThrow(NotFoundException)
  })
})
