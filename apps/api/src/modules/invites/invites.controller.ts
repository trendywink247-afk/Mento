import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common'
import { Role } from '@prisma/client'
import { Public } from '../auth/decorators/public.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { CurrentUser, type JwtUser } from '../auth/decorators/current-user.decorator'
import { InvitesService } from './invites.service'
import { CreateInviteDto } from './dto/create-invite.dto'
import { RedeemInviteDto } from './dto/redeem-invite.dto'

@Controller()
export class InvitesController {
  constructor(private readonly invites: InvitesService) {}

  // ─── Admin endpoints ──────────────────────────────────────────────────────

  @Roles(Role.ADMIN)
  @Post('admin/invites')
  createCode(@CurrentUser() actor: JwtUser, @Body() dto: CreateInviteDto) {
    return this.invites.createCode(actor.sub, dto)
  }

  @Roles(Role.ADMIN)
  @Get('admin/invites')
  listCodes() {
    return this.invites.listCodes()
  }

  @Roles(Role.ADMIN)
  @Patch('admin/invites/:id/disable')
  disableCode(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.invites.disableCode(id)
  }

  // ─── Public validation endpoint ───────────────────────────────────────────

  /**
   * Validates a code without redeeming it.
   * Returns 200 if valid, 404 if not found, 410 if expired/disabled/exhausted.
   * Used by the login page to give inline feedback before OTP is sent.
   */
  @Public()
  @Post('invites/redeem')
  @HttpCode(200)
  async validateCode(@Body() dto: RedeemInviteDto) {
    await this.invites.validateCode(dto.code)
    return { valid: true }
  }
}
