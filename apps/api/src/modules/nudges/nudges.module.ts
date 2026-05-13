import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
import { NudgesService } from './nudges.service'
import { NudgesAdminController } from './nudges-admin.controller'

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [NudgesAdminController],
  providers: [NudgesService],
  exports: [NudgesService],
})
export class NudgesModule {}
