import {
  Injectable,
  NotFoundException,
  GoneException,
  ConflictException,
} from '@nestjs/common'
import { randomBytes } from 'crypto'
import { PrismaService } from '../../database/prisma.service'
import { CreateInviteDto } from './dto/create-invite.dto'

// 8-char uppercase alphanumeric using base32-like alphabet (no 0/O, 1/I confusion)
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generateInviteCode(): string {
  const bytes = randomBytes(8)
  return Array.from(bytes)
    .map((b) => ALPHABET[b % ALPHABET.length])
    .join('')
}

@Injectable()
export class InvitesService {
  constructor(private readonly prisma: PrismaService) {}

  async createCode(createdBy: string, dto: CreateInviteDto) {
    const code = generateInviteCode()
    return this.prisma.inviteCode.create({
      data: {
        code,
        createdBy,
        label: dto.label,
        maxUses: dto.maxUses ?? 1,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
      select: {
        id: true,
        code: true,
        label: true,
        maxUses: true,
        uses: true,
        expiresAt: true,
        disabledAt: true,
        createdAt: true,
        // never expose createdBy identity in the response object itself
        // (admin sees it via the admin list endpoint)
      },
    })
  }

  async listCodes() {
    const rows = await this.prisma.inviteCode.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { redemptions: true } },
      },
    })
    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      label: r.label,
      maxUses: r.maxUses,
      uses: r.uses,
      expiresAt: r.expiresAt,
      disabledAt: r.disabledAt,
      createdAt: r.createdAt,
      redemptionCount: r._count.redemptions,
      status: this.statusFor(r),
    }))
  }

  async disableCode(id: string) {
    const code = await this.prisma.inviteCode.findUnique({ where: { id } })
    if (!code) throw new NotFoundException('Invite code not found')
    return this.prisma.inviteCode.update({
      where: { id },
      data: { disabledAt: new Date() },
      select: { id: true, code: true, disabledAt: true },
    })
  }

  /**
   * Validates a code WITHOUT redeeming it.
   * Returns the InviteCode row if valid.
   * Throws NotFoundException (404) if not found, GoneException (410) if expired/disabled/full.
   */
  async validateCode(code: string) {
    const row = await this.prisma.inviteCode.findUnique({ where: { code } })
    if (!row) throw new NotFoundException('Invite code not found')
    this.assertUsable(row)
    return row
  }

  /**
   * Validates and redeems a code for a newly-created user.
   * Must be called inside or right after user creation.
   * Throws if invalid — caller must delete the just-created user if this throws.
   */
  async redeemForUser(userId: string, code: string): Promise<void> {
    // Use a transaction so the use-count increment and redemption row are atomic.
    await this.prisma.$transaction(async (tx) => {
      const row = await tx.inviteCode.findUnique({ where: { code } })
      if (!row) throw new NotFoundException('Invite code not found')
      this.assertUsable(row)

      // Guard: a user can only redeem once (@@unique([userId]) on InviteRedemption)
      const existing = await tx.inviteRedemption.findUnique({ where: { userId } })
      if (existing) throw new ConflictException('User has already redeemed an invite code')

      await tx.inviteRedemption.create({
        data: { inviteCodeId: row.id, userId },
      })

      await tx.inviteCode.update({
        where: { id: row.id },
        data: { uses: { increment: 1 } },
      })
    })
  }

  private assertUsable(row: {
    disabledAt: Date | null
    expiresAt: Date | null
    uses: number
    maxUses: number
  }): void {
    if (row.disabledAt) {
      throw new GoneException('This invite code has been disabled')
    }
    if (row.expiresAt && row.expiresAt < new Date()) {
      throw new GoneException('This invite code has expired')
    }
    if (row.uses >= row.maxUses) {
      throw new GoneException('This invite code has already been fully used')
    }
  }

  private statusFor(row: {
    disabledAt: Date | null
    expiresAt: Date | null
    uses: number
    maxUses: number
  }): 'active' | 'disabled' | 'expired' | 'exhausted' {
    if (row.disabledAt) return 'disabled'
    if (row.expiresAt && row.expiresAt < new Date()) return 'expired'
    if (row.uses >= row.maxUses) return 'exhausted'
    return 'active'
  }
}
