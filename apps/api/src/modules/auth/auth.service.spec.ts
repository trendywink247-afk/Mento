import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UnauthorizedException } from '@nestjs/common'
import { UserStatus } from '@prisma/client'
import { AuthService } from './auth.service'

// ---------------------------------------------------------------------------
// We test the `refresh` method which is the theft-detection surface.
// The method calls: verifyRefresh (private, wraps jwt.verifyAsync),
// hashRefreshToken (private, uses HMAC), prisma.refreshToken.findUnique,
// then conditionally prisma.refreshToken.updateMany / update, and
// prisma.user.findUnique.
//
// Strategy:
// - Mock jwt.verifyAsync to return a decoded payload or throw.
// - Mock prisma with vi.fn().
// - Mock config to return stable secrets.
// ---------------------------------------------------------------------------

const REFRESH_SECRET = 'test-refresh-secret'
const ACCESS_SECRET = 'test-access-secret'

function makeConfigMock() {
  return {
    get: vi.fn().mockImplementation((key: string) => {
      switch (key) {
        case 'JWT_REFRESH_SECRET': return REFRESH_SECRET
        case 'JWT_ACCESS_SECRET': return ACCESS_SECRET
        case 'JWT_ACCESS_TTL': return '15m'
        case 'JWT_REFRESH_TTL': return '30d'
        case 'REDIS_URL': return 'redis://localhost:6380/0'
        default: return undefined
      }
    }),
  }
}

function makePrismaMock() {
  return {
    refreshToken: {
      findUnique: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockResolvedValue({}),
    },
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    onboardingEvent: {
      create: vi.fn().mockResolvedValue({}),
    },
  }
}

function makeJwtMock() {
  return {
    verifyAsync: vi.fn(),
    signAsync: vi.fn().mockResolvedValue('mocked-access-token'),
  }
}

function makeOtpMock() {
  return {
    issue: vi.fn(),
    verify: vi.fn(),
  }
}

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

// Build a real AuthService with mocked collaborators.
// We cannot use NestJS DI here — call the constructor directly.
function makeService(overrides?: {
  prisma?: ReturnType<typeof makePrismaMock>
  jwt?: ReturnType<typeof makeJwtMock>
  config?: ReturnType<typeof makeConfigMock>
}) {
  const prisma = overrides?.prisma ?? makePrismaMock()
  const jwt = overrides?.jwt ?? makeJwtMock()
  const otp = makeOtpMock()
  const config = overrides?.config ?? makeConfigMock()
  const invites = { redeemForUser: vi.fn().mockResolvedValue({}) }
  const metrics = makeMetricsMock()

  // AuthService constructor creates a Redis client.
  // We must mock the Redis constructor before importing.
  // The service is already imported so we patch it via the module system.
  // Instead, we pass the config mock so Redis URL resolves to a non-live address;
  // since we never test issueTokens in these tests the Redis client stays idle.

  const svc = new AuthService(
    prisma as unknown as import('../../database/prisma.service').PrismaService,
    jwt as unknown as import('@nestjs/jwt').JwtService,
    otp as unknown as import('./otp.service').OtpService,
    config as unknown as import('@nestjs/config').ConfigService,
    invites as unknown as import('../invites/invites.service').InvitesService,
    metrics as unknown as import('../metrics/metrics.service').MetricsService,
  )

  return { svc, prisma, jwt, config }
}

// ---------------------------------------------------------------------------
// We need to compute the HMAC hash the same way the service does, so we can
// store it in the DB fixture. Reproduce the private hashRefreshToken logic.
// ---------------------------------------------------------------------------

import { createHmac } from 'crypto'

function hashToken(token: string): string {
  return createHmac('sha256', REFRESH_SECRET).update(token).digest('hex')
}

// ---------------------------------------------------------------------------
// refresh — token hash not in DB (unknown token)
// ---------------------------------------------------------------------------

describe('AuthService.refresh — unknown tokenHash', () => {
  it('throws UnauthorizedException and revokes the token family', async () => {
    const jwt = makeJwtMock()
    const prisma = makePrismaMock()

    // verifyAsync returns a valid payload (token signature OK but hash unknown in DB)
    jwt.verifyAsync.mockResolvedValue({ sub: 'user-1', family: 'family-abc' })
    // findUnique returns null — hash not stored
    prisma.refreshToken.findUnique.mockResolvedValue(null)

    const { svc } = makeService({ jwt, prisma })

    await expect(svc.refresh('some-unknown-token')).rejects.toThrow(UnauthorizedException)

    // Family revocation must have been attempted
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ family: 'family-abc', revokedAt: null }),
        data: expect.objectContaining({ revokedAt: expect.any(Date) }),
      }),
    )
  })
})

// ---------------------------------------------------------------------------
// refresh — replayed (already-revoked) token
// ---------------------------------------------------------------------------

describe('AuthService.refresh — replay of revoked token', () => {
  it('throws UnauthorizedException and revokes remaining family tokens', async () => {
    const jwt = makeJwtMock()
    const prisma = makePrismaMock()

    const revokedToken = 'already-revoked-token'
    const tokenHash = hashToken(revokedToken)

    jwt.verifyAsync.mockResolvedValue({ sub: 'user-1', family: 'family-xyz' })
    // findUnique returns a row that is already revoked
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-1',
      tokenHash,
      family: 'family-xyz',
      userId: 'user-1',
      revokedAt: new Date('2025-01-01T00:00:00Z'), // already revoked
      expiresAt: new Date(Date.now() + 86400000),
    })

    const { svc } = makeService({ jwt, prisma })

    await expect(svc.refresh(revokedToken)).rejects.toThrow(UnauthorizedException)

    // Should revoke the rest of the family (where revokedAt: null)
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ family: 'family-xyz', revokedAt: null }),
        data: expect.objectContaining({ revokedAt: expect.any(Date) }),
      }),
    )
  })
})

// ---------------------------------------------------------------------------
// refresh — expired token (past expiresAt)
// ---------------------------------------------------------------------------

describe('AuthService.refresh — expired token', () => {
  it('throws UnauthorizedException', async () => {
    const jwt = makeJwtMock()
    const prisma = makePrismaMock()

    const expiredToken = 'expired-token'
    const tokenHash = hashToken(expiredToken)

    jwt.verifyAsync.mockResolvedValue({ sub: 'user-1', family: 'family-exp' })
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-2',
      tokenHash,
      family: 'family-exp',
      userId: 'user-1',
      revokedAt: null, // not revoked
      expiresAt: new Date('2024-01-01T00:00:00Z'), // in the past
    })

    const { svc } = makeService({ jwt, prisma })

    await expect(svc.refresh(expiredToken)).rejects.toThrow(UnauthorizedException)
  })

  it('error message indicates expiry', async () => {
    const jwt = makeJwtMock()
    const prisma = makePrismaMock()
    const expiredToken = 'expired-token-2'
    const tokenHash = hashToken(expiredToken)

    jwt.verifyAsync.mockResolvedValue({ sub: 'user-1', family: 'family-exp2' })
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-3',
      tokenHash,
      family: 'family-exp2',
      userId: 'user-1',
      revokedAt: null,
      expiresAt: new Date('2024-01-01T00:00:00Z'),
    })

    const { svc } = makeService({ jwt, prisma })

    await expect(svc.refresh(expiredToken)).rejects.toThrow('Refresh token expired')
  })
})

// ---------------------------------------------------------------------------
// refresh — invalid JWT signature (verifyAsync throws)
// ---------------------------------------------------------------------------

describe('AuthService.refresh — invalid JWT signature', () => {
  it('throws UnauthorizedException when jwt.verifyAsync rejects', async () => {
    const jwt = makeJwtMock()
    const prisma = makePrismaMock()

    jwt.verifyAsync.mockRejectedValue(new Error('invalid signature'))

    const { svc } = makeService({ jwt, prisma })

    await expect(svc.refresh('tampered-token')).rejects.toThrow(UnauthorizedException)
  })
})

// ---------------------------------------------------------------------------
// refresh — suspended / banned user (status !== ACTIVE)
// ---------------------------------------------------------------------------

describe('AuthService.refresh — inactive user', () => {
  it('throws UnauthorizedException when user.status = SUSPENDED', async () => {
    const jwt = makeJwtMock()
    const prisma = makePrismaMock()

    const token = 'valid-token-suspended-user'
    const tokenHash = hashToken(token)

    jwt.verifyAsync.mockResolvedValue({ sub: 'user-suspended', family: 'family-sus' })
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-susp',
      tokenHash,
      family: 'family-sus',
      userId: 'user-suspended',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 86400000),
    })
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-suspended',
      status: UserStatus.SUSPENDED,
    })

    const { svc } = makeService({ jwt, prisma })

    await expect(svc.refresh(token)).rejects.toThrow(UnauthorizedException)
  })

  it('throws UnauthorizedException when user.status = BANNED', async () => {
    const jwt = makeJwtMock()
    const prisma = makePrismaMock()

    const token = 'valid-token-banned-user'
    const tokenHash = hashToken(token)

    jwt.verifyAsync.mockResolvedValue({ sub: 'user-banned', family: 'family-ban' })
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-ban',
      tokenHash,
      family: 'family-ban',
      userId: 'user-banned',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 86400000),
    })
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-banned',
      status: UserStatus.BANNED,
    })

    const { svc } = makeService({ jwt, prisma })

    await expect(svc.refresh(token)).rejects.toThrow(UnauthorizedException)
  })

  it('throws UnauthorizedException when user row is missing (null)', async () => {
    const jwt = makeJwtMock()
    const prisma = makePrismaMock()

    const token = 'valid-token-missing-user'
    const tokenHash = hashToken(token)

    jwt.verifyAsync.mockResolvedValue({ sub: 'user-gone', family: 'family-gone' })
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-gone',
      tokenHash,
      family: 'family-gone',
      userId: 'user-gone',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 86400000),
    })
    prisma.user.findUnique.mockResolvedValue(null)

    const { svc } = makeService({ jwt, prisma })

    await expect(svc.refresh(token)).rejects.toThrow(UnauthorizedException)
  })
})

// ---------------------------------------------------------------------------
// refresh — happy path: active user, valid non-revoked token
// ---------------------------------------------------------------------------

describe('AuthService.refresh — happy path', () => {
  it('returns accessToken and refreshToken on success', async () => {
    const jwt = makeJwtMock()
    const prisma = makePrismaMock()

    const token = 'good-refresh-token'
    const tokenHash = hashToken(token)

    jwt.verifyAsync.mockResolvedValue({ sub: 'user-active', family: 'family-good' })
    jwt.signAsync.mockResolvedValue('new-access-token')
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-good',
      tokenHash,
      family: 'family-good',
      userId: 'user-active',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 86400000),
    })
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-active',
      role: 'ASPIRANT',
      status: UserStatus.ACTIVE,
    })
    prisma.refreshToken.update.mockResolvedValue({})
    prisma.refreshToken.create.mockResolvedValue({})

    const { svc } = makeService({ jwt, prisma })

    const result = await svc.refresh(token)

    expect(result).toHaveProperty('accessToken')
    expect(result).toHaveProperty('refreshToken')
    expect(result).toHaveProperty('expiresIn')
    expect(typeof result.expiresIn).toBe('number')
  })

  it('revokes the old token on rotation', async () => {
    const jwt = makeJwtMock()
    const prisma = makePrismaMock()

    const token = 'good-rotation-token'
    const tokenHash = hashToken(token)

    jwt.verifyAsync.mockResolvedValue({ sub: 'user-active', family: 'family-rotate' })
    jwt.signAsync.mockResolvedValue('new-access-token')
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-rotate',
      tokenHash,
      family: 'family-rotate',
      userId: 'user-active',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 86400000),
    })
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-active',
      role: 'ASPIRANT',
      status: UserStatus.ACTIVE,
    })
    prisma.refreshToken.update.mockResolvedValue({})
    prisma.refreshToken.create.mockResolvedValue({})

    const { svc } = makeService({ jwt, prisma })

    await svc.refresh(token)

    // The old token should have been revoked via update
    expect(prisma.refreshToken.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'rt-rotate' },
        data: expect.objectContaining({ revokedAt: expect.any(Date) }),
      }),
    )
  })
})

// ---------------------------------------------------------------------------
// logout — idempotent token revocation
// ---------------------------------------------------------------------------

describe('AuthService.logout', () => {
  it('revokes a valid active token', async () => {
    const jwt = makeJwtMock()
    const prisma = makePrismaMock()

    const token = 'logout-token'
    const tokenHash = hashToken(token)

    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-logout',
      tokenHash,
      family: 'fam-logout',
      userId: 'user-1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 86400000),
    })
    prisma.refreshToken.update.mockResolvedValue({})

    const { svc } = makeService({ jwt, prisma })
    await svc.logout(token)

    expect(prisma.refreshToken.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'rt-logout' },
        data: expect.objectContaining({ revokedAt: expect.any(Date) }),
      }),
    )
  })

  it('is a no-op when token is already revoked', async () => {
    const jwt = makeJwtMock()
    const prisma = makePrismaMock()

    const token = 'already-revoked-logout'
    const tokenHash = hashToken(token)

    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-already-revoked',
      tokenHash,
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
    })

    const { svc } = makeService({ jwt, prisma })
    // Should not throw
    await expect(svc.logout(token)).resolves.toBeUndefined()
    expect(prisma.refreshToken.update).not.toHaveBeenCalled()
  })

  it('is a no-op when token is not found in DB', async () => {
    const jwt = makeJwtMock()
    const prisma = makePrismaMock()

    prisma.refreshToken.findUnique.mockResolvedValue(null)

    const { svc } = makeService({ jwt, prisma })
    await expect(svc.logout('unknown-token')).resolves.toBeUndefined()
    expect(prisma.refreshToken.update).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// requestOtp — delegates to OtpService
// ---------------------------------------------------------------------------

describe('AuthService.requestOtp', () => {
  it('calls otp.issue with the phone number', async () => {
    const otp = makeOtpMock()
    otp.issue.mockResolvedValue({ devCode: '123456' })
    const prisma = makePrismaMock()
    const jwt = makeJwtMock()
    const config = makeConfigMock()
    const invites = { redeemForUser: vi.fn().mockResolvedValue({}) }
    const metrics = makeMetricsMock()

    const svc = new AuthService(
      prisma as unknown as import('../../database/prisma.service').PrismaService,
      jwt as unknown as import('@nestjs/jwt').JwtService,
      otp as unknown as import('./otp.service').OtpService,
      config as unknown as import('@nestjs/config').ConfigService,
      invites as unknown as import('../invites/invites.service').InvitesService,
      metrics as unknown as import('../metrics/metrics.service').MetricsService,
    )

    await svc.requestOtp('+919876543210')
    expect(otp.issue).toHaveBeenCalledWith('+919876543210')
  })
})

// ---------------------------------------------------------------------------
// verifyOtp — new user creation + status edge cases
// ---------------------------------------------------------------------------

describe('AuthService.verifyOtp', () => {
  function makeVerifySetup(userRow: Record<string, unknown> | null) {
    const otp = makeOtpMock()
    otp.verify.mockResolvedValue(undefined)
    const prisma = makePrismaMock()
    prisma.user.findUnique.mockResolvedValue(userRow)
    if (userRow === null) {
      // New user creation path
      prisma.user.create.mockResolvedValue({
        id: 'new-user-id',
        role: 'ASPIRANT',
        status: UserStatus.ACTIVE,
        phone: '+910000000000',
        email: null,
        googleSub: null,
      })
    }
    const jwt = makeJwtMock()
    jwt.signAsync.mockResolvedValue('signed-token')
    const config = makeConfigMock()
    const invites = { redeemForUser: vi.fn().mockResolvedValue({}) }
    const metrics = makeMetricsMock()
    const svc = new AuthService(
      prisma as unknown as import('../../database/prisma.service').PrismaService,
      jwt as unknown as import('@nestjs/jwt').JwtService,
      otp as unknown as import('./otp.service').OtpService,
      config as unknown as import('@nestjs/config').ConfigService,
      invites as unknown as import('../invites/invites.service').InvitesService,
      metrics as unknown as import('../metrics/metrics.service').MetricsService,
    )
    return { svc, otp, prisma, jwt }
  }

  it('creates a new user when phone not found', async () => {
    const { svc, prisma } = makeVerifySetup(null)
    const result = await svc.verifyOtp('+910000000000', '123456')
    expect(result).toHaveProperty('tokens')
    expect(prisma.user.create).toHaveBeenCalled()
  })

  it('throws UnauthorizedException for SUSPENDED user', async () => {
    const { svc } = makeVerifySetup({
      id: 'user-sus',
      status: UserStatus.SUSPENDED,
      phone: '+910000000001',
      role: 'ASPIRANT',
    })
    await expect(svc.verifyOtp('+910000000001', '123456')).rejects.toThrow(UnauthorizedException)
  })

  it('throws UnauthorizedException for BANNED user', async () => {
    const { svc } = makeVerifySetup({
      id: 'user-ban',
      status: UserStatus.BANNED,
      phone: '+910000000002',
      role: 'ASPIRANT',
    })
    await expect(svc.verifyOtp('+910000000002', '123456')).rejects.toThrow(UnauthorizedException)
  })

  it('returns tokens for ACTIVE user', async () => {
    const { svc } = makeVerifySetup({
      id: 'user-active',
      status: UserStatus.ACTIVE,
      phone: '+910000000003',
      role: 'ASPIRANT',
    })
    const result = await svc.verifyOtp('+910000000003', '123456')
    expect(result).toHaveProperty('tokens')
    expect(result).toHaveProperty('user')
  })

  it('activates PENDING_VERIFICATION user on OTP verify', async () => {
    const otp = makeOtpMock()
    otp.verify.mockResolvedValue(undefined)
    const prisma = makePrismaMock()
    const pendingUser = {
      id: 'user-pending',
      status: UserStatus.PENDING_VERIFICATION,
      phone: '+910000000004',
      role: 'ASPIRANT',
    }
    prisma.user.findUnique.mockResolvedValue(pendingUser)
    prisma.user.update.mockResolvedValue({ ...pendingUser, status: UserStatus.ACTIVE })
    const jwt = makeJwtMock()
    jwt.signAsync.mockResolvedValue('signed')
    const config = makeConfigMock()
    const invites2 = { redeemForUser: vi.fn().mockResolvedValue({}) }
    const metrics2 = makeMetricsMock()
    const svc = new AuthService(
      prisma as unknown as import('../../database/prisma.service').PrismaService,
      jwt as unknown as import('@nestjs/jwt').JwtService,
      otp as unknown as import('./otp.service').OtpService,
      config as unknown as import('@nestjs/config').ConfigService,
      invites2 as unknown as import('../invites/invites.service').InvitesService,
      metrics2 as unknown as import('../metrics/metrics.service').MetricsService,
    )
    const result = await svc.verifyOtp('+910000000004', '123456')
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: UserStatus.ACTIVE }),
      }),
    )
    expect(result).toHaveProperty('tokens')
  })
})
