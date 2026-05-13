/**
 * Unit tests for OtpService rate-limit and brute-force lockout logic.
 *
 * Strategy:
 * - Mock Prisma and Redis so no real DB/network calls happen.
 * - Call service methods directly (no NestJS DI).
 * - Focus on the per-phone rate-limit, verify-attempt counter, and lockout.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BadRequestException, HttpException } from '@nestjs/common'
import { OtpService } from './otp.service'

// ---------------------------------------------------------------------------
// Minimal Redis mock — only the methods OtpService calls.
// ---------------------------------------------------------------------------
function makeRedisMock() {
  const store: Map<string, { value: string; ttl: number }> = new Map()

  return {
    _store: store,
    exists: vi.fn(async (key: string) => (store.has(key) ? 1 : 0)),
    ttl: vi.fn(async (key: string) => store.get(key)?.ttl ?? -2),
    incr: vi.fn(async (key: string) => {
      const current = Number(store.get(key)?.value ?? '0')
      const next = current + 1
      store.set(key, { value: String(next), ttl: store.get(key)?.ttl ?? -1 })
      return next
    }),
    expire: vi.fn(async (key: string, ttl: number) => {
      const entry = store.get(key)
      if (entry) store.set(key, { ...entry, ttl })
      return 1
    }),
    set: vi.fn(async (key: string, value: string, _ex: string, ttl: number) => {
      store.set(key, { value, ttl })
      return 'OK'
    }),
    del: vi.fn(async (...keys: string[]) => {
      let deleted = 0
      for (const k of keys) {
        if (store.delete(k)) deleted++
      }
      return deleted
    }),
  }
}

// ---------------------------------------------------------------------------
// Minimal Prisma mock — only the tables OtpService reads/writes.
// ---------------------------------------------------------------------------
function makePrismaMock() {
  return {
    otpRequest: {
      count: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  }
}

function makeConfigMock() {
  return {
    get: vi.fn().mockImplementation((key: string) => {
      if (key === 'REDIS_URL') return 'redis://localhost:6380/0'
      if (key === 'MSG91_ENABLED') return 'false'
      return undefined
    }),
  }
}

// Build OtpService with injected mocks, bypassing NestJS DI.
// We also patch the Redis constructor so it never opens a real connection.
function makeService(overrides?: {
  prisma?: ReturnType<typeof makePrismaMock>
  redis?: ReturnType<typeof makeRedisMock>
  config?: ReturnType<typeof makeConfigMock>
}) {
  const prisma = overrides?.prisma ?? makePrismaMock()
  const config = overrides?.config ?? makeConfigMock()
  const redis = overrides?.redis ?? makeRedisMock()

  const svc = new OtpService(
    prisma as unknown as import('../../database/prisma.service').PrismaService,
    config as unknown as import('@nestjs/config').ConfigService,
  )
  // Replace the real Redis client with our mock (created in constructor).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(svc as any).redis = redis

  return { svc, prisma, redis, config }
}

// ---------------------------------------------------------------------------
// issue() — per-phone OTP request rate limit
// ---------------------------------------------------------------------------

describe('OtpService.issue — per-phone request limit', () => {
  it('allows up to 2 unconsumed OTPs (below the 3-limit)', async () => {
    const prisma = makePrismaMock()
    prisma.otpRequest.count.mockResolvedValue(2)
    prisma.otpRequest.create.mockResolvedValue({})

    const { svc } = makeService({ prisma })
    await expect(svc.issue('+919876543210')).resolves.toHaveProperty('expiresIn')
  })

  it('throws HttpException when 3 unconsumed OTPs already exist', async () => {
    const prisma = makePrismaMock()
    prisma.otpRequest.count.mockResolvedValue(3)

    const { svc } = makeService({ prisma })
    await expect(svc.issue('+919876543210')).rejects.toThrow(HttpException)
  })

  it('includes devCode in the response when MSG91 is disabled (dev mode)', async () => {
    const prisma = makePrismaMock()
    prisma.otpRequest.count.mockResolvedValue(0)
    prisma.otpRequest.create.mockResolvedValue({})

    const { svc } = makeService({ prisma })
    const result = await svc.issue('+919876543210')
    expect(result).toHaveProperty('devCode')
    expect(typeof result.devCode).toBe('string')
    expect(result.devCode).toMatch(/^\d{6}$/)
  })
})

// ---------------------------------------------------------------------------
// assertNotLocked() — Redis-based lockout check
// ---------------------------------------------------------------------------

describe('OtpService.assertNotLocked', () => {
  it('does nothing when no lock key exists', async () => {
    const { svc } = makeService()
    await expect(svc.assertNotLocked('+919876543210')).resolves.toBeUndefined()
  })

  it('throws HttpException when lock key exists', async () => {
    const redis = makeRedisMock()
    // Simulate an active lockout key.
    redis._store.set('otp:lock:+919876543210', { value: '1', ttl: 1800 })

    const { svc } = makeService({ redis })
    await expect(svc.assertNotLocked('+919876543210')).rejects.toThrow(HttpException)
  })

  it('includes remaining minutes in the error message', async () => {
    const redis = makeRedisMock()
    redis._store.set('otp:lock:+919876543210', { value: '1', ttl: 1200 })

    const { svc } = makeService({ redis })
    await expect(svc.assertNotLocked('+919876543210')).rejects.toThrow('20 minutes')
  })
})

// ---------------------------------------------------------------------------
// recordFailure() — increments counter, triggers lockout at limit
// ---------------------------------------------------------------------------

describe('OtpService.recordFailure', () => {
  it('increments the fail counter for the phone', async () => {
    const redis = makeRedisMock()
    const { svc } = makeService({ redis })
    await svc.recordFailure('+919876543210')
    expect(redis.incr).toHaveBeenCalledWith('otp:fail:+919876543210')
  })

  it('sets TTL on first failure', async () => {
    const redis = makeRedisMock()
    const { svc } = makeService({ redis })
    await svc.recordFailure('+919876543210')
    // incr returns 1 on first call → expire should be set
    expect(redis.expire).toHaveBeenCalledWith('otp:fail:+919876543210', expect.any(Number))
  })

  it('does NOT set TTL on subsequent failures (counter already has TTL)', async () => {
    const redis = makeRedisMock()
    // Pre-seed the store so incr returns 2.
    redis._store.set('otp:fail:+919876543210', { value: '1', ttl: 540 })

    const { svc } = makeService({ redis })
    await svc.recordFailure('+919876543210')
    // incr returns 2 → expire should NOT be called
    expect(redis.expire).not.toHaveBeenCalled()
  })

  it('sets lock key and deletes fail counter when limit is reached', async () => {
    const redis = makeRedisMock()
    // Pre-seed so the 5th call triggers lockout.
    redis._store.set('otp:fail:+919876543210', { value: '4', ttl: 300 })

    const { svc } = makeService({ redis })
    await svc.recordFailure('+919876543210')

    expect(redis.set).toHaveBeenCalledWith(
      'otp:lock:+919876543210',
      '1',
      'EX',
      expect.any(Number),
    )
    expect(redis.del).toHaveBeenCalledWith('otp:fail:+919876543210')
  })
})

// ---------------------------------------------------------------------------
// clearFailures() — resets on successful verify
// ---------------------------------------------------------------------------

describe('OtpService.clearFailures', () => {
  it('deletes both fail and lock keys', async () => {
    const redis = makeRedisMock()
    redis._store.set('otp:fail:+919876543210', { value: '3', ttl: 300 })
    redis._store.set('otp:lock:+919876543210', { value: '1', ttl: 1800 })

    const { svc } = makeService({ redis })
    await svc.clearFailures('+919876543210')

    expect(redis.del).toHaveBeenCalledWith(
      'otp:fail:+919876543210',
      'otp:lock:+919876543210',
    )
    expect(redis._store.has('otp:fail:+919876543210')).toBe(false)
    expect(redis._store.has('otp:lock:+919876543210')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// verify() — integration of all checks
// ---------------------------------------------------------------------------

describe('OtpService.verify — locked phone', () => {
  it('throws HttpException before hitting the DB when phone is locked', async () => {
    const redis = makeRedisMock()
    redis._store.set('otp:lock:+919876543210', { value: '1', ttl: 1800 })
    const prisma = makePrismaMock()

    const { svc } = makeService({ redis, prisma })
    await expect(svc.verify('+919876543210', '123456')).rejects.toThrow(HttpException)
    // DB should never be queried.
    expect(prisma.otpRequest.findFirst).not.toHaveBeenCalled()
  })
})

describe('OtpService.verify — no pending OTP', () => {
  it('throws BadRequestException when no matching record found', async () => {
    const prisma = makePrismaMock()
    prisma.otpRequest.findFirst.mockResolvedValue(null)

    const { svc } = makeService({ prisma })
    await expect(svc.verify('+919876543210', '123456')).rejects.toThrow(BadRequestException)
  })
})

describe('OtpService.verify — wrong code', () => {
  it('records a failure and throws BadRequestException', async () => {
    const redis = makeRedisMock()
    const prisma = makePrismaMock()

    // Return a record with a bcrypt hash that won't match '000000'.
    // bcryptjs.compare will return false for any mismatched plaintext.
    prisma.otpRequest.findFirst.mockResolvedValue({
      id: 'otp-1',
      codeHash: '$2a$10$invalid-hash-that-wont-match',
      attempts: 0,
    })
    prisma.otpRequest.update.mockResolvedValue({})

    const { svc } = makeService({ redis, prisma })
    await expect(svc.verify('+919876543210', '000000')).rejects.toThrow(BadRequestException)
    expect(redis.incr).toHaveBeenCalledWith('otp:fail:+919876543210')
  })
})

describe('OtpService.verify — 5 wrong codes trigger lockout', () => {
  it('after 5 failures, the next verify returns HttpException', async () => {
    const redis = makeRedisMock()
    const prisma = makePrismaMock()

    // Simulate 4 existing failures — the 5th will trigger lockout.
    redis._store.set('otp:fail:+919876543210', { value: '4', ttl: 300 })
    // The lock check on the 5th call still passes (no lock key yet).

    prisma.otpRequest.findFirst.mockResolvedValue({
      id: 'otp-1',
      codeHash: '$2a$10$invalid-hash-that-wont-match',
      attempts: 0,
    })
    prisma.otpRequest.update.mockResolvedValue({})

    const { svc } = makeService({ redis, prisma })

    // 5th wrong code — sets the lock key.
    await expect(svc.verify('+919876543210', '000000')).rejects.toThrow(BadRequestException)
    // The lock key should now be set.
    expect(redis._store.has('otp:lock:+919876543210')).toBe(true)

    // 6th attempt: phone is now locked.
    await expect(svc.verify('+919876543210', '000000')).rejects.toThrow(HttpException)
  })
})
