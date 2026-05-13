import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    })
    if (!user) throw new NotFoundException('User not found')
    return {
      user: {
        id: user.id,
        // Anonymity invariant: phone, email, googleSub are admin-only fields.
        // Mirror the /auth/otp/verify and /auth/google shapes — no PII here.
        role: user.role,
        status: user.status,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
      profile: user.profile
        ? {
            userId: user.profile.userId,
            displayHandle: user.profile.displayHandle,
            avatarLetter: user.profile.avatarLetter,
            avatarColor: user.profile.avatarColor,
            hasPurpleTick: user.profile.hasPurpleTick,
            bio: user.profile.bio,
            city: user.profile.city,
            state: user.profile.state,
            language: user.profile.language,
          }
        : null,
    }
  }
}
