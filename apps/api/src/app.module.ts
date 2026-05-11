import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { APP_GUARD } from '@nestjs/core'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { LoggerModule } from 'nestjs-pino'
import { PrismaModule } from './database/prisma.module'
import { HealthModule } from './modules/health/health.module'
import { AuthModule } from './modules/auth/auth.module'
import { UsersModule } from './modules/users/users.module'
import { ChatModule } from './modules/chat/chat.module'
import { AssignmentsModule } from './modules/assignments/assignments.module'
import { AdminModule } from './modules/admin/admin.module'
import { OnboardingModule } from './modules/onboarding/onboarding.module'
import { MentorsModule } from './modules/mentors/mentors.module'
import { ChatRequestsModule } from './modules/chat-requests/chat-requests.module'
import { JournalsModule } from './modules/journals/journals.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.registerAsync({
      global: true,
      useFactory: () => ({ secret: process.env.JWT_ACCESS_SECRET }),
    }),
    // Global per-IP rate limit. Auth routes get tighter limits in their own controllers.
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1_000, limit: 10 },   // burst: 10 req / sec
      { name: 'medium', ttl: 60_000, limit: 120 }, // 120 req / min
      { name: 'long', ttl: 3_600_000, limit: 2_000 }, // 2000 req / hour
    ]),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.body.password',
            'req.body.passwordHash',
            'req.body.refreshToken',
            'req.body.token',
            'req.body.code',
            'req.body.phone',
            'req.body.email',
            'res.headers["set-cookie"]',
            '*.password',
            '*.passwordHash',
            '*.token',
            '*.accessToken',
            '*.refreshToken',
            '*.tokenHash',
            '*.codeHash',
            '*.aadhaarHash',
            '*.aadhaarUrl',
            '*.phone',
            '*.email',
          ],
          censor: '[REDACTED]',
        },
      },
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    ChatModule,
    AssignmentsModule,
    AdminModule,
    OnboardingModule,
    MentorsModule,
    ChatRequestsModule,
    JournalsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
