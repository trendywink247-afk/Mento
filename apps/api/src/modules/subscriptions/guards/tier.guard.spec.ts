import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HttpException, HttpStatus } from '@nestjs/common'
import { SubscriptionTier, Role } from '@prisma/client'
import { TierGuard } from './tier.guard'
import { MIN_TIER_KEY } from './min-tier.decorator'
import type { JwtUser } from '../../auth/decorators/current-user.decorator'

// ---------------------------------------------------------------------------
// Minimal ExecutionContext mock builder
// ---------------------------------------------------------------------------

function makeContext(user: JwtUser | null, requiredTier: SubscriptionTier | undefined) {
  return {
    getHandler: vi.fn().mockReturnValue({}),
    getClass: vi.fn().mockReturnValue({}),
    switchToHttp: vi.fn().mockReturnValue({
      getRequest: vi.fn().mockReturnValue({ user: user ?? undefined }),
    }),
  } as unknown as import('@nestjs/common').ExecutionContext
}

// ---------------------------------------------------------------------------
// Reflector mock — returns the requiredTier for the MIN_TIER_KEY
// ---------------------------------------------------------------------------

function makeReflector(requiredTier: SubscriptionTier | undefined) {
  return {
    getAllAndOverride: vi.fn().mockImplementation((key: string) => {
      if (key === MIN_TIER_KEY) return requiredTier
      return undefined
    }),
  } as unknown as import('@nestjs/core').Reflector
}

// ---------------------------------------------------------------------------
// SubscriptionsService mock — returns a controllable current tier
// ---------------------------------------------------------------------------

function makeSubsService(currentTier: SubscriptionTier) {
  return {
    getTierForUser: vi.fn().mockResolvedValue(currentTier),
  } as unknown as import('../subscriptions.service').SubscriptionsService
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TierGuard — no @MinTier decorator', () => {
  it('passes through when no MinTier metadata is set', async () => {
    const reflector = makeReflector(undefined)
    const subs = makeSubsService(SubscriptionTier.FREE)
    const guard = new TierGuard(reflector, subs)
    const ctx = makeContext(
      { sub: 'user-1', role: Role.ASPIRANT, jti: 'jti-1' },
      undefined,
    )
    const result = await guard.canActivate(ctx)
    expect(result).toBe(true)
  })
})

describe('TierGuard — no authenticated user', () => {
  it('returns false when req.user is absent', async () => {
    const reflector = makeReflector(SubscriptionTier.PRO)
    const subs = makeSubsService(SubscriptionTier.FREE)
    const guard = new TierGuard(reflector, subs)
    const ctx = makeContext(null, SubscriptionTier.PRO)
    const result = await guard.canActivate(ctx)
    expect(result).toBe(false)
  })
})

describe('TierGuard — MinTier(PRO)', () => {
  let reflector: ReturnType<typeof makeReflector>

  beforeEach(() => {
    reflector = makeReflector(SubscriptionTier.PRO)
  })

  it('FREE user throws 402 with requiredTier and currentTier', async () => {
    const subs = makeSubsService(SubscriptionTier.FREE)
    const guard = new TierGuard(reflector, subs)
    const ctx = makeContext({ sub: 'user-1', role: Role.ASPIRANT, jti: 'j1' }, SubscriptionTier.PRO)

    let caught: unknown
    try {
      await guard.canActivate(ctx)
    } catch (err) {
      caught = err
    }

    expect(caught).toBeInstanceOf(HttpException)
    const httpErr = caught as HttpException
    expect(httpErr.getStatus()).toBe(HttpStatus.PAYMENT_REQUIRED)
    expect(httpErr.getResponse()).toMatchObject({
      requiredTier: SubscriptionTier.PRO,
      currentTier: SubscriptionTier.FREE,
    })
  })

  it('BASIC user throws 402', async () => {
    const subs = makeSubsService(SubscriptionTier.BASIC)
    const guard = new TierGuard(reflector, subs)
    const ctx = makeContext({ sub: 'user-2', role: Role.ASPIRANT, jti: 'j2' }, SubscriptionTier.PRO)

    await expect(guard.canActivate(ctx)).rejects.toThrow(HttpException)
  })

  it('BASIC user throws with currentTier: BASIC in error body', async () => {
    const subs = makeSubsService(SubscriptionTier.BASIC)
    const guard = new TierGuard(reflector, subs)
    const ctx = makeContext({ sub: 'user-2', role: Role.ASPIRANT, jti: 'j2' }, SubscriptionTier.PRO)

    let caught: unknown
    try {
      await guard.canActivate(ctx)
    } catch (err) {
      caught = err
    }
    const httpErr = caught as HttpException
    expect(httpErr.getResponse()).toMatchObject({ currentTier: SubscriptionTier.BASIC })
  })

  it('PRO user passes (same tier = sufficient access)', async () => {
    const subs = makeSubsService(SubscriptionTier.PRO)
    const guard = new TierGuard(reflector, subs)
    const ctx = makeContext({ sub: 'user-3', role: Role.ASPIRANT, jti: 'j3' }, SubscriptionTier.PRO)
    const result = await guard.canActivate(ctx)
    expect(result).toBe(true)
  })

  it('MAX user passes (MAX > PRO in tier order)', async () => {
    const subs = makeSubsService(SubscriptionTier.MAX)
    const guard = new TierGuard(reflector, subs)
    const ctx = makeContext({ sub: 'user-4', role: Role.ASPIRANT, jti: 'j4' }, SubscriptionTier.PRO)
    const result = await guard.canActivate(ctx)
    expect(result).toBe(true)
  })
})

describe('TierGuard — MinTier(BASIC)', () => {
  it('FREE throws 402 with requiredTier: BASIC', async () => {
    const reflector = makeReflector(SubscriptionTier.BASIC)
    const subs = makeSubsService(SubscriptionTier.FREE)
    const guard = new TierGuard(reflector, subs)
    const ctx = makeContext({ sub: 'user-5', role: Role.ASPIRANT, jti: 'j5' }, SubscriptionTier.BASIC)

    let caught: unknown
    try {
      await guard.canActivate(ctx)
    } catch (err) {
      caught = err
    }
    const httpErr = caught as HttpException
    expect(httpErr.getStatus()).toBe(402)
    expect(httpErr.getResponse()).toMatchObject({ requiredTier: SubscriptionTier.BASIC })
  })

  it('BASIC passes for MinTier(BASIC)', async () => {
    const reflector = makeReflector(SubscriptionTier.BASIC)
    const subs = makeSubsService(SubscriptionTier.BASIC)
    const guard = new TierGuard(reflector, subs)
    const ctx = makeContext({ sub: 'user-6', role: Role.ASPIRANT, jti: 'j6' }, SubscriptionTier.BASIC)
    const result = await guard.canActivate(ctx)
    expect(result).toBe(true)
  })
})

describe('TierGuard — MinTier(MAX)', () => {
  it('PRO user throws 402 for MinTier(MAX)', async () => {
    const reflector = makeReflector(SubscriptionTier.MAX)
    const subs = makeSubsService(SubscriptionTier.PRO)
    const guard = new TierGuard(reflector, subs)
    const ctx = makeContext({ sub: 'user-7', role: Role.ASPIRANT, jti: 'j7' }, SubscriptionTier.MAX)
    await expect(guard.canActivate(ctx)).rejects.toThrow(HttpException)
  })

  it('MAX passes for MinTier(MAX)', async () => {
    const reflector = makeReflector(SubscriptionTier.MAX)
    const subs = makeSubsService(SubscriptionTier.MAX)
    const guard = new TierGuard(reflector, subs)
    const ctx = makeContext({ sub: 'user-8', role: Role.ASPIRANT, jti: 'j8' }, SubscriptionTier.MAX)
    const result = await guard.canActivate(ctx)
    expect(result).toBe(true)
  })
})

describe('TierGuard — getTierForUser is called with user.sub', () => {
  it('queries tier by the JWT sub claim', async () => {
    const reflector = makeReflector(SubscriptionTier.PRO)
    const subs = makeSubsService(SubscriptionTier.MAX)
    const guard = new TierGuard(reflector, subs)
    const ctx = makeContext({ sub: 'specific-user-id', role: Role.MENTOR, jti: 'j9' }, SubscriptionTier.PRO)
    await guard.canActivate(ctx)
    expect(subs.getTierForUser).toHaveBeenCalledWith('specific-user-id')
  })
})
