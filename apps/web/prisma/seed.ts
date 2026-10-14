/**
 * Database seed — ticket E01-03.
 *
 * Idempotent: every write is an upsert, so running this twice is safe.
 * Dev fixtures (demo company + pitch) are skipped when NODE_ENV=production.
 */
import {
  PrismaClient,
  Role,
  CompanyStatus,
  SurfaceType,
  PitchSize,
  BookingStatus,
  type AmenityType,
} from '@prisma/client'
import bcrypt from 'bcryptjs'
import { AUTH, CITIES, DEFAULT_COUNTRY, PLATFORM_FEE_PERCENT } from '@pitchup/shared'

const prisma = new PrismaClient()

const DEFAULT_ADMIN_PASSWORD = 'Admin1234!'

async function seedCities(): Promise<void> {
  for (const city of CITIES) {
    await prisma.city.upsert({
      where: { name: city.name },
      update: {},
      create: { name: city.name, county: city.county, country: DEFAULT_COUNTRY },
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
  const passwordHash = await bcrypt.hash(password ?? DEFAULT_ADMIN_PASSWORD, AUTH.BCRYPT_COST)

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

  const passwordHash = await bcrypt.hash('Manager1234!', AUTH.BCRYPT_COST)
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
    // Coordinates and hours are set on update too, so a database seeded
    // before E03 gains them and the club shows up on the Discover map.
    update: { lat: 46.7694, lng: 23.5899, workingHours: daily('08:00', '23:00') },
    create: {
      ownerId: manager.id,
      name: 'Demo Sports Club',
      phone: '+40700000001',
      email: 'contact@demo.ro',
      addressLine1: 'Strada Demo 1',
      city: 'Cluj-Napoca',
      country: 'RO',
      lat: 46.7694,
      lng: 23.5899,
      workingHours: daily('08:00', '23:00'),
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

/** Same hours every day of the week, in WorkingHoursSchema's shape. */
function daily(openTime: string, closeTime: string) {
  return [0, 1, 2, 3, 4, 5, 6].map(day => ({ day, openTime, closeTime, isClosed: false }))
}

interface DemoPitch {
  name: string
  surface: SurfaceType
  size: PitchSize
  offPeak: number
  peak: number
  amenities: AmenityType[]
  isActive?: boolean
}

interface DemoVenue {
  slug: string
  name: string
  city: string
  address: string
  lat: number
  lng: number
  hours: ReturnType<typeof daily>
  status?: CompanyStatus
  pitches: DemoPitch[]
  /** One completed booking + review per rating, spread over the first pitch(es). */
  ratings?: number[]
  /** Book the first pitch from now for three hours, to exercise availableNow. */
  busyNow?: boolean
}

const { NATURAL_GRASS, ARTIFICIAL_GRASS, FUTSAL } = SurfaceType
const { FIVE_A_SIDE, SEVEN_A_SIDE, ELEVEN_A_SIDE } = PitchSize

/**
 * Enough venues in Cluj-Napoca to page through (limit=5), sort meaningfully,
 * and cluster on the map, plus a few that must never appear in Discover
 * (pending, no active pitch) and two in another city. E03.
 */
const DEMO_VENUES: DemoVenue[] = [
  {
    slug: 'gheorgheni',
    name: 'Arena Gheorgheni',
    city: 'Cluj-Napoca',
    address: 'Str. Alexandru Vaida Voevod 50',
    lat: 46.7716,
    lng: 23.637,
    hours: daily('08:00', '23:00'),
    pitches: [
      {
        name: 'Teren 1',
        surface: ARTIFICIAL_GRASS,
        size: FIVE_A_SIDE,
        offPeak: 120,
        peak: 160,
        amenities: ['SHOWERS_FREE', 'CHANGING_ROOMS', 'PARKING_FREE', 'NIGHT_LIGHTING'],
      },
      {
        name: 'Teren 2',
        surface: ARTIFICIAL_GRASS,
        size: SEVEN_A_SIDE,
        offPeak: 180,
        peak: 240,
        amenities: ['SHOWERS_FREE', 'CHANGING_ROOMS', 'NIGHT_LIGHTING'],
      },
    ],
    ratings: [5, 5, 4, 5, 4],
  },
  {
    slug: 'manastur',
    name: 'Mănăștur Football Park',
    city: 'Cluj-Napoca',
    address: 'Calea Mănăștur 82',
    lat: 46.7578,
    lng: 23.5537,
    hours: daily('09:00', '22:00'),
    pitches: [
      {
        name: 'Main',
        surface: ARTIFICIAL_GRASS,
        size: SEVEN_A_SIDE,
        offPeak: 90,
        peak: 130,
        amenities: ['PARKING_PAID', 'NIGHT_LIGHTING', 'BALL_RENTAL_PAID'],
      },
    ],
    ratings: [4, 3, 4],
  },
  {
    slug: 'cluj-arena-park',
    name: 'Cluj Arena Park',
    city: 'Cluj-Napoca',
    address: 'Aleea Stadionului 2',
    lat: 46.7686,
    lng: 23.5714,
    hours: daily('07:00', '23:00'),
    pitches: [
      {
        name: 'Stadion',
        surface: NATURAL_GRASS,
        size: ELEVEN_A_SIDE,
        offPeak: 450,
        peak: 600,
        amenities: [
          'SHOWERS_FREE',
          'CHANGING_ROOMS',
          'LOCKERS',
          'REFEREE',
          'FIRST_AID',
          'PARKING_FREE',
          'NIGHT_LIGHTING',
        ],
      },
      {
        name: 'Antrenament',
        surface: NATURAL_GRASS,
        size: SEVEN_A_SIDE,
        offPeak: 220,
        peak: 300,
        amenities: ['SHOWERS_FREE', 'CHANGING_ROOMS'],
      },
    ],
    ratings: [5, 4, 5, 5, 5, 4],
  },
  {
    slug: 'futsal-center',
    name: 'Futsal Center Mărăști',
    city: 'Cluj-Napoca',
    address: 'Str. Fabricii 12',
    lat: 46.7802,
    lng: 23.6143,
    hours: daily('00:00', '00:00'),
    pitches: [
      {
        name: 'Sala A',
        surface: FUTSAL,
        size: FIVE_A_SIDE,
        offPeak: 100,
        peak: 140,
        amenities: ['SHOWERS_FREE', 'CHANGING_ROOMS', 'WIFI', 'REFRESHMENTS', 'WHEELCHAIR'],
      },
      {
        name: 'Sala B',
        surface: FUTSAL,
        size: FIVE_A_SIDE,
        offPeak: 100,
        peak: 140,
        amenities: ['SHOWERS_FREE', 'CHANGING_ROOMS'],
      },
    ],
    ratings: [4, 5, 4, 4],
    busyNow: true,
  },
  {
    slug: 'zorilor',
    name: 'Zorilor Sports',
    city: 'Cluj-Napoca',
    address: 'Str. Observatorului 34',
    lat: 46.7531,
    lng: 23.5904,
    hours: daily('10:00', '22:00'),
    pitches: [
      {
        name: 'Teren mic',
        surface: ARTIFICIAL_GRASS,
        size: FIVE_A_SIDE,
        offPeak: 70,
        peak: 100,
        amenities: ['NIGHT_LIGHTING'],
      },
    ],
    ratings: [3, 4],
  },
  {
    slug: 'buna-ziua',
    name: 'Bună Ziua Sport Club',
    city: 'Cluj-Napoca',
    address: 'Str. Bună Ziua 41',
    lat: 46.7434,
    lng: 23.6011,
    hours: daily('08:00', '20:00'),
    pitches: [
      {
        name: 'Teren 1',
        surface: ARTIFICIAL_GRASS,
        size: SEVEN_A_SIDE,
        offPeak: 150,
        peak: 190,
        amenities: ['PARKING_FREE', 'SHOWERS_PAID', 'CHANGING_ROOMS'],
      },
    ],
  },
  {
    slug: 'iris',
    name: 'Iris Arena',
    city: 'Cluj-Napoca',
    address: 'Str. Oașului 120',
    lat: 46.7958,
    lng: 23.6162,
    hours: daily('16:00', '02:00'),
    pitches: [
      {
        name: 'Teren nocturn',
        surface: ARTIFICIAL_GRASS,
        size: FIVE_A_SIDE,
        offPeak: 80,
        peak: 110,
        amenities: ['NIGHT_LIGHTING', 'REFRESHMENTS', 'PARKING_FREE'],
      },
    ],
    ratings: [5, 4, 4],
  },
  {
    slug: 'sopor',
    name: 'Sopor Football',
    city: 'Cluj-Napoca',
    address: 'Str. Sopor 5',
    lat: 46.7925,
    lng: 23.6359,
    hours: daily('08:00', '22:00'),
    pitches: [
      {
        name: 'Teren A',
        surface: NATURAL_GRASS,
        size: SEVEN_A_SIDE,
        offPeak: 200,
        peak: 260,
        amenities: ['SHOWERS_FREE', 'CHANGING_ROOMS', 'BALL_RENTAL_FREE'],
      },
    ],
  },
  {
    slug: 'grigorescu',
    name: 'Grigorescu Sport Hall',
    city: 'Cluj-Napoca',
    address: 'Str. Donath 15',
    lat: 46.7681,
    lng: 23.5596,
    hours: daily('08:00', '22:00'),
    pitches: [
      {
        name: 'Sala',
        surface: FUTSAL,
        size: FIVE_A_SIDE,
        offPeak: 130,
        peak: 160,
        amenities: ['SHOWERS_FREE', 'LOCKERS', 'WIFI'],
      },
    ],
    ratings: [2, 3, 3, 2],
  },
  {
    slug: 'someseni',
    name: 'Someșeni Arena',
    city: 'Cluj-Napoca',
    address: 'Str. Traian Vuia 98',
    lat: 46.7764,
    lng: 23.6658,
    hours: daily('09:00', '21:00'),
    pitches: [
      {
        name: 'Teren 1',
        surface: ARTIFICIAL_GRASS,
        size: SEVEN_A_SIDE,
        offPeak: 110,
        peak: 140,
        amenities: ['PARKING_FREE'],
      },
      {
        name: 'Teren 2',
        surface: ARTIFICIAL_GRASS,
        size: FIVE_A_SIDE,
        offPeak: 60,
        peak: 90,
        amenities: ['PARKING_FREE'],
      },
    ],
  },
  {
    slug: 'centru',
    name: 'Centru Five-a-side',
    city: 'Cluj-Napoca',
    address: 'Str. Memorandumului 21',
    lat: 46.7699,
    lng: 23.5862,
    hours: daily('12:00', '23:59'),
    pitches: [
      {
        name: 'Rooftop',
        surface: ARTIFICIAL_GRASS,
        size: FIVE_A_SIDE,
        offPeak: 140,
        peak: 180,
        amenities: ['SHOWERS_FREE', 'CHANGING_ROOMS', 'REFRESHMENTS', 'WIFI'],
      },
    ],
    ratings: [5, 5, 5],
  },
  {
    slug: 'floresti',
    name: 'Florești Sports Base',
    city: 'Cluj-Napoca',
    address: 'Str. Avram Iancu 400, Florești',
    lat: 46.7476,
    lng: 23.4904,
    hours: daily('08:00', '22:00'),
    pitches: [
      {
        name: 'Teren mare',
        surface: NATURAL_GRASS,
        size: ELEVEN_A_SIDE,
        offPeak: 350,
        peak: 450,
        amenities: ['CHANGING_ROOMS', 'SHOWERS_FREE', 'PARKING_FREE', 'REFEREE'],
      },
    ],
  },
  {
    slug: 'pending',
    name: 'Pending Venue (hidden)',
    city: 'Cluj-Napoca',
    address: 'Str. Ascunsă 1',
    lat: 46.77,
    lng: 23.6,
    hours: daily('08:00', '22:00'),
    status: CompanyStatus.PENDING,
    pitches: [
      {
        name: 'Teren',
        surface: ARTIFICIAL_GRASS,
        size: FIVE_A_SIDE,
        offPeak: 50,
        peak: 60,
        amenities: [],
      },
    ],
  },
  {
    slug: 'inactive',
    name: 'Closed For Renovation (hidden)',
    city: 'Cluj-Napoca',
    address: 'Str. Renovării 3',
    lat: 46.775,
    lng: 23.61,
    hours: daily('08:00', '22:00'),
    pitches: [
      {
        name: 'Teren',
        surface: ARTIFICIAL_GRASS,
        size: FIVE_A_SIDE,
        offPeak: 50,
        peak: 60,
        amenities: [],
        isActive: false,
      },
    ],
  },
  {
    slug: 'herastrau',
    name: 'Herăstrău Football Club',
    city: 'București',
    address: 'Șos. Nordului 7',
    lat: 44.4746,
    lng: 26.0838,
    hours: daily('07:00', '23:00'),
    pitches: [
      {
        name: 'Teren 1',
        surface: NATURAL_GRASS,
        size: SEVEN_A_SIDE,
        offPeak: 250,
        peak: 320,
        amenities: ['SHOWERS_FREE', 'CHANGING_ROOMS', 'PARKING_PAID'],
      },
    ],
    ratings: [4, 5, 4],
  },
  {
    slug: 'tineretului',
    name: 'Tineretului Arena',
    city: 'București',
    address: 'Bd. Tineretului 10',
    lat: 44.4097,
    lng: 26.1057,
    hours: daily('08:00', '22:00'),
    pitches: [
      {
        name: 'Sala',
        surface: FUTSAL,
        size: FIVE_A_SIDE,
        offPeak: 120,
        peak: 150,
        amenities: ['SHOWERS_FREE'],
      },
    ],
  },
]

const HOUR = 60 * 60 * 1000

/**
 * Creates each venue on the first run and leaves it alone afterwards, so a
 * re-seed does not duplicate pitches, bookings or reviews.
 */
async function seedDiscoverFixtures(): Promise<void> {
  if (process.env.NODE_ENV === 'production') return

  const passwordHash = await bcrypt.hash('Player1234!', AUTH.BCRYPT_COST)
  const player = await prisma.user.upsert({
    where: { email: 'player@demo.ro' },
    update: {},
    create: {
      email: 'player@demo.ro',
      phone: '+40700000002',
      passwordHash,
      name: 'Demo Player',
      city: 'Cluj-Napoca',
      emailVerified: true,
      phoneVerified: true,
    },
  })

  let created = 0
  for (const [index, venue] of DEMO_VENUES.entries()) {
    const manager = await prisma.user.upsert({
      where: { email: `venue-${venue.slug}@demo.ro` },
      update: {},
      create: {
        email: `venue-${venue.slug}@demo.ro`,
        phone: `+4070000${String(100 + index).padStart(4, '0')}`,
        passwordHash,
        name: `${venue.name} Manager`,
        role: Role.MANAGER,
        city: venue.city,
        emailVerified: true,
        phoneVerified: true,
      },
    })

    const existing = await prisma.company.findUnique({ where: { ownerId: manager.id } })
    if (existing) continue

    const company = await prisma.company.create({
      data: {
        ownerId: manager.id,
        name: venue.name,
        phone: manager.phone,
        email: manager.email,
        addressLine1: venue.address,
        city: venue.city,
        lat: venue.lat,
        lng: venue.lng,
        workingHours: venue.hours,
        status: venue.status ?? CompanyStatus.ACTIVE,
        // Spread creation dates so "Newest" has an order to show.
        createdAt: new Date(Date.now() - index * 7 * 24 * HOUR),
      },
    })

    const pitches = []
    for (const p of venue.pitches) {
      pitches.push(
        await prisma.pitch.create({
          data: {
            companyId: company.id,
            name: p.name,
            surfaceType: p.surface,
            size: p.size,
            offPeakRate: p.offPeak,
            peakRate: p.peak,
            isActive: p.isActive ?? true,
            amenities: { create: p.amenities.map(amenityType => ({ amenityType })) },
          },
        })
      )
    }

    for (const [i, rating] of (venue.ratings ?? []).entries()) {
      const pitch = pitches[i % pitches.length]!
      const start = new Date(Date.now() - (i + 2) * 24 * HOUR)
      const booking = await prisma.booking.create({
        data: {
          pitchId: pitch.id,
          playerId: player.id,
          startTime: start,
          endTime: new Date(start.getTime() + HOUR),
          teamCount: 2,
          status: BookingStatus.COMPLETED,
          pitchRateSnapshot: pitch.offPeakRate,
          platformFee: Number(pitch.offPeakRate) * (PLATFORM_FEE_PERCENT / 100),
          totalAmount: Number(pitch.offPeakRate) * (1 + PLATFORM_FEE_PERCENT / 100),
        },
      })
      await prisma.review.create({
        data: { bookingId: booking.id, pitchId: pitch.id, playerId: player.id, rating },
      })
    }

    if (venue.busyNow) {
      // Every pitch is taken for the next three hours.
      for (const pitch of pitches) {
        await prisma.booking.create({
          data: {
            pitchId: pitch.id,
            playerId: player.id,
            startTime: new Date(),
            endTime: new Date(Date.now() + 3 * HOUR),
            teamCount: 2,
            status: BookingStatus.CONFIRMED,
            pitchRateSnapshot: pitch.peakRate,
            platformFee: 0,
            totalAmount: pitch.peakRate,
          },
        })
      }
    }
    created++
  }
  console.log(`✓ Discover fixtures seeded (${created} new venues, player@demo.ro)`)
}

async function main(): Promise<void> {
  console.log('Seeding database…')
  await seedCities()
  await seedAdmin()
  await seedDevFixtures()
  await seedDiscoverFixtures()
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
