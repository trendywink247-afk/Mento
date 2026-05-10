import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { Redis } from 'ioredis'
import { Role } from '@prisma/client'
import type { JwtUser } from './decorators/current-user.decorator'

interface JwtPayload {
  sub: string
  role: Role
  jti: string
  iat: number
  exp: number
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly redis: Redis

  constructor(config: ConfigService) {
    const secret = config.get<string>('JWT_ACCESS_SECRET')
    if (!secret) throw new Error('JWT_ACCESS_SECRET is not set')
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    })
    this.redis = new Redis(config.get<string>('REDIS_URL') ?? 'redis://localhost:6379/0')
  }

  async validate(payload: JwtPayload): Promise<JwtUser> {
    const revoked = await this.redis.get(`auth:revoked:${payload.jti}`)
    if (revoked) throw new UnauthorizedException('Token revoked')
    return { sub: payload.sub, role: payload.role, jti: payload.jti }
  }
}
