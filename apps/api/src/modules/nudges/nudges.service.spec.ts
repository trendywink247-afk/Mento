import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NudgesService } from './nudges.service'

// ---------------------------------------------------------------------------
// Helpers / mock factories
// ---------------------------------------------------------------------------

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25h ago
    mentorProfile: null,
    ...overrides,
  }
}

function makePrisma() {
  return {
    user: {
      findMany: vi.fn(),
    },
    onboardingEvent: {
      findFirst: vi.fn().mockResolvedValue(null), // no recent nudge by default
      create: vi.fn().mockResolvedValue({ id: 'evt-1' }),
    },
  }
}

function makeNotifications() {
  return {
    send: vi.fn().mockResolvedValue(undefined),
  }
}

function makeConfig(nudgesEnabled = 'true') {
  return {
    get: vi.fn().mockReturnValue(nudgesEnabled),
  }
}

function makeService(
  prismaMock = makePrisma(),
  notifMock = makeNotifications(),
  configMock = makeConfig(),
) {
  return new NudgesService(
    prismaMock as any,
    notifMock as any,
    configMock as any,
  )
}

// ---------------------------------------------------------------------------
// Mirror nudge tests
// ---------------------------------------------------------------------------

describe('NudgesService.sendMirrorNudges', () => {
  let prisma: ReturnType<typeof makePrisma>
  let notifications: ReturnType<typeof makeNotifications>
  let service: NudgesService

  beforeEach(() => {
    prisma = makePrisma()
    notifications = makeNotifications()
    service = makeService(prisma, notifications)
  })

  it('sends push and writes audit row for eligible aspirant', async () => {
    const user = makeUser()
    prisma.user.findMany.mockResolvedValue([user])
    prisma.onboardingEvent.findFirst.mockResolvedValue(null)

    const result = await service.sendMirrorNudges()

    expect(result.nudged).toBe(1)
    expect(result.skipped).toBe(0)
    expect(notifications.send).toHaveBeenCalledOnce()
    expect(notifications.send).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: user.id,
        title: 'Finish setting up your Mento profile',
        body: expect.stringContaining('Mirror'),
      }),
    )
    expect(prisma.onboardingEvent.create).toHaveBeenCalledOnce()
    expect(prisma.onboardingEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: user.id,
          step: 'mirror_nudge_sent',
        }),
      }),
    )
  })

  it('skips aspirant who already received a nudge within 7 days', async () => {
    const user = makeUser()
    prisma.user.findMany.mockResolvedValue([user])
    // Simulate a recent nudge row existing.
    prisma.onboardingEvent.findFirst.mockResolvedValue({ id: 'existing-evt' })

    const result = await service.sendMirrorNudges()

    expect(result.nudged).toBe(0)
    expect(result.skipped).toBe(1)
    expect(notifications.send).not.toHaveBeenCalled()
    expect(prisma.onboardingEvent.create).not.toHaveBeenCalled()
  })

  it('respects CAP of 500 — Prisma query uses take: 500', async () => {
    prisma.user.findMany.mockResolvedValue([])

    await service.sendMirrorNudges()

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 500 }),
    )
  })

  it('push body contains no phone or email', async () => {
    const user = makeUser()
    prisma.user.findMany.mockResolvedValue([user])

    await service.sendMirrorNudges()

    const callArg = notifications.send.mock.calls[0][0]
    expect(callArg.body).not.toMatch(/phone|email|@|\+91/)
    expect(callArg.title).not.toMatch(/phone|email|@|\+91/)
  })

  it('returns zero nudged when no candidates', async () => {
    prisma.user.findMany.mockResolvedValue([])

    const result = await service.sendMirrorNudges()

    expect(result.found).toBe(0)
    expect(result.nudged).toBe(0)
    expect(result.skipped).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Mentor nudge tests
// ---------------------------------------------------------------------------

describe('NudgesService.sendMentorNudges', () => {
  let prisma: ReturnType<typeof makePrisma>
  let notifications: ReturnType<typeof makeNotifications>
  let service: NudgesService

  beforeEach(() => {
    prisma = makePrisma()
    notifications = makeNotifications()
    service = makeService(prisma, notifications)
  })

  it('sends push and writes audit row for eligible mentor (null attemptHistory)', async () => {
    const user = makeUser({
      id: 'mentor-1',
      mentorProfile: { attemptHistory: null, createdAt: new Date(Date.now() - 50 * 60 * 60 * 1000) },
    })
    // Single findMany returns null-history candidate; service filters it in.
    prisma.user.findMany.mockResolvedValue([user])
    prisma.onboardingEvent.findFirst.mockResolvedValue(null)

    const result = await service.sendMentorNudges()

    expect(result.nudged).toBe(1)
    expect(notifications.send).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'mentor-1',
        title: 'Complete your mentor profile',
      }),
    )
    expect(prisma.onboardingEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          step: 'mentor_nudge_sent',
        }),
      }),
    )
  })

  it('sends push for mentor with empty array attemptHistory', async () => {
    const user = makeUser({
      id: 'mentor-2',
      mentorProfile: { attemptHistory: [], createdAt: new Date(Date.now() - 50 * 60 * 60 * 1000) },
    })
    // Single findMany returns user with empty-array history; service filters it in.
    prisma.user.findMany.mockResolvedValue([user])
    prisma.onboardingEvent.findFirst.mockResolvedValue(null)

    const result = await service.sendMentorNudges()

    expect(result.nudged).toBe(1)
    expect(notifications.send).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'mentor-2' }),
    )
  })

  it('skips mentor nudged within 7 days', async () => {
    const user = makeUser({
      id: 'mentor-3',
      mentorProfile: { attemptHistory: null, createdAt: new Date(Date.now() - 50 * 60 * 60 * 1000) },
    })
    prisma.user.findMany.mockResolvedValue([user])
    prisma.onboardingEvent.findFirst.mockResolvedValue({ id: 'recent-nudge' })

    const result = await service.sendMentorNudges()

    expect(result.nudged).toBe(0)
    expect(result.skipped).toBe(1)
    expect(notifications.send).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Cron gate: NUDGES_ENABLED=false
// ---------------------------------------------------------------------------

describe('NudgesService cron gate', () => {
  it('runMirrorNudgeCron is a no-op when NUDGES_ENABLED=false', async () => {
    const prisma = makePrisma()
    const notifications = makeNotifications()
    const config = makeConfig('false')
    const service = makeService(prisma, notifications, config)

    await service.runMirrorNudgeCron()

    expect(prisma.user.findMany).not.toHaveBeenCalled()
    expect(notifications.send).not.toHaveBeenCalled()
  })

  it('runMentorNudgeCron is a no-op when NUDGES_ENABLED=false', async () => {
    const prisma = makePrisma()
    const notifications = makeNotifications()
    const config = makeConfig('false')
    const service = makeService(prisma, notifications, config)

    await service.runMentorNudgeCron()

    expect(prisma.user.findMany).not.toHaveBeenCalled()
    expect(notifications.send).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Admin trigger
// ---------------------------------------------------------------------------

describe('NudgesService.triggerNudges', () => {
  it('returns { count: N } for mirror type', async () => {
    const prisma = makePrisma()
    const notifications = makeNotifications()
    const service = makeService(prisma, notifications)

    const user = makeUser()
    prisma.user.findMany.mockResolvedValue([user])
    prisma.onboardingEvent.findFirst.mockResolvedValue(null)

    const result = await service.triggerNudges('mirror')
    expect(result).toEqual({ count: 1 })
  })

  it('returns { count: 0 } when re-triggered within 7 days for same user', async () => {
    const prisma = makePrisma()
    const notifications = makeNotifications()
    const service = makeService(prisma, notifications)

    const user = makeUser()
    prisma.user.findMany.mockResolvedValue([user])
    // Already nudged within 7 days.
    prisma.onboardingEvent.findFirst.mockResolvedValue({ id: 'existing' })

    const result = await service.triggerNudges('mirror')
    expect(result).toEqual({ count: 0 })
    expect(notifications.send).not.toHaveBeenCalled()
    expect(prisma.onboardingEvent.create).not.toHaveBeenCalled()
  })
})
