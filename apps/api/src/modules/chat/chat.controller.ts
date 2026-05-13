import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common'
import { CurrentUser, type JwtUser } from '../auth/decorators/current-user.decorator'
import { ChatService } from './chat.service'

class ReportMessageDto {
  reason!: string
  details?: string
}

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

  @Patch('conversations/:id/archive')
  archiveConversation(
    @CurrentUser() user: JwtUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.chat.archiveConversation(id, user.sub)
  }

  @Post('chat/messages/:messageId/report')
  reportMessage(
    @CurrentUser() user: JwtUser,
    @Param('messageId', new ParseUUIDPipe()) messageId: string,
    @Body() body: ReportMessageDto,
  ) {
    return this.chat.reportMessage(messageId, user.sub, body.reason, body.details)
  }
}
