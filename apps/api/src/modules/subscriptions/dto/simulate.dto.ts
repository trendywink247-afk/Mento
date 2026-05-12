import { IsEnum } from 'class-validator'
import { SubscriptionTier } from '@prisma/client'

export class SimulateDto {
  @IsEnum(['BASIC', 'PRO', 'MAX'], { message: 'tier must be BASIC, PRO, or MAX' })
  tier!: Exclude<SubscriptionTier, 'FREE'>
}
