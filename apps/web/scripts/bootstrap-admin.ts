/**
 * Makes an existing account an admin — E15-10.
 *
 *   pnpm --filter @pitchup/web admin:bootstrap someone@example.com
 *
 * The person registers first (so they verified their email and chose their
 * own password); this only changes the role. A venue manager can't be
 * promoted: their venue hangs off the account.
 */
import { PrismaClient } from '@prisma/client'

async function main() {
  const email = process.argv[2]?.trim().toLowerCase()
  if (!email) {
    console.error('Usage: admin:bootstrap <email>')
    process.exit(1)
  }
  const prisma = new PrismaClient()
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        role: true,
        deletedAt: true,
        company: { select: { id: true } },
      },
    })
    if (!user || user.deletedAt) {
      console.error(`No account for ${email}. They need to register first.`)
      process.exit(1)
    }
    if (user.company) {
      console.error(`${email} manages a venue; use a separate account for admin work.`)
      process.exit(1)
    }
    if (user.role === 'ADMIN') {
      console.warn(`${user.name} (${email}) is already an admin.`)
      return
    }
    await prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } })
    console.warn(`✓ ${user.name} (${email}) is now an admin. They sign in again to see the panel.`)
  } finally {
    await prisma.$disconnect()
  }
}

void main()
