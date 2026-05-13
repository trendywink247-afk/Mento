import { Controller, Get, Header, Res } from '@nestjs/common'
import { Response } from 'express'
import { Public } from '../auth/decorators/public.decorator'
import { MetricsService } from './metrics.service'

/**
 * Exposes Prometheus metrics at GET /metrics.
 *
 * This endpoint is intentionally public (no auth) so the Prometheus scraper
 * can reach it. The Caddyfile MUST block this path from the public internet —
 * only the internal docker network (prometheus → api:4000/metrics) should
 * ever reach here.
 */
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Public()
  @Get()
  @Header('Cache-Control', 'no-cache, no-store, must-revalidate')
  async getMetrics(@Res() res: Response): Promise<void> {
    const contentType = this.metrics.register.contentType
    const data = await this.metrics.register.metrics()
    res.setHeader('Content-Type', contentType)
    res.end(data)
  }
}
