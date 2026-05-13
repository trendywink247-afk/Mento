import { Injectable, OnModuleDestroy } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Redis } from 'ioredis'
import { PrismaService } from '../../database/prisma.service'

const CACHE_KEY = 'feature_flags:all'
const CACHE_TTL_SEC = 30

export const DEFAULT_FLAGS: Array<{ key: string; enabled: boolean; description: string }> = [
  { key: 'broadcast-requests', enabled: false, description: 'Allow aspirants to broadcast chat requests to multiple mentors at once.' },
  { key: 'voice-calls', enabled: false, description: 'Enable in-app voice call feature between mentor and aspirant.' },
  { key: 'group-sessions', enabled: false, description: 'Allow mentors to host group study sessions.' },
  { key: 'mentor-self-onboarding-v2', enabled: false, description: 'Use the redesigned v2 mentor onboarding flow.' },
  { key: 'chat-search', enabled: true, description: 'Enable full-text search within conversations.' },
  { key: 'i18n-hindi', enabled: false, description: 'Enable Hindi language option in the language switcher.' },
]

@Injectable()
export class FlagsService implements OnModuleDestroy {
  private readonly redis: Redis

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.redis = new Redis(this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6379/0')
  }

  onModuleDestroy() {
    void this.redis.quit()
  }

  /** Returns a Record<key, boolean> of all flags. Cached in Redis for 30s. */
  async getPublicFlags(): Promise<Record<string, boolean>> {
    const cached = await this.redis.get(CACHE_KEY)
    if (cached) {
      return JSON.parse(cached) as Record<string, boolean>
    }

    const rows = await this.prisma.featureFlag.findMany({
      select: { key: true, enabled: true },
    })

    const result: Record<string, boolean> = {}
    for (const row of rows) {
      result[row.key] = row.enabled
    }

    // Cache even an empty object so the DB isn't hammered on a fresh install.
    await this.redis.setex(CACHE_KEY, CACHE_TTL_SEC, JSON.stringify(result))
    return result
  }

  /** Returns full flag rows for admin use (no caching — admin UI needs fresh data). */
  async getAdminFlags() {
    return this.prisma.featureFlag.findMany({
      orderBy: { key: 'asc' },
    })
  }

  /** Upserts a flag and busts the Redis cache. */
  async setFlag(key: string, enabled: boolean, description?: string, actorId?: string) {
    const flag = await this.prisma.featureFlag.upsert({
      where: { key },
      create: {
        key,
        enabled,
        description: description ?? null,
        updatedBy: actorId ?? null,
      },
      update: {
        enabled,
        ...(description !== undefined ? { description } : {}),
        updatedBy: actorId ?? null,
      },
    })

    await this.redis.del(CACHE_KEY)
    return flag
  }

  /** Creates default flags if they don't already exist. Idempotent. */
  async seedDefaults(actorId?: string) {
    const existing = await this.prisma.featureFlag.findMany({ select: { key: true } })
    const existingKeys = new Set(existing.map((f) => f.key))

    const toCreate = DEFAULT_FLAGS.filter((f) => !existingKeys.has(f.key))

    if (toCreate.length > 0) {
      await this.prisma.featureFlag.createMany({
        data: toCreate.map((f) => ({
          key: f.key,
          enabled: f.enabled,
          description: f.description,
          updatedBy: actorId ?? null,
        })),
        skipDuplicates: true,
      })
      // Bust cache after seeding.
      await this.redis.del(CACHE_KEY)
    }

    return {
      seeded: toCreate.length,
      skipped: existingKeys.size,
      total: DEFAULT_FLAGS.length,
    }
  }
}
