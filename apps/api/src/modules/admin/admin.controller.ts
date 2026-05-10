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

  @Post('mentors/:id/approve')
  approveMentor(
    @CurrentUser() actor: JwtUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.admin.approveMentor(id, actor.sub)
  }

  @Get('audit-logs')
  audit(@Query('limit') limit?: string) {
    return this.admin.listAuditLogs(limit ? Number(limit) : undefined)
  }
}
