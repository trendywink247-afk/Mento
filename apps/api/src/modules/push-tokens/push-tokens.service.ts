import { Injectable } from '@nestjs/common'
import { Platform } from '@prisma/client'
import { PrismaService } from '../../database/prisma.service'

@Injectable()
export class PushTokensService {
  constructor(private readonly prisma: PrismaService) {}

  async register(userId: string, token: string, platform: Platform): Promise<void> {
    await this.prisma.pushToken.upsert({
      where: { token },
      create: { userId, token, platform, lastUsedAt: new Date() },
      update: { userId, platform, lastUsedAt: new Date() },
    })
  }

  async unregister(token: string, userId: string): Promise<void> {
    // Scoped to the calling user — prevents cross-user token deletion.
    // deleteMany is used for idempotency: no error if the token doesn't exist.
    await this.prisma.pushToken.deleteMany({ where: { token, userId } })
  }
}
