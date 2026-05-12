import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common'
import { Role, UserStatus } from '@prisma/client'
import { Roles } from '../auth/decorators/roles.decorator'
import { CurrentUser, type JwtUser } from '../auth/decorators/current-user.decorator'
import { ModerationService } from './moderation.service'
import { ResolveReportDto } from './dto/resolve-report.dto'
import { SetUserStatusDto } from './dto/set-user-status.dto'

@Roles(Role.ADMIN)
@Controller('admin')
export class ModerationController {
  constructor(private readonly moderation: ModerationService) {}

  /**
   * GET /admin/moderation/reports
   * Paginated list of message reports.
   * Query: status=PENDING|REVIEWED_NO_ACTION|REVIEWED_BANNED, limit, cursor
   */
  @Get('moderation/reports')
  listReports(
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.moderation.listReports({
      status: status as 'PENDING' | 'REVIEWED_NO_ACTION' | 'REVIEWED_BANNED' | undefined,
      limit: limit ? Number(limit) : undefined,
      cursor,
    })
  }

  /**
   * GET /admin/moderation/reports/:id
   * Full report detail with 5-message context from the same author.
   */
  @Get('moderation/reports/:id')
  getReport(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.moderation.getReport(id)
  }

  /**
   * PATCH /admin/moderation/reports/:id/resolve
   * body: { action: 'DISMISS'|'WARN'|'SUSPEND'|'BAN', notes?: string }
   */
  @Patch('moderation/reports/:id/resolve')
  resolveReport(
    @CurrentUser() actor: JwtUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ResolveReportDto,
  ) {
    return this.moderation.resolveReport(id, actor.sub, body.action, body.notes)
  }

  /**
   * GET /admin/users/:id
   * Full admin user detail (includes phone/email — admin-only route).
   */
  @Get('users/:id')
  getUser(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.moderation.getUser(id)
  }

  /**
   * PATCH /admin/users/:id/status
   * body: { status: UserStatus, reason?: string }
   * Direct status change with audit log.
   */
  @Patch('users/:id/status')
  setUserStatus(
    @CurrentUser() actor: JwtUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: SetUserStatusDto,
  ) {
    return this.moderation.setUserStatus(id, actor.sub, body.status as UserStatus, body.reason)
  }
}
