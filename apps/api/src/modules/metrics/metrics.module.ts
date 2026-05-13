import { Global, Module } from '@nestjs/common'
import { MetricsController } from './metrics.controller'
import { MetricsService } from './metrics.service'

/**
 * MetricsModule — global so MetricsService can be injected anywhere
 * without importing the module explicitly in every feature module.
 */
@Global()
@Module({
  controllers: [MetricsController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}
