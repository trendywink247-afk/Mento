import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { Role, User, UserStatus } from '@prisma/client'
import { hash, compare } from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import { Redis } from 'ioredis'
import { PrismaService } from '../../database/prisma.service'
import { OtpService } from './otp.service'
import { colorForLetter, defaultLetterForRole, generateDisplayHandle } from '../../common/anonymity'

export interface IssueResult {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

@Injectable()
export class AuthService {
  private readonly redis: Redis
  private readonly accessTtlSec: number
  private readonly refreshTtlSec: number

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly otp: OtpService,
    private readonly config: ConfigService,
  ) {
    this.redis = new Redis(this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6379/0')
    this.accessTtlSec = parseTtl(this.config.get<string>('JWT_ACCESS_TTL') ?? '15m')
    this.refreshTtlSec = parseTtl(this.config.get<string>('JWT_REFRESH_TTL') ?? '30d')
  }

  requestOtp(phone: string) {
    return this.otp.issue(phone)
  }

  async verifyOtp(phone: string, code: string): Promise<{ user: User; tokens: IssueResult }> {
    await this.otp.verify(phone, code)

    let user = await this.prisma.user.findUnique({ where: { phone } })
    if (!user) {
      const letter = defaultLetterForRole(Role.ASPIRANT)
      user = await this.createUserWithProfile({ phone, role: Role.ASPIRANT, letter })
    } else if (user.status === UserStatus.PENDING_VERIFICATION) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { status: UserStatus.ACTIVE },
      })
    } else if (user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException('Account suspended')
    }

    const tokens = await this.issueTokens(user)
    return { user, tokens }
  }

  async refresh(refreshToken: string): Promise<IssueResult> {
    const decoded = await this.verifyRefresh(refreshToken)
    const tokenHash = await hashRefreshToken(refreshToken)

    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } })
    if (!stored) {
      // Token reuse — revoke entire family.
      await this.prisma.refreshToken.updateMany({
        where: { family: decoded.family, revokedAt: null },
        data: { revokedAt: new Date() },
      })
      throw new UnauthorizedException('Refresh token reuse detected')
    }
    if (stored.revokedAt) throw new UnauthorizedException('Refresh token revoked')
    if (stored.expiresAt < new Date()) throw new UnauthorizedException('Refresh token expired')

    const user = await this.prisma.user.findUnique({ where: { id: stored.userId } })
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('User not active')
    }

    // Rotate: revoke current, mint new in same family.
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    })
    return this.issueTokens(user, stored.family)
  }

  async logout(refreshToken: string): Promise<void> {
    try {
      const tokenHash = await hashRefreshToken(refreshToken)
      const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } })
      if (stored && !stored.revokedAt) {
        await this.prisma.refreshToken.update({
          where: { id: stored.id },
          data: { revokedAt: new Date() },
        })
      }
    } catch {
      // swallow — logout is idempotent
    }
  }

  private async issueTokens(user: User, family?: string): Promise<IssueResult> {
    const jti = uuidv4()
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, role: user.role, jti },
      { secret: this.config.get<string>('JWT_ACCESS_SECRET'), expiresIn: this.accessTtlSec },
    )

    const refreshFamily = family ?? uuidv4()
    const refreshPlain = uuidv4() + '.' + uuidv4().replace(/-/g, '')
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, family: refreshFamily, t: refreshPlain },
      {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.refreshTtlSec,
      },
    )

    const tokenHash = await hashRefreshToken(refreshToken)
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        family: refreshFamily,
        expiresAt: new Date(Date.now() + this.refreshTtlSec * 1000),
      },
    })

    return { accessToken, refreshToken, expiresIn: this.accessTtlSec }
  }

  // Unique-handle insert with retry on conflict.
  private async createUserWithProfile(args: {
    phone?: string
    email?: string
    googleSub?: string
    role: Role
    letter: ReturnType<typeof defaultLetterForRole>
  }): Promise<User> {
    const color = colorForLetter(args.letter)
    for (let attempt = 0; attempt < 5; attempt++) {
      const displayHandle = generateDisplayHandle(args.letter)
      try {
        return await this.prisma.user.create({
          data: {
            phone: args.phone,
            email: args.email,
            googleSub: args.googleSub,
            role: args.role,
            status: UserStatus.ACTIVE,
            profile: {
              create: { displayHandle, avatarLetter: args.letter, avatarColor: color },
            },
          },
        })
      } catch (err) {
        // Retry on unique-constraint conflict on displayHandle
        if (
          err &&
          typeof err === 'object' &&
          'code' in err &&
          (err as { code?: string }).code === 'P2002'
        ) {
          continue
        }
        throw err
      }
    }
    throw new Error('Could not allocate a unique display handle after 5 attempts')
  }

  private async verifyRefresh(token: string): Promise<{ sub: string; family: string }> {
    try {
      return await this.jwt.verifyAsync(token, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      })
    } catch {
      throw new UnauthorizedException('Invalid refresh token')
    }
  }
}

function parseTtl(input: string): number {
  const m = /^(\d+)([smhd])$/.exec(input.trim())
  if (!m) return Number(input) || 900
  const n = Number(m[1])
  switch (m[2]) {
    case 's':
      return n
    case 'm':
      return n * 60
    case 'h':
      return n * 3600
    case 'd':
      return n * 86400
    default:
      return 900
  }
}

async function hashRefreshToken(token: string): Promise<string> {
  // Refresh tokens are short — bcrypt cost 8 is fine and faster on hot path.
  return hash(token, 8)
}

// re-export to silence unused import lint when bcrypt.compare is added later
void compare
