import { Controller, Get } from '@nestjs/common'

@Controller()
export class HealthController {
  private readonly bootedAt = Date.now()

  @Get('healthz')
  health(): { status: 'ok'; uptime: number } {
    return { status: 'ok', uptime: Math.floor((Date.now() - this.bootedAt) / 1000) }
  }

  @Get('readyz')
  ready(): { status: 'ok' } {
    // Phase 1+: also probe Prisma + Redis here.
    return { status: 'ok' }
  }
}
