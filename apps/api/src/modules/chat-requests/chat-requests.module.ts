import { Module } from '@nestjs/common'
import { ChatRequestsController } from './chat-requests.controller'
import { ChatRequestsService } from './chat-requests.service'

@Module({
  controllers: [ChatRequestsController],
  providers: [ChatRequestsService],
  exports: [ChatRequestsService],
})
export class ChatRequestsModule {}
