import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common'
import { Role } from '@prisma/client'
import { CurrentUser, type JwtUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { PrismaService } from '../../database/prisma.service'
import { SessionsService } from './sessions.service'
import { CreateSessionRequestDto } from './dto/create-session-request.dto'
import { RespondSessionRequestDto } from './dto/respond-session-request.dto'
import { SetAvailabilityDto } from './dto/set-availability.dto'

@Controller()
export class SessionsController {
  constructor(
    private readonly sessions: SessionsService,
    private readonly prisma: PrismaService,
  ) {}

  // ─── Availability ──────────────────────────────────────────────────────

  @Get('sessions/availability/:mentorId')
  getAvailability(@Param('mentorId', new ParseUUIDPipe()) mentorId: string) {
    return this.sessions.getMentorAvailability(mentorId)
  }

  @Roles(Role.MENTOR)
  @Patch('me/mentor/availability')
  setAvailability(@CurrentUser() user: JwtUser, @Body() body: SetAvailabilityDto) {
    return this.sessions.setAvailability(user.sub, body.availability)
  }

  // ─── Session Requests ──────────────────────────────────────────────────

  @Roles(Role.ASPIRANT)
  @Post('sessions/requests')
  async createRequest(@CurrentUser() user: JwtUser, @Body() body: CreateSessionRequestDto) {
    return this.sessions.createRequest(
      user.sub,
      body.mentorId,
      body.scheduledAt,
      body.durationMin ?? 60,
      body.message,
    )
  }

  @Get('sessions/requests')
  async listRequests(@CurrentUser() user: JwtUser) {
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { role: true },
    })
    return this.sessions.listRequests(user.sub, dbUser?.role ?? Role.ASPIRANT)
  }

  @Roles(Role.MENTOR)
  @Patch('sessions/requests/:id/accept')
  acceptRequest(
    @CurrentUser() user: JwtUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.sessions.acceptRequest(id, user.sub)
  }

  @Roles(Role.MENTOR)
  @Patch('sessions/requests/:id/decline')
  declineRequest(
    @CurrentUser() user: JwtUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: RespondSessionRequestDto,
  ) {
    return this.sessions.declineRequest(id, user.sub, body.reason)
  }

  @Roles(Role.ASPIRANT)
  @Patch('sessions/requests/:id/cancel')
  cancelRequest(
    @CurrentUser() user: JwtUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.sessions.cancelRequest(id, user.sub)
  }

  // ─── Wallet ────────────────────────────────────────────────────────────

  @Get('wallet')
  listWallet(@CurrentUser() user: JwtUser) {
    return this.sessions.listWallet(user.sub)
  }
}
