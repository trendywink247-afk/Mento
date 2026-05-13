// Seed script — bootstraps an admin user from env on first run.
// Usage: pnpm --filter @mento/api db:seed
import { PrismaClient, Role, UserStatus } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL
  const phone = process.env.ADMIN_BOOTSTRAP_PHONE
  if (!email && !phone) {
    console.log('[seed] No ADMIN_BOOTSTRAP_EMAIL/PHONE set — skipping admin bootstrap.')
    return
  }
  const existing = await prisma.user.findFirst({
    where: { OR: [email ? { email } : {}, phone ? { phone } : {}].filter(Boolean) as never },
  })
  if (existing) {
    if (existing.role === Role.ADMIN && existing.status === UserStatus.ACTIVE) {
      console.log(`[seed] Admin user already correctly configured (${existing.id})`)
      return
    }
    // The user exists but isn't ADMIN — most commonly because OTP-verify created them
    // as ASPIRANT first. Promote idempotently so e2e tests can rely on /admin/* access.
    const promoted = await prisma.user.update({
      where: { id: existing.id },
      data: { role: Role.ADMIN, status: UserStatus.ACTIVE },
    })
    console.log(`[seed] Promoted existing user ${promoted.id} → ADMIN`)
    return
  }
  const admin = await prisma.user.create({
    data: {
      email,
      phone,
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
      profile: {
        create: {
          displayHandle: 'Mento_Admin',
          avatarLetter: 'F',
          avatarColor: 'GOLD',
          hasPurpleTick: true,
        },
      },
    },
  })
  console.log(`[seed] Created admin user ${admin.id}`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (err) => {
    console.error(err)
    await prisma.$disconnect()
    process.exit(1)
  })
