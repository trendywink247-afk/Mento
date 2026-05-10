import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
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
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
        redact: {
          paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.token'],
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
})
export class AppModule {}
