import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  Post,
  Req,
} from '@nestjs/common'
import { Request } from 'express'
import { PushTokensService } from './push-tokens.service'
import { RegisterPushTokenDto } from './dto/register-push-token.dto'

@Controller('push-tokens')
export class PushTokensController {
  constructor(private readonly pushTokens: PushTokensService) {}

  /**
   * Register (or refresh) a push token for the authenticated user.
   * Safe to call on every login — uses upsert by token value.
   */
  @Post()
  @HttpCode(204)
  async register(
    @Req() req: Request & { user: { sub: string } },
    @Body() body: RegisterPushTokenDto,
  ): Promise<void> {
    await this.pushTokens.register(req.user.sub, body.token, body.platform)
  }

  /**
   * Unregister a push token — call on logout.
   */
  @Delete(':token')
  @HttpCode(204)
  async unregister(@Param('token') token: string): Promise<void> {
    await this.pushTokens.unregister(token)
  }
}
