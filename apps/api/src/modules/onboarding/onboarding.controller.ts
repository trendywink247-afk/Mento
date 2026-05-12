import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common'
import { CurrentUser, type JwtUser } from '../auth/decorators/current-user.decorator'
import { Public } from '../auth/decorators/public.decorator'
import { OnboardingService } from './onboarding.service'
import { MirrorSubmitDto } from './dto/mirror-submit.dto'
import { MentorOnboardingSubmitDto } from './dto/mentor-onboarding-submit.dto'
import { MentorVerificationDto } from './dto/mentor-verification.dto'
import { TrackEventDto } from './dto/track-event.dto'
import { RolePickDto } from './dto/role-pick.dto'

@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  // Public: pre-auth role pick tracking
  @Public()
  @Post('role')
  @HttpCode(204)
  async pickRole(@Body() body: RolePickDto): Promise<void> {
    await this.onboarding.trackEvent({
      sessionId: body.sessionId,
      step: `role_pick.${body.role}`,
      metadata: { role: body.role },
    })
  }

  // Public: every onboarding step transition. PostHog will eventually be source of truth.
  @Public()
  @Post('event')
  @HttpCode(204)
  async trackEvent(@Body() body: TrackEventDto): Promise<void> {
    await this.onboarding.trackEvent(body)
  }

  // Authenticated
  @Get('state')
  state(@CurrentUser() user: JwtUser) {
    return this.onboarding.getOnboardingState(user.sub)
  }

  @Post('mirror')
  @HttpCode(200)
  submitMirror(@CurrentUser() user: JwtUser, @Body() body: MirrorSubmitDto) {
    return this.onboarding.submitMirror(user.sub, body)
  }

  @Post('mentor')
  @HttpCode(200)
  submitMentor(@CurrentUser() user: JwtUser, @Body() body: MentorOnboardingSubmitDto) {
    return this.onboarding.submitMentorOnboarding(user.sub, body)
  }

  @Post('mentor/verification')
  @HttpCode(200)
  submitVerification(@CurrentUser() user: JwtUser, @Body() body: MentorVerificationDto) {
    return this.onboarding.submitVerification(user.sub, body)
  }
}
