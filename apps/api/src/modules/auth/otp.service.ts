import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { compare, hash } from 'bcryptjs'
import { randomInt } from 'crypto'
import { PrismaService } from '../../database/prisma.service'

const OTP_TTL_MS = 5 * 60 * 1000
const MAX_ATTEMPTS = 5

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name)
  private readonly enabled: boolean
  private readonly apiKey?: string
  private readonly templateId?: string
  private readonly senderId?: string

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.enabled = this.config.get<string>('MSG91_ENABLED') === 'true'
    this.apiKey = this.config.get<string>('MSG91_API_KEY') || undefined
    this.templateId = this.config.get<string>('MSG91_TEMPLATE_ID') || undefined
    this.senderId = this.config.get<string>('MSG91_SENDER_ID') || undefined
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
    if (recent >= 3) throw new BadRequestException('Too many OTP requests; try again later')

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
    const record = await this.prisma.otpRequest.findFirst({
      where: { phone, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    })
    if (!record) throw new BadRequestException('No pending OTP for this phone (or expired)')
    if (record.attempts >= MAX_ATTEMPTS) {
      throw new BadRequestException('Too many attempts; request a new OTP')
    }

    const ok = await compare(code, record.codeHash)
    if (!ok) {
      await this.prisma.otpRequest.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      })
      throw new BadRequestException('Invalid OTP')
    }

    await this.prisma.otpRequest.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    })
    return true
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
