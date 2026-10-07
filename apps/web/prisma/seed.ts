/**
 * Database seed — ticket E01-03.
 *
 * Idempotent: every write is an upsert, so running this twice is safe.
 * Dev fixtures (demo company + pitch) are skipped when NODE_ENV=production.
 */
import { PrismaClient, Role, CompanyStatus, SurfaceType, PitchSize } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const BCRYPT_COST = 12
const DEFAULT_ADMIN_PASSWORD = 'Admin1234!'

const CITIES: Array<{ name: string; county: string }> = [
  { name: 'București', county: 'București' },
  { name: 'Cluj-Napoca', county: 'Cluj' },
  { name: 'Timișoara', county: 'Timiș' },
  { name: 'Iași', county: 'Iași' },
  { name: 'Constanța', county: 'Constanța' },
  { name: 'Craiova', county: 'Dolj' },
  { name: 'Brașov', county: 'Brașov' },
  { name: 'Galați', county: 'Galați' },
  { name: 'Ploiești', county: 'Prahova' },
  { name: 'Oradea', county: 'Bihor' },
]

async function seedCities(): Promise<void> {
  for (const city of CITIES) {
    await prisma.city.upsert({
      where: { name: city.name },
      update: {},
      create: { name: city.name, county: city.county, country: 'RO' },
    })
  }
  console.log(`✓ Cities seeded (${CITIES.length})`)
}

async function seedAdmin(): Promise<void> {
  const password = process.env.ADMIN_PASSWORD
  if (!password) {
    console.warn(
      `⚠ ADMIN_PASSWORD not set — using the default dev password. Set it before seeding any shared environment.`
    )
  }
  const passwordHash = await bcrypt.hash(password ?? DEFAULT_ADMIN_PASSWORD, BCRYPT_COST)

  await prisma.user.upsert({
    where: { email: 'admin@pitchup.ro' },
    update: { passwordHash, role: Role.ADMIN },
    create: {
      email: 'admin@pitchup.ro',
      phone: '+40700000000',
      passwordHash,
      name: 'PitchUp Admin',
      role: Role.ADMIN,
      emailVerified: true,
      phoneVerified: true,
    },
  })
  console.log('✓ Admin user seeded (admin@pitchup.ro)')
}

async function seedDevFixtures(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    console.log('– Dev fixtures skipped (NODE_ENV=production)')
    return
  }

  const passwordHash = await bcrypt.hash('Manager1234!', BCRYPT_COST)
  const manager = await prisma.user.upsert({
    where: { email: 'manager@demo.ro' },
    update: {},
    create: {
      email: 'manager@demo.ro',
      phone: '+40700000001',
      passwordHash,
      name: 'Demo Manager',
      role: Role.MANAGER,
      city: 'Cluj-Napoca',
      emailVerified: true,
      phoneVerified: true,
    },
  })

  const company = await prisma.company.upsert({
    where: { ownerId: manager.id },
    update: {},
    create: {
      ownerId: manager.id,
      name: 'Demo Sports Club',
      phone: '+40700000001',
      email: 'contact@demo.ro',
      addressLine1: 'Strada Demo 1',
      city: 'Cluj-Napoca',
      country: 'RO',
      status: CompanyStatus.ACTIVE,
    },
  })

  const existingPitch = await prisma.pitch.findFirst({
    where: { companyId: company.id, name: 'Pitch A' },
  })
  if (!existingPitch) {
    await prisma.pitch.create({
      data: {
        companyId: company.id,
        name: 'Pitch A',
        surfaceType: SurfaceType.ARTIFICIAL_GRASS,
        size: PitchSize.FIVE_A_SIDE,
        offPeakRate: 60,
        peakRate: 80,
      },
    })
  }
  console.log('✓ Dev fixtures seeded (Demo Sports Club / Pitch A)')
}

async function main(): Promise<void> {
  console.log('Seeding database…')
  await seedCities()
  await seedAdmin()
  await seedDevFixtures()
  console.log('Seed complete.')
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error)
    process.exitCode = 1
  })
  .finally(() => {
    void prisma.$disconnect()
  })
