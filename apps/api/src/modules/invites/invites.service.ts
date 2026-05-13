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
    await this.prisma.$transaction(async (tx) => {
      // Step 1: surface non-quantitative errors (not found, disabled, expired) with
      // clear error messages, since the atomic update below won't tell us *which*
      // condition failed if it returns 0 rows.
      const row = await tx.inviteCode.findUnique({ where: { code } })
      if (!row) throw new NotFoundException('Invite code not found')
      this.assertUsable(row)

      // Step 2: atomic uses+1 with a WHERE guard that PostgreSQL evaluates in the
      // same statement, so two concurrent redemptions of a 1-use code cannot both
      // succeed — the second UPDATE will affect 0 rows and throw.
      const updated = await tx.$executeRaw`
        UPDATE "InviteCode"
        SET "uses" = "uses" + 1
        WHERE "id"::text = ${row.id}
          AND "uses" < "maxUses"
          AND "disabledAt" IS NULL
          AND ("expiresAt" IS NULL OR "expiresAt" > NOW())
      `
      if (updated === 0) {
        throw new GoneException('Invite code has been exhausted or disabled')
      }

      // Step 3: one redemption per user (@@unique([userId])). If two signups by
      // the same user race, the unique constraint will fail one of them — we
      // surface that as a clean ConflictException. Other errors (connectivity,
      // schema drift) bubble so they don't get misreported as a user conflict.
      try {
        await tx.inviteRedemption.create({
          data: { inviteCodeId: row.id, userId },
        })
      } catch (err) {
        const isUniqueViolation =
          typeof err === 'object' &&
          err !== null &&
          (err as { code?: string }).code === 'P2002'
        if (isUniqueViolation) {
          throw new ConflictException('User has already redeemed an invite code')
        }
        throw err
      }
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
