import { Body, Controller, HttpCode, Post } from '@nestjs/common'
import { Public } from './decorators/public.decorator'
import { AuthService } from './auth.service'
import { OtpRequestDto } from './dto/otp-request.dto'
import { OtpVerifyDto } from './dto/otp-verify.dto'
import { RefreshDto } from './dto/refresh.dto'
import { PrismaService } from '../../database/prisma.service'

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Post('otp/request')
  @HttpCode(200)
  async requestOtp(@Body() body: OtpRequestDto) {
    const result = await this.auth.requestOtp(body.phone)
    return { phone: body.phone, ...result }
  }

  @Public()
  @Post('otp/verify')
  @HttpCode(200)
  async verifyOtp(@Body() body: OtpVerifyDto) {
    const { user, tokens } = await this.auth.verifyOtp(body.phone, body.code)
    const profile = await this.prisma.profile.findUnique({ where: { userId: user.id } })
    return {
      user: {
        id: user.id,
        phone: user.phone,
        email: user.email,
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
