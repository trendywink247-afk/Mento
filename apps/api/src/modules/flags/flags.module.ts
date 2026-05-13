import { Module } from '@nestjs/common'
import { FlagsService } from './flags.service'
import { FlagsPublicController, FlagsAdminController } from './flags.controller'

@Module({
  controllers: [FlagsPublicController, FlagsAdminController],
  providers: [FlagsService],
  exports: [FlagsService],
})
export class FlagsModule {}
