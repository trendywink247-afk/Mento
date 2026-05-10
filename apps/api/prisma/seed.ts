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
    console.log('[seed] Admin user already exists, skipping.')
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
