import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { Logger } from '@nestjs/common'
import { Server, Socket } from 'socket.io'
import { createAdapter } from '@socket.io/redis-adapter'
import { Redis } from 'ioredis'
import { Role } from '@prisma/client'
import { ChatService } from './chat.service'
import { JournalsService } from '../journals/journals.service'
import { NotificationsService } from '../notifications/notifications.service'
import type { SendMessageDto } from './dto/send-message.dto'

interface AuthedSocketData {
  userId: string
  role: Role
}
type AuthedSocket = Socket & { data: AuthedSocketData }

const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS ?? 'http://localhost:3030,http://localhost:8081').split(',').map((s) => s.trim()).filter(Boolean)

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: (origin, cb) => {
      // Same-origin / non-browser clients (no Origin header) are allowed.
      if (!origin) return cb(null, true)
      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true)
      cb(new Error(`CORS: origin ${origin} not allowed`))
    },
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server
  private readonly logger = new Logger(ChatGateway.name)

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly chat: ChatService,
    private readonly journals: JournalsService,
    private readonly notifications: NotificationsService,
  ) {}

  async afterInit(server: Server) {
    // Redis adapter is required for multi-instance scaling in prod.
    // Skipped in dev to avoid noisy warnings — chat works fine on a single node.
    // To enable in prod, set REDIS_URL and ensure SOCKET_REDIS_ADAPTER=true.
    if (process.env.SOCKET_REDIS_ADAPTER !== 'true') return
    try {
      const url = this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6379/0'
      const pub = new Redis(url)
      const sub = pub.duplicate()
      server.adapter(createAdapter(pub, sub))
      this.logger.log('Socket.IO Redis adapter attached')
    } catch (err) {
      this.logger.warn(`Redis adapter init failed: ${String(err)}`)
    }
  }

  async handleConnection(client: AuthedSocket) {
    const token =
      (typeof client.handshake.auth === 'object' && client.handshake.auth?.token) ||
      client.handshake.headers.authorization?.replace(/^Bearer\s+/i, '')

    if (!token) {
      this.logger.debug('Disconnecting: no token')
      client.disconnect(true)
      return
    }

    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; role: Role }>(token, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      })
      client.data = { userId: payload.sub, role: payload.role }
      await client.join(`user:${payload.sub}`)
      this.broadcastPresence(payload.sub, 'online')
      this.logger.debug(`User ${payload.sub} connected`)
    } catch {
      client.disconnect(true)
    }
  }

  async handleDisconnect(client: AuthedSocket) {
    const userId = client.data?.userId
    if (userId) this.broadcastPresence(userId, 'offline')
  }

  private broadcastPresence(userId: string, status: 'online' | 'offline') {
    this.server.emit(status === 'online' ? 'presence:online' : 'presence:offline', { userId })
  }

  @SubscribeMessage('message:send')
  async onSend(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() payload: SendMessageDto,
  ) {
    const userId = client.data?.userId
    if (!userId) return { ok: false as const, error: 'unauthenticated' }

    try {
      const message = await this.chat.sendMessage({
        senderId: userId,
        conversationId: payload.conversationId,
        type: payload.type,
        body: payload.body,
        attachmentUrl: payload.attachmentUrl,
        clientMessageId: payload.clientMessageId,
      })
      const dto = this.chat.serialize(message)
      this.server
        .to(`conv:${payload.conversationId}`)
        .emit('message:new', dto)
      // Also fanout to recipient personal room (so they see it even if not joined).
      const conv = await this.chat.assertConversationParticipant(payload.conversationId, userId)
      const otherId = conv.mentorId === userId ? conv.aspirantId : conv.mentorId
      this.server.to(`user:${otherId}`).emit('message:new', dto)

      // Send push notification only when the recipient has no active socket connections.
      const recipientSockets = await this.server.in(`user:${otherId}`).fetchSockets()
      if (recipientSockets.length === 0) {
        // Look up the sender's displayHandle for the notification title.
        const senderProfile = await this.chat.getSenderProfile(userId)
        void this.notifications.send({
          userId: otherId,
          title: senderProfile ?? 'New message',
          body: (payload.body ?? '').slice(0, 80),
          data: { conversationId: payload.conversationId },
        })
      }

      return { ok: true as const, message: dto }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'send_failed'
      this.logger.warn(`message:send failed: ${msg}`)
      return { ok: false as const, error: msg }
    }
  }

  @SubscribeMessage('conversation:join')
  async onJoin(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() payload: { conversationId: string },
  ) {
    const userId = client.data?.userId
    if (!userId) return
    try {
      await this.chat.assertConversationParticipant(payload.conversationId, userId)
      await client.join(`conv:${payload.conversationId}`)
      await this.journals.setPresence(payload.conversationId, userId, true)
    } catch {
      /* not a participant — ignore */
    }
  }

  @SubscribeMessage('conversation:leave')
  async onLeave(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() payload: { conversationId: string },
  ) {
    const userId = client.data?.userId
    await client.leave(`conv:${payload.conversationId}`)
    if (userId) await this.journals.setPresence(payload.conversationId, userId, false)
  }

  @SubscribeMessage('message:delivered')
  async onDelivered(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() payload: { messageId: string },
  ) {
    const userId = client.data?.userId
    if (!userId) return
    const updated = await this.chat.markDelivered(payload.messageId, userId)
    if (!updated) return
    this.server
      .to(`conv:${updated.conversationId}`)
      .emit('message:status', {
        messageId: updated.id,
        deliveredAt: updated.deliveredAt?.toISOString(),
      })
  }

  @SubscribeMessage('message:read')
  async onRead(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() payload: { messageId: string },
  ) {
    const userId = client.data?.userId
    if (!userId) return
    const updated = await this.chat.markRead(payload.messageId, userId)
    if (!updated) return
    this.server.to(`conv:${updated.conversationId}`).emit('message:status', {
      messageId: updated.id,
      deliveredAt: updated.deliveredAt?.toISOString(),
      readAt: updated.readAt?.toISOString(),
    })
  }

  @SubscribeMessage('typing:start')
  onTypingStart(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() payload: { conversationId: string },
  ) {
    const userId = client.data?.userId
    if (!userId) return
    client
      .to(`conv:${payload.conversationId}`)
      .emit('typing:start', { conversationId: payload.conversationId, userId })
  }

  @SubscribeMessage('typing:stop')
  onTypingStop(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() payload: { conversationId: string },
  ) {
    const userId = client.data?.userId
    if (!userId) return
    client
      .to(`conv:${payload.conversationId}`)
      .emit('typing:stop', { conversationId: payload.conversationId, userId })
  }
}
