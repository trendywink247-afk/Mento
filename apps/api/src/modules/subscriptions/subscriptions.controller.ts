import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common'
import type { Request } from 'express'
import { Public } from '../auth/decorators/public.decorator'
import { CurrentUser, type JwtUser } from '../auth/decorators/current-user.decorator'
import { SubscriptionsService } from './subscriptions.service'
import { CheckoutDto } from './dto/checkout.dto'
import { SimulateDto } from './dto/simulate.dto'

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subs: SubscriptionsService) {}

  @Get('me')
  getMe(@CurrentUser() user: JwtUser) {
    return this.subs.getMySubscription(user.sub)
  }

  @Post('checkout')
  checkout(@CurrentUser() user: JwtUser, @Body() body: CheckoutDto) {
    return this.subs.checkout(user.sub, body.tier)
  }

  @Post('cancel')
  cancel(@CurrentUser() user: JwtUser) {
    return this.subs.cancel(user.sub)
  }

  /** Razorpay webhook — public, but signature-verified inside service */
  @Public()
  @Post('webhook')
  webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-razorpay-signature') signature: string,
  ) {
    const raw = req.rawBody
    if (!raw) return { received: true }
    return this.subs.handleWebhook(raw, signature ?? '')
  }

  /**
   * Dev-only: instantly activate a tier for the calling user.
   * Two layers of protection so a misconfigured prod can't be exploited:
   *  1. Controller-layer NODE_ENV guard — refuses in production regardless
   *     of any other env state.
   *  2. Service-layer isDev() check — refuses unless RAZORPAY_KEY_ID is unset.
   */
  @Post('simulate-success')
  simulateSuccess(@CurrentUser() user: JwtUser, @Body() body: SimulateDto) {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('simulate-success is dev-only')
    }
    return this.subs.simulateSuccess(user.sub, body.tier)
  }
}
