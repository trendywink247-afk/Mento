import { Module } from '@nestjs/common'
import { AdminController } from './admin.controller'
import { AdminService } from './admin.service'
import { StorageModule } from '../storage/storage.module'
import { MentorsModule } from '../mentors/mentors.module'

@Module({
  imports: [StorageModule, MentorsModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
