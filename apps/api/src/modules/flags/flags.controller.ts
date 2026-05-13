import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common'
import { Role } from '@prisma/client'
import { IsBoolean, IsOptional, IsString } from 'class-validator'
import { Public } from '../auth/decorators/public.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { CurrentUser, type JwtUser } from '../auth/decorators/current-user.decorator'
import { FlagsService } from './flags.service'

class SetFlagDto {
  @IsBoolean()
  enabled!: boolean

  @IsOptional()
  @IsString()
  description?: string
}

/** Public endpoint: read all feature flags (cached 30s in Redis). */
@Controller('flags')
export class FlagsPublicController {
  constructor(private readonly flags: FlagsService) {}

  @Public()
  @Get()
  getFlags(): Promise<Record<string, boolean>> {
    return this.flags.getPublicFlags()
  }
}

/** Admin-only flag management endpoints. */
@Roles(Role.ADMIN)
@Controller('admin/flags')
export class FlagsAdminController {
  constructor(private readonly flags: FlagsService) {}

  @Get()
  list() {
    return this.flags.getAdminFlags()
  }

  @Patch(':key')
  set(
    @CurrentUser() actor: JwtUser,
    @Param('key') key: string,
    @Body() body: SetFlagDto,
  ) {
    return this.flags.setFlag(key, body.enabled, body.description, actor.sub)
  }

  @Post('seed')
  seed(@CurrentUser() actor: JwtUser) {
    return this.flags.seedDefaults(actor.sub)
  }
}
