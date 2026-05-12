import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { SubscriptionsController } from './subscriptions.controller'
import { SubscriptionsService } from './subscriptions.service'
import { TierGuard } from './guards/tier.guard'

@Module({
  controllers: [SubscriptionsController],
  providers: [
    SubscriptionsService,
    // Register TierGuard globally so @MinTier works on any controller.
    { provide: APP_GUARD, useClass: TierGuard },
  ],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
