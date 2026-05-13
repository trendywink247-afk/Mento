import * as crypto from 'node:crypto'
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { SubscriptionStatus, SubscriptionTier } from '@prisma/client'
import { PrismaService } from '../../database/prisma.service'
import { MetricsService } from '../metrics/metrics.service'

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly metricsService: MetricsService,
  ) {}

  // ─── Internal helpers ──────────────────────────────────────────────────────

  private isDev(): boolean {
    // Only treat the absence of RAZORPAY_KEY_ID as "dev mode" outside production.
    // In production a missing key indicates a config outage, not a license to bypass payments.
    if (process.env.NODE_ENV === 'production') return false
    return !this.config.get<string>('RAZORPAY_KEY_ID')
  }

  private planIdForTier(tier: Exclude<SubscriptionTier, 'FREE'>): string | undefined {
    const key = `RAZORPAY_PLAN_${tier}` as const
    return this.config.get<string>(key)
  }

  /** Returns the active subscription row, or null if the user is FREE. */
  async findActive(userId: string) {
    return this.prisma.subscription.findFirst({
      where: {
        userId,
        status: SubscriptionStatus.ACTIVE,
        OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gte: new Date() } }],
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  // ─── GET /subscriptions/me ─────────────────────────────────────────────────

  async getMySubscription(userId: string) {
    const active = await this.findActive(userId)
    if (!active) return { tier: SubscriptionTier.FREE }
    return {
      tier: active.tier,
      status: active.status,
      currentPeriodEnd: active.currentPeriodEnd,
      razorpaySubscriptionId: active.razorpaySubscriptionId,
    }
  }

  // ─── POST /subscriptions/checkout ─────────────────────────────────────────

  async checkout(userId: string, tier: Exclude<SubscriptionTier, 'FREE'>) {
    if (this.isDev()) {
      this.logger.log(`[DEV] simulate checkout for userId=${userId} tier=${tier}`)
      return {
        orderId: `sim_${crypto.randomBytes(8).toString('hex')}`,
        checkoutUrl: '/checkout/mock',
        simulated: true,
        tier,
      }
    }

    // Production path — create a Razorpay subscription
    const keyId = this.config.get<string>('RAZORPAY_KEY_ID')!
    const keySecret = this.config.get<string>('RAZORPAY_KEY_SECRET')!
    const planId = this.planIdForTier(tier)
    if (!planId) {
      throw new BadRequestException(`Razorpay plan not configured for tier ${tier}`)
    }

    const Razorpay = (await import('razorpay')).default
    const rzp = new Razorpay({ key_id: keyId, key_secret: keySecret })

    const sub = await rzp.subscriptions.create({
      plan_id: planId,
      total_count: 12,
      quantity: 1,
      notes: { userId, tier },
    })

    this.logger.log(`Created Razorpay subscription sub_id=${sub.id} tier=${tier} userId=${userId}`)

    return {
      orderId: sub.id,
      checkoutUrl: sub.short_url,
      simulated: false,
      tier,
    }
  }

  // ─── POST /subscriptions/cancel ───────────────────────────────────────────

  async cancel(userId: string) {
    const active = await this.findActive(userId)
    if (!active) throw new NotFoundException('No active subscription to cancel')

    if (!this.isDev() && active.razorpaySubscriptionId) {
      const keyId = this.config.get<string>('RAZORPAY_KEY_ID')!
      const keySecret = this.config.get<string>('RAZORPAY_KEY_SECRET')!
      const Razorpay = (await import('razorpay')).default
      const rzp = new Razorpay({ key_id: keyId, key_secret: keySecret })
      await rzp.subscriptions.cancel(active.razorpaySubscriptionId, false)
      this.logger.log(`Cancelled Razorpay subscription sub_id=${active.razorpaySubscriptionId}`)
    }

    await this.prisma.subscription.update({
      where: { id: active.id },
      data: { status: SubscriptionStatus.CANCELLED, cancelledAt: new Date() },
    })

    return { status: 'cancelled' }
  }

  // ─── POST /subscriptions/webhook ──────────────────────────────────────────

  async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
    const webhookSecret = this.config.get<string>('RAZORPAY_WEBHOOK_SECRET')
    if (!webhookSecret) {
      this.logger.warn('RAZORPAY_WEBHOOK_SECRET not set — skipping webhook')
      return
    }

    // HMAC-SHA256 signature verification
    const expected = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex')

    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
      throw new ForbiddenException('Invalid webhook signature')
    }

    const payload = JSON.parse(rawBody.toString()) as {
      event: string
      payload: {
        subscription?: {
          entity?: {
            id?: string
            plan_id?: string
            notes?: { userId?: string; tier?: string }
            status?: string
            current_end?: number
          }
        }
      }
    }

    const subEntity = payload.payload?.subscription?.entity
    if (!subEntity?.id) return

    const razorpaySubscriptionId = subEntity.id
    const userId = subEntity.notes?.userId
    const tier = (subEntity.notes?.tier as SubscriptionTier | undefined) ?? SubscriptionTier.BASIC
    const currentEnd = subEntity.current_end
      ? new Date(subEntity.current_end * 1000)
      : undefined

    this.logger.log(`Webhook event=${payload.event} sub_id=${razorpaySubscriptionId} userId=${userId}`)

    switch (payload.event) {
      case 'subscription.activated':
      case 'subscription.charged':
        if (userId) {
          await this.upsertActiveSubscription(userId, tier, razorpaySubscriptionId, currentEnd)
          this.metricsService.subscriptionChangeTotal.inc({ to: 'activated', tier })
        }
        break

      case 'subscription.cancelled':
        await this.prisma.subscription.updateMany({
          where: { razorpaySubscriptionId },
          data: { status: SubscriptionStatus.CANCELLED, cancelledAt: new Date() },
        })
        this.metricsService.subscriptionChangeTotal.inc({ to: 'cancelled', tier })
        break

      case 'subscription.expired':
        await this.prisma.subscription.updateMany({
          where: { razorpaySubscriptionId },
          data: { status: SubscriptionStatus.EXPIRED },
        })
        break

      default:
        this.logger.log(`Unhandled webhook event: ${payload.event}`)
    }
  }

  private async upsertActiveSubscription(
    userId: string,
    tier: SubscriptionTier,
    razorpaySubscriptionId: string,
    currentPeriodEnd?: Date,
  ) {
    // Cancel any existing active subscription row for this user first
    await this.prisma.subscription.updateMany({
      where: { userId, status: SubscriptionStatus.ACTIVE },
      data: { status: SubscriptionStatus.CANCELLED, cancelledAt: new Date() },
    })

    await this.prisma.subscription.create({
      data: {
        userId,
        tier,
        status: SubscriptionStatus.ACTIVE,
        razorpaySubscriptionId,
        currentPeriodStart: new Date(),
        currentPeriodEnd: currentPeriodEnd ?? null,
      },
    })
  }

  // ─── POST /subscriptions/simulate-success (dev only) ─────────────────────

  async simulateSuccess(userId: string, tier: Exclude<SubscriptionTier, 'FREE'>) {
    if (!this.isDev()) {
      throw new ForbiddenException('simulate-success is only available in dev mode')
    }

    const periodEnd = new Date()
    periodEnd.setDate(periodEnd.getDate() + 30)

    // Cancel existing active subs atomically
    await this.prisma.$transaction([
      this.prisma.subscription.updateMany({
        where: { userId, status: SubscriptionStatus.ACTIVE },
        data: { status: SubscriptionStatus.CANCELLED, cancelledAt: new Date() },
      }),
      this.prisma.subscription.create({
        data: {
          userId,
          tier,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: new Date(),
          currentPeriodEnd: periodEnd,
        },
      }),
    ])

    // Write paid_activated OnboardingEvent for funnel tracking (fire-and-forget).
    void this.prisma.onboardingEvent.create({
      data: { userId, step: 'paid_activated', sessionId: 'server' },
    }).catch(() => {})

    return { tier, status: 'ACTIVE', currentPeriodEnd: periodEnd, simulated: true }
  }

  // ─── Tier check helper (used by TierGuard) ────────────────────────────────

  async getTierForUser(userId: string): Promise<SubscriptionTier> {
    const active = await this.findActive(userId)
    return active?.tier ?? SubscriptionTier.FREE
  }
}
