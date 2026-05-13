import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common'
import { Role } from '@prisma/client'
import { CurrentUser, type JwtUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { PrismaService } from '../../database/prisma.service'
import { ChatRequestsService } from './chat-requests.service'
import { CreateChatRequestDto } from './dto/create-chat-request.dto'

@Controller('chat-requests')
export class ChatRequestsController {
  constructor(
    private readonly requests: ChatRequestsService,
    private readonly prisma: PrismaService,
  ) {}

  @Roles(Role.ASPIRANT)
  @Post()
  create(@CurrentUser() user: JwtUser, @Body() body: CreateChatRequestDto) {
    return this.requests.create(user.sub, body.mentorId, body.intro)
  }

  @Roles(Role.MENTOR, Role.ASPIRANT)
  @Get()
  async list(@CurrentUser() user: JwtUser) {
    const dbUser = await this.prisma.user.findUnique({ where: { id: user.sub } })
    if (!dbUser) return []
    return this.requests.listForUser(user.sub, dbUser.role)
  }

  @Roles(Role.MENTOR)
  @Patch(':id/accept')
  accept(@CurrentUser() user: JwtUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.requests.accept(id, user.sub)
  }

  @Roles(Role.MENTOR)
  @Patch(':id/decline')
  decline(@CurrentUser() user: JwtUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.requests.decline(id, user.sub)
  }

  @Patch(':id/archive')
  archive(@CurrentUser() user: JwtUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.requests.archive(id, user.sub)
  }
}
