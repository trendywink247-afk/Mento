import { BadRequestException, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { compare, hash } from 'bcryptjs'
import { randomInt } from 'crypto'
import { Redis } from 'ioredis'
import { PrismaService } from '../../database/prisma.service'
import { MetricsService } from '../metrics/metrics.service'

const OTP_TTL_MS = 5 * 60 * 1000
const MAX_ATTEMPTS = 5

/**
 * Redis-backed brute-force protection for /auth/otp/verify.
 *
 * Window: 10 minutes. After VERIFY_FAIL_LIMIT (5) consecutive wrong codes
 * within that window, the phone is locked for LOCKOUT_SECONDS (30 min).
 * The counter resets on a successful verify.
 *
 * Keys:
 *   otp:fail:<phone>   — incremented integer, TTL = FAIL_WINDOW_SECONDS
 *   otp:lock:<phone>   — exists only during lockout, TTL = LOCKOUT_SECONDS
 */
const FAIL_WINDOW_SECONDS = 10 * 60   // 10 minutes
const VERIFY_FAIL_LIMIT = 5
const LOCKOUT_SECONDS = 30 * 60       // 30 minutes

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name)
  private readonly enabled: boolean
  private readonly apiKey?: string
  private readonly templateId?: string
  private readonly senderId?: string
  private readonly redis: Redis

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly metricsService: MetricsService,
  ) {
    this.enabled = this.config.get<string>('MSG91_ENABLED') === 'true'
    this.apiKey = this.config.get<string>('MSG91_API_KEY') || undefined
    this.templateId = this.config.get<string>('MSG91_TEMPLATE_ID') || undefined
    this.senderId = this.config.get<string>('MSG91_SENDER_ID') || undefined
    this.redis = new Redis(
      this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6380/0',
      { lazyConnect: true },
    )
  }

  async issue(phone: string): Promise<{ expiresIn: number; devCode?: string }> {
    // Rate limit: max 3 unconsumed requests within the last hour for this phone.
    const recent = await this.prisma.otpRequest.count({
      where: {
        phone,
        consumedAt: null,
        createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
      },
    })
    if (recent >= 3) {
      throw new HttpException('Too many OTP requests; try again later', HttpStatus.TOO_MANY_REQUESTS)
    }

    const code = this.generate6DigitCode()
    const codeHash = await hash(code, 10)
    const expiresAt = new Date(Date.now() + OTP_TTL_MS)

    await this.prisma.otpRequest.create({
      data: { phone, codeHash, expiresAt },
    })

    if (this.enabled && this.apiKey && this.templateId) {
      await this.sendViaMsg91(phone, code)
      return { expiresIn: Math.floor(OTP_TTL_MS / 1000) }
    }

    // Dev mode: print to console; return code in payload for easy testing.
    this.logger.warn(`[DEV] OTP for ${phone} = ${code}`)
    return { expiresIn: Math.floor(OTP_TTL_MS / 1000), devCode: code }
  }

  async verify(phone: string, code: string): Promise<boolean> {
    // Check brute-force lockout before touching the DB.
    const locked = await this.redis.exists(`otp:lock:${phone}`)
    if (locked) {
      this.metricsService.otpVerifyTotal.inc({ outcome: 'locked' })
      const ttl = await this.redis.ttl(`otp:lock:${phone}`)
      throw new HttpException(
        `Too many failed attempts. Try again in ${Math.ceil(ttl / 60)} minutes.`,
        HttpStatus.TOO_MANY_REQUESTS,
      )
    }

    const record = await this.prisma.otpRequest.findFirst({
      where: { phone, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    })
    if (!record) throw new BadRequestException('No pending OTP for this phone (or expired)')
    if (record.attempts >= MAX_ATTEMPTS) {
      this.metricsService.otpVerifyTotal.inc({ outcome: 'rate_limited' })
      throw new BadRequestException('Too many attempts; request a new OTP')
    }

    const ok = await compare(code, record.codeHash)
    if (!ok) {
      await this.prisma.otpRequest.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      })
      // Track per-phone failure in Redis and potentially trigger lockout.
      await this.recordFailure(phone)
      this.metricsService.otpVerifyTotal.inc({ outcome: 'wrong' })
      throw new BadRequestException('Invalid OTP')
    }

    // Success: consume the OTP and reset the failure counter.
    await this.prisma.otpRequest.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    })
    await this.clearFailures(phone)
    this.metricsService.otpVerifyTotal.inc({ outcome: 'ok' })
    return true
  }

  // ---------------------------------------------------------------------------
  // Brute-force helpers
  // ---------------------------------------------------------------------------

  /**
   * Throws TooManyRequestsException if the phone is currently locked out.
   */
  async assertNotLocked(phone: string): Promise<void> {
    const locked = await this.redis.exists(`otp:lock:${phone}`)
    if (locked) {
      const ttl = await this.redis.ttl(`otp:lock:${phone}`)
      throw new HttpException(
        `Too many failed attempts. Try again in ${Math.ceil(ttl / 60)} minutes.`,
        HttpStatus.TOO_MANY_REQUESTS,
      )
    }
  }

  /**
   * Increments the failure counter for the phone within the sliding window.
   * If the limit is reached, sets a lockout key and deletes the fail counter.
   */
  async recordFailure(phone: string): Promise<void> {
    const failKey = `otp:fail:${phone}`
    const count = await this.redis.incr(failKey)
    // Only set the TTL on the first increment so the window is fixed from first failure.
    if (count === 1) {
      await this.redis.expire(failKey, FAIL_WINDOW_SECONDS)
    }
    if (count >= VERIFY_FAIL_LIMIT) {
      const lockKey = `otp:lock:${phone}`
      await this.redis.set(lockKey, '1', 'EX', LOCKOUT_SECONDS)
      await this.redis.del(failKey)
      this.logger.warn(`OTP verify lockout triggered for phone [REDACTED]; locked for ${LOCKOUT_SECONDS}s`)
    }
  }

  /**
   * Resets the failure counter and any lockout key after a successful verify.
   */
  async clearFailures(phone: string): Promise<void> {
    await this.redis.del(`otp:fail:${phone}`, `otp:lock:${phone}`)
  }

  private generate6DigitCode(): string {
    // CSPRNG — Math.random is a Xorshift PRNG and is not appropriate for security tokens.
    return String(randomInt(100000, 1_000_000))
  }

  private async sendViaMsg91(phone: string, code: string): Promise<void> {
    // MSG91 OTP API. Requires DLT-approved template.
    // Docs: https://docs.msg91.com/p/tf9GTextN/e/wsTHGxZf38/MSG91
    const url = new URL('https://control.msg91.com/api/v5/otp')
    url.searchParams.set('template_id', this.templateId!)
    url.searchParams.set('mobile', phone.replace(/^\+/, ''))
    url.searchParams.set('otp', code)
    if (this.senderId) url.searchParams.set('sender', this.senderId)

    const res = await fetch(url, {
      method: 'POST',
      headers: { authkey: this.apiKey!, 'Content-Type': 'application/json' },
    })
    if (!res.ok) {
      const body = await res.text()
      this.logger.error(`MSG91 send failed: ${res.status} ${body}`)
      throw new Error('Failed to send OTP')
    }
  }
}
