import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common'
import { Role, UserStatus } from '@prisma/client'
import { Roles } from '../auth/decorators/roles.decorator'
import { CurrentUser, type JwtUser } from '../auth/decorators/current-user.decorator'
import { AdminService } from './admin.service'
import { UpdateUserRoleDto } from './dto/update-user-role.dto'
import { ApproveMentorDto, BanMentorDto, RejectMentorDto } from './dto/review-mentor.dto'

@Roles(Role.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('users')
  listUsers(@Query('role') role?: Role, @Query('status') status?: UserStatus) {
    return this.admin.listUsers(role, status)
  }

  @Patch('users/:id/role')
  setRole(
    @CurrentUser() actor: JwtUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateUserRoleDto,
  ) {
    return this.admin.setUserRole(id, body.role, actor.sub)
  }

  /** List mentors who have submitted verification docs but are not yet verified. */
  @Get('mentors/pending')
  listPendingMentors() {
    return this.admin.listPendingMentors()
  }

  @Post('mentors/:id/approve')
  approveMentor(
    @CurrentUser() actor: JwtUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ApproveMentorDto,
  ) {
    return this.admin.approveMentor(id, actor.sub, body.reviewNote)
  }

  @Post('mentors/:id/reject')
  rejectMentor(
    @CurrentUser() actor: JwtUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: RejectMentorDto,
  ) {
    return this.admin.rejectMentor(id, actor.sub, body.reason)
  }

  @Post('mentors/:id/ban')
  banMentor(
    @CurrentUser() actor: JwtUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: BanMentorDto,
  ) {
    return this.admin.banMentor(id, actor.sub, body.reason)
  }

  @Get('audit-logs')
  audit(@Query('limit') limit?: string) {
    return this.admin.listAuditLogs(limit ? Number(limit) : undefined)
  }
}
