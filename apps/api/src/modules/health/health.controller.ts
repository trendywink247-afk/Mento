import { Controller, Get } from '@nestjs/common'
import { Public } from '../auth/decorators/public.decorator'

@Controller()
export class HealthController {
  private readonly bootedAt = Date.now()

  @Public()
  @Get('healthz')
  health(): { status: 'ok'; uptime: number } {
    return { status: 'ok', uptime: Math.floor((Date.now() - this.bootedAt) / 1000) }
  }

  @Public()
  @Get('readyz')
  ready(): { status: 'ok' } {
    return { status: 'ok' }
  }
}
