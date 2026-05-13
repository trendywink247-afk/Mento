import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { Role, User, UserStatus } from '@prisma/client'
import { v4 as uuidv4 } from 'uuid'
import { createHmac } from 'crypto'
import { OAuth2Client } from 'google-auth-library'
import { PrismaService } from '../../database/prisma.service'
import { OtpService } from './otp.service'
import { InvitesService } from '../invites/invites.service'
import { colorForLetter, defaultLetterForRole, generateDisplayHandle } from '../../common/anonymity'

export interface IssueResult {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

@Injectable()
export class AuthService {
  private readonly accessTtlSec: number
  private readonly refreshTtlSec: number

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly otp: OtpService,
    private readonly config: ConfigService,
    private readonly invites: InvitesService,
  ) {
    this.accessTtlSec = parseTtl(this.config.get<string>('JWT_ACCESS_TTL') ?? '15m')
    this.refreshTtlSec = parseTtl(this.config.get<string>('JWT_REFRESH_TTL') ?? '30d')
  }

  requestOtp(phone: string) {
    return this.otp.issue(phone)
  }

  async googleSignin(
    idToken: string,
    inviteCode?: string,
  ): Promise<{ user: User; tokens: IssueResult }> {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID')
    if (!clientId) {
      throw new BadRequestException('Google OAuth is not configured on this server')
    }

    // Verify the ID token against our client ID — rejects tampered tokens.
    const client = new OAuth2Client(clientId)
    let googleSub: string
    let email: string | undefined
    let emailVerified: boolean
    try {
      const ticket = await client.verifyIdToken({ idToken, audience: clientId })
      const p = ticket.getPayload()
      if (!p) throw new Error('Empty payload')
      googleSub = p.sub
      email = p.email
      emailVerified = p.email_verified === true
    } catch {
      throw new UnauthorizedException('Invalid Google ID token')
    }

    if (!emailVerified) {
      throw new UnauthorizedException('Google account email is not verified — use phone OTP instead')
    }

    // Look up by googleSub first; email is not guaranteed to be stable across Google accounts.
    let user = await this.prisma.user.findUnique({ where: { googleSub } })
    const isNewUser = !user

    if (!user) {
      // Beta gate: new users require an invite code when BETA_INVITE_REQUIRED=true.
      this.assertInviteCodeProvided(inviteCode)

      // New user — create with Aspirant_NNNN handle.
      const letter = defaultLetterForRole(Role.ASPIRANT)
      user = await this.createUserWithProfile({
        googleSub,
        email: email ?? undefined,
        role: Role.ASPIRANT,
        letter,
      })

      // Redeem invite code. If redemption fails, clean up the newly-created user.
      if (inviteCode) {
        await this.redeemOrRollback(user.id, inviteCode)
      }
    } else if (user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException('Account suspended')
    } else if (user.status === UserStatus.BANNED) {
      throw new UnauthorizedException('Account banned')
    } else if (user.status === UserStatus.PENDING_VERIFICATION) {
      // Activate if somehow stuck in pending state.
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { status: UserStatus.ACTIVE },
      })
    }

    void isNewUser // used for invite logic above; suppress lint

    const tokens = await this.issueTokens(user)
    return { user, tokens }
  }

  async verifyOtp(
    phone: string,
    code: string,
    inviteCode?: string,
  ): Promise<{ user: User; tokens: IssueResult }> {
    await this.otp.verify(phone, code)

    let user = await this.prisma.user.findUnique({ where: { phone } })
    if (!user) {
      // Beta gate: new users require an invite code when BETA_INVITE_REQUIRED=true.
      this.assertInviteCodeProvided(inviteCode)

      const letter = defaultLetterForRole(Role.ASPIRANT)
      user = await this.createUserWithProfile({ phone, role: Role.ASPIRANT, letter })

      // Redeem invite code. If redemption fails, clean up the newly-created user.
      if (inviteCode) {
        await this.redeemOrRollback(user.id, inviteCode)
      }

      // Write signup OnboardingEvent for server-side funnel tracking (fire-and-forget).
      void this.prisma.onboardingEvent.create({
        data: { userId: user.id, step: 'signup', sessionId: 'server' },
      }).catch(() => {})
    } else if (user.status === UserStatus.PENDING_VERIFICATION) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { status: UserStatus.ACTIVE },
      })
    } else if (user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException('Account suspended')
    } else if (user.status === UserStatus.BANNED) {
      throw new UnauthorizedException('Account banned')
    }

    const tokens = await this.issueTokens(user)
    return { user, tokens }
  }

  /**
   * Throws ForbiddenException if BETA_INVITE_REQUIRED is true and no inviteCode provided.
   */
  private assertInviteCodeProvided(inviteCode?: string): void {
    const betaRequired = this.config.get<string>('BETA_INVITE_REQUIRED')
    if (betaRequired === 'true' && !inviteCode) {
      throw new ForbiddenException('Invite code required during beta')
    }
  }

  /**
   * Attempts to redeem the invite code for the given user.
   * If redemption throws, deletes the just-created user and re-throws.
   */
  private async redeemOrRollback(userId: string, code: string): Promise<void> {
    try {
      await this.invites.redeemForUser(userId, code)
    } catch (err) {
      // Roll back the newly created user so a failed/invalid invite doesn't ghost-create accounts.
      await this.prisma.user.delete({ where: { id: userId } }).catch(() => {
        // swallow — best-effort cleanup
      })
      throw err
    }
  }

  async refresh(refreshToken: string): Promise<IssueResult> {
    const decoded = await this.verifyRefresh(refreshToken)
    const tokenHash = this.hashRefreshToken(refreshToken)

    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } })
    if (!stored) {
      // Token completely unknown — tampered or pruned. Revoke the family as a safety net.
      await this.prisma.refreshToken.updateMany({
        where: { family: decoded.family, revokedAt: null },
        data: { revokedAt: new Date() },
      })
      throw new UnauthorizedException('Refresh token reuse detected')
    }
    if (stored.revokedAt) {
      // Replay of a previously-rotated token — classic theft signal.
      // Revoke the whole family so the attacker's freshly-issued token also stops working.
      await this.prisma.refreshToken.updateMany({
        where: { family: stored.family, revokedAt: null },
        data: { revokedAt: new Date() },
      })
      throw new UnauthorizedException('Refresh token reuse detected')
    }
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
      const tokenHash = this.hashRefreshToken(refreshToken)
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

    const tokenHash = this.hashRefreshToken(refreshToken)
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

  /**
   * Deterministic hash of a refresh token for DB lookup.
   * HMAC-SHA256 keyed by JWT_REFRESH_SECRET — same plaintext always hashes to the same digest,
   * unlike bcrypt. Refresh tokens are already high-entropy so a fast hash is correct here.
   */
  private hashRefreshToken(token: string): string {
    const key = this.config.get<string>('JWT_REFRESH_SECRET')
    if (!key) throw new Error('JWT_REFRESH_SECRET is not configured')
    return createHmac('sha256', key).update(token).digest('hex')
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

