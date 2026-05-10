import { Controller, Get } from '@nestjs/common'
import { CurrentUser, type JwtUser } from '../auth/decorators/current-user.decorator'
import { UsersService } from './users.service'

@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@CurrentUser() user: JwtUser) {
    return this.users.getMe(user.sub)
  }
}
