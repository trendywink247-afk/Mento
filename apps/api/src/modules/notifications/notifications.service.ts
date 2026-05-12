import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../database/prisma.service'

export interface SendPushOptions {
  userId: string
  title: string
  body: string
  data?: Record<string, string>
}

interface ExpoPushMessage {
  to: string
  title: string
  body: string
  data?: Record<string, string>
  sound?: 'default'
}

interface ExpoPushTicket {
  status: 'ok' | 'error'
  id?: string
  message?: string
  details?: { error?: string }
}

interface ExpoPushResponse {
  data: ExpoPushTicket[]
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name)
  private readonly expoApiUrl = 'https://exp.host/--/api/v2/push/send'

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async send(opts: SendPushOptions): Promise<void> {
    const { userId, title, body, data } = opts

    // Look up all push tokens for this user.
    const pushTokenRows = await this.prisma.pushToken.findMany({
      where: { userId },
      select: { id: true, token: true },
    })

    if (pushTokenRows.length === 0) return

    const accessToken = this.config.get<string>('EXPO_ACCESS_TOKEN')

    // Dev fallback: log to console when no access token is configured.
    if (!accessToken) {
      this.logger.log(
        `[DEV push] userId=${userId} title="${title}" body="${body}" tokens=${pushTokenRows.map((t) => t.token).join(',')}`,
      )
      return
    }

    // Build messages — Expo requires each token as a separate entry.
    const messages: ExpoPushMessage[] = pushTokenRows.map((row) => ({
      to: row.token,
      title,
      body: body.slice(0, 80),
      sound: 'default',
      ...(data ? { data } : {}),
    }))

    // Batch 100 per request (Expo hard limit).
    const BATCH_SIZE = 100
    for (let i = 0; i < messages.length; i += BATCH_SIZE) {
      const batch = messages.slice(i, i + BATCH_SIZE)
      const tokenBatch = pushTokenRows.slice(i, i + BATCH_SIZE)

      try {
        const res = await fetch(this.expoApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(batch),
        })

        if (!res.ok) {
          this.logger.warn(`Expo push API error: ${res.status} ${res.statusText}`)
          continue
        }

        const json = (await res.json()) as ExpoPushResponse

        // Handle DeviceNotRegistered — delete stale tokens.
        const staleTokenIds: string[] = []
        for (let j = 0; j < json.data.length; j++) {
          const ticket = json.data[j]
          if (
            ticket.status === 'error' &&
            ticket.details?.error === 'DeviceNotRegistered'
          ) {
            staleTokenIds.push(tokenBatch[j].id)
          }
        }

        if (staleTokenIds.length > 0) {
          await this.prisma.pushToken.deleteMany({
            where: { id: { in: staleTokenIds } },
          })
          this.logger.log(`Deleted ${staleTokenIds.length} stale push token(s)`)
        }
      } catch (err) {
        // Never crash the caller — push failures are non-fatal.
        this.logger.warn(`Push send error: ${String(err)}`)
      }
    }
  }
}
