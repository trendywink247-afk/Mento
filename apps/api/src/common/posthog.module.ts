import { Global, Module } from '@nestjs/common'
import { PostHogService } from './posthog.service'

/**
 * Global module — PostHogService is available everywhere without
 * explicitly importing PostHogModule in each feature module.
 */
@Global()
@Module({
  providers: [PostHogService],
  exports: [PostHogService],
})
export class PostHogModule {}
