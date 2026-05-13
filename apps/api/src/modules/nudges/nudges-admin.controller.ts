import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common'
import { IsIn } from 'class-validator'
import { Role } from '@prisma/client'
import { Roles } from '../auth/decorators/roles.decorator'
import { NudgesService, NudgeType } from './nudges.service'

class TriggerNudgeDto {
  @IsIn(['mirror', 'mentor'])
  type!: NudgeType
}

@Roles(Role.ADMIN)
@Controller('admin/nudges')
export class NudgesAdminController {
  constructor(private readonly nudges: NudgesService) {}

  /**
   * Manually fire a nudge cron. Useful for testing and emergency nudging.
   * Respects the same 7-day per-user dedupe as the scheduled cron.
   *
   * POST /admin/nudges/trigger
   * Body: { "type": "mirror" | "mentor" }
   * Returns: { "count": N }
   */
  @Post('trigger')
  @HttpCode(HttpStatus.OK)
  trigger(@Body() body: TriggerNudgeDto): Promise<{ count: number }> {
    return this.nudges.triggerNudges(body.type)
  }
}
