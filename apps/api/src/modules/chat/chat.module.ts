import { Module, forwardRef } from '@nestjs/common'
import { ChatController } from './chat.controller'
import { ChatService } from './chat.service'
import { ChatGateway } from './chat.gateway'
import { JournalsModule } from '../journals/journals.module'

@Module({
  imports: [forwardRef(() => JournalsModule)],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
  exports: [ChatService],
})
export class ChatModule {}
