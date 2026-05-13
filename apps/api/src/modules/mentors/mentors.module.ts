import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { MentorsController } from './mentors.controller'
import { MentorsService } from './mentors.service'

@Module({
  imports: [ConfigModule],
  controllers: [MentorsController],
  providers: [MentorsService],
  exports: [MentorsService],
})
export class MentorsModule {}
