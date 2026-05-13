import { Module, forwardRef } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { APP_GUARD } from '@nestjs/core'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { OtpService } from './otp.service'
import { JwtStrategy } from './jwt.strategy'
import { JwtAuthGuard } from './guards/jwt-auth.guard'
import { RolesGuard } from './guards/roles.guard'
import { InvitesModule } from '../invites/invites.module'

/**
 * AuthModule — rate-limit strategy for OTP endpoints
 * =====================================================
 * The global ThrottlerGuard (30/sec, 600/min, 10k/hour) is SKIPPED on
 * POST /auth/otp/request and POST /auth/otp/verify via @SkipThrottle().
 *
 * Rationale: in India many users share a single egress IP (campus Wi-Fi,
 * corporate NAT). A per-IP limit would lock out hundreds of legitimate users
 * whenever a single person triggers the threshold.
 *
 * Instead, abuse protection is layered per-phone inside OtpService:
 *
 *   1. Request rate limit (Prisma):
 *      Max 3 unconsumed OTPs per phone per hour → HTTP 429.
 *
 *   2. Verify brute-force lockout (Redis):
 *      5 consecutive wrong codes in 10 minutes → 30-minute lockout → HTTP 429.
 *      Counter resets on a successful verify.
 *
 * The global ThrottlerGuard remains active on every other endpoint.
 */
@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET'),
      }),
    }),
    forwardRef(() => InvitesModule),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    OtpService,
    JwtStrategy,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
