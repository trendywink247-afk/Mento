import { Body, Controller, HttpCode, Post } from '@nestjs/common'
import { SkipThrottle } from '@nestjs/throttler'
import { Public } from './decorators/public.decorator'
import { AuthService } from './auth.service'
import { OtpRequestDto } from './dto/otp-request.dto'
import { OtpVerifyDto } from './dto/otp-verify.dto'
import { RefreshDto } from './dto/refresh.dto'
import { GoogleSigninDto } from './dto/google-signin.dto'
import { PrismaService } from '../../database/prisma.service'

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * OTP request endpoint.
   *
   * Global ThrottlerGuard is SKIPPED here intentionally.
   * Reason: in production many legitimate users share a single egress IP
   * (campus Wi-Fi, corporate NAT) — a per-IP limit would lock out entire
   * buildings after a handful of requests.
   *
   * Abuse protection is enforced inside OtpService instead:
   *   - Per-phone: max 3 unconsumed OTPs per hour (Prisma DB counter).
   *   - Per-phone brute-force: 5 failed verify attempts in 10 min → 30 min lockout (Redis).
   */
  @SkipThrottle()
  @Public()
  @Post('otp/request')
  @HttpCode(200)
  async requestOtp(@Body() body: OtpRequestDto) {
    // Anonymity: do NOT echo the phone in the response. Dev-mode receivers
    // already know the phone from their own request; in prod the response
    // body should never carry it.
    const result = await this.auth.requestOtp(body.phone)
    return result
  }

  /**
   * OTP verify endpoint.
   *
   * Global ThrottlerGuard is SKIPPED — same shared-NAT reasoning as otp/request.
   * Brute-force protection is enforced per-phone inside OtpService:
   * 5 wrong codes in 10 minutes → 30-minute lockout → HTTP 429.
   */
  @SkipThrottle()
  @Public()
  @Post('otp/verify')
  @HttpCode(200)
  async verifyOtp(@Body() body: OtpVerifyDto) {
    const { user, tokens } = await this.auth.verifyOtp(body.phone, body.code, body.inviteCode)
    const profile = await this.prisma.profile.findUnique({ where: { userId: user.id } })
    return {
      user: {
        id: user.id,
        // Anonymity: phone, email, and googleSub are admin-only.
        // The frontend identifies the user by UUID; the display handle goes via profile.
        role: user.role,
        status: user.status,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
      profile: profile
        ? {
            userId: profile.userId,
            displayHandle: profile.displayHandle,
            avatarLetter: profile.avatarLetter,
            avatarColor: profile.avatarColor,
            hasPurpleTick: profile.hasPurpleTick,
            bio: profile.bio,
            city: profile.city,
            state: profile.state,
            language: profile.language,
          }
        : null,
      tokens,
    }
  }

  @Public()
  @Post('google')
  @HttpCode(200)
  async googleSignin(@Body() body: GoogleSigninDto) {
    const { user, tokens } = await this.auth.googleSignin(body.idToken, body.inviteCode)
    const profile = await this.prisma.profile.findUnique({ where: { userId: user.id } })
    return {
      user: {
        id: user.id,
        // phone and email are admin-only. NEVER expose googleSub.
        role: user.role,
        status: user.status,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
      profile: profile
        ? {
            userId: profile.userId,
            displayHandle: profile.displayHandle,
            avatarLetter: profile.avatarLetter,
            avatarColor: profile.avatarColor,
            hasPurpleTick: profile.hasPurpleTick,
            bio: profile.bio,
            city: profile.city,
            state: profile.state,
            language: profile.language,
          }
        : null,
      tokens,
    }
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() body: RefreshDto) {
    return this.auth.refresh(body.refreshToken)
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Body() body: RefreshDto): Promise<void> {
    await this.auth.logout(body.refreshToken)
  }
}
