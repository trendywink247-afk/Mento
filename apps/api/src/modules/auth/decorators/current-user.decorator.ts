import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import type { Role } from '@prisma/client'

export interface JwtUser {
  sub: string
  role: Role
  jti: string
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtUser => {
    const req = ctx.switchToHttp().getRequest<{ user?: JwtUser }>()
    if (!req.user) throw new Error('CurrentUser used on unauthenticated route')
    return req.user
  },
)
