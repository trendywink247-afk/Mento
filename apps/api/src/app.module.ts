import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { APP_GUARD } from '@nestjs/core'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { LoggerModule } from 'nestjs-pino'
import { PrismaModule } from './database/prisma.module'
import { PostHogModule } from './common/posthog.module'
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
import { StorageModule } from './modules/storage/storage.module'
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module'
import { NotificationsModule } from './modules/notifications/notifications.module'
import { PushTokensModule } from './modules/push-tokens/push-tokens.module'
import { SessionsModule } from './modules/sessions/sessions.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.registerAsync({
      global: true,
      useFactory: () => ({ secret: process.env.JWT_ACCESS_SECRET }),
    }),
    // Global per-IP rate limit.
    // Realistic for India where many users sit behind shared NAT (campus / college Wi-Fi).
    // Auth-specific limits live in OtpService (3 unconsumed OTPs/hour per phone).
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1_000, limit: 30 },         // burst: 30 req / sec
      { name: 'medium', ttl: 60_000, limit: 600 },      // 600 req / min
      { name: 'long', ttl: 3_600_000, limit: 10_000 },  // 10k req / hour
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
    PostHogModule,
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
    StorageModule,
    SubscriptionsModule,
    NotificationsModule,
    PushTokensModule,
    SessionsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
