import { Controller, Get } from '@nestjs/common'
import { Role } from '@prisma/client'
import { Roles } from '../auth/decorators/roles.decorator'
import { AnalyticsService } from './analytics.service'

@Roles(Role.ADMIN)
@Controller('admin/analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  /**
   * GET /admin/analytics/summary
   *
   * Returns the full founder-facing analytics payload in a single request.
   * Result is cached in Redis for 60 seconds (key: admin:analytics:summary).
   * All aggregates are counts — no PII is returned.
   *
   * Admin-only (403 for all other roles).
   */
  @Get('summary')
  summary() {
    return this.analytics.getSummary()
  }
}
