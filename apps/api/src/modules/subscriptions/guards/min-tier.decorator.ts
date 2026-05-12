import { SetMetadata } from '@nestjs/common'
import { SubscriptionTier } from '@prisma/client'

export const MIN_TIER_KEY = 'minTier'

/**
 * Restrict a route to users whose active subscription is at or above the given tier.
 * Respond 402 with { requiredTier, currentTier } if the user is below.
 *
 * Tier order: FREE < BASIC < PRO < MAX
 */
export const MinTier = (tier: SubscriptionTier) => SetMetadata(MIN_TIER_KEY, tier)
