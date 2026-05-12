import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { SubscriptionTier } from '@prisma/client'
import { SubscriptionsService } from '../subscriptions.service'
import { MIN_TIER_KEY } from './min-tier.decorator'
import type { JwtUser } from '../../auth/decorators/current-user.decorator'

/** Numeric rank for tier comparison. Higher = more access. */
const TIER_RANK: Record<SubscriptionTier, number> = {
  FREE: 0,
  BASIC: 1,
  PRO: 2,
  MAX: 3,
}

@Injectable()
export class TierGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly subs: SubscriptionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<SubscriptionTier | undefined>(
      MIN_TIER_KEY,
      [context.getHandler(), context.getClass()],
    )

    // No @MinTier decorator — pass through.
    if (!required) return true

    const req = context.switchToHttp().getRequest<{ user?: JwtUser }>()
    const user = req.user
    // If there's no user at this point the JWT guard already rejected — bail.
    if (!user) return false

    const currentTier = await this.subs.getTierForUser(user.sub)

    if (TIER_RANK[currentTier] >= TIER_RANK[required]) return true

    throw new HttpException(
      { requiredTier: required, currentTier },
      HttpStatus.PAYMENT_REQUIRED,
    )
  }
}
