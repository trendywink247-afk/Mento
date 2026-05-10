import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common'
import { CurrentUser, type JwtUser } from '../auth/decorators/current-user.decorator'
import { ChatService } from './chat.service'

@Controller()
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get('conversations')
  list(@CurrentUser() user: JwtUser) {
    return this.chat.listConversations(user.sub)
  }

  @Get('conversations/:id/messages')
  async messages(
    @CurrentUser() user: JwtUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    return this.chat.getMessages(id, user.sub, {
      limit: limit ? Number(limit) : undefined,
      before,
    })
  }
}
