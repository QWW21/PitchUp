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
import {
  AUTH,
  CITIES,
  DEFAULT_COUNTRY,
  PLATFORM_FEE_PERCENT,
  addDays,
  toMinutes,
  venueClock,
  venueTimeToUtc,
} from '@pitchup/shared'

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
  // `||`, not `??`: a blank ADMIN_PASSWORD= in .env must not seed an empty password.
  const passwordHash = await bcrypt.hash(password || DEFAULT_ADMIN_PASSWORD, AUTH.BCRYPT_COST)

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
        hourlyRate: 60,
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
  /** RON per hour, at any time of day. */
  rate: number
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
const { FIVE_A_SIDE, SIX_A_SIDE, SEVEN_A_SIDE, ELEVEN_A_SIDE } = PitchSize

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
        rate: 120,
        amenities: ['SHOWERS_FREE', 'CHANGING_ROOMS', 'PARKING_FREE', 'NIGHT_LIGHTING'],
      },
      {
        name: 'Teren 2',
        surface: ARTIFICIAL_GRASS,
        size: SEVEN_A_SIDE,
        rate: 180,
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
        rate: 90,
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
        rate: 450,
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
        rate: 220,
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
        rate: 100,
        amenities: ['SHOWERS_FREE', 'CHANGING_ROOMS', 'WIFI', 'REFRESHMENTS', 'WHEELCHAIR'],
      },
      {
        name: 'Sala B',
        surface: FUTSAL,
        size: FIVE_A_SIDE,
        rate: 100,
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
        size: SIX_A_SIDE,
        rate: 70,
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
        rate: 150,
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
        size: SIX_A_SIDE,
        rate: 80,
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
        rate: 200,
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
        rate: 130,
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
        rate: 110,
        amenities: ['PARKING_FREE'],
      },
      {
        name: 'Teren 2',
        surface: ARTIFICIAL_GRASS,
        size: FIVE_A_SIDE,
        rate: 60,
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
        rate: 140,
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
        rate: 350,
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
        rate: 50,
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
        rate: 50,
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
        rate: 250,
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
        rate: 120,
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
            hourlyRate: p.rate,
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
          pitchRateSnapshot: pitch.hourlyRate,
          platformFee: Number(pitch.hourlyRate) * (PLATFORM_FEE_PERCENT / 100),
          totalAmount: Number(pitch.hourlyRate) * (1 + PLATFORM_FEE_PERCENT / 100),
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
            pitchRateSnapshot: pitch.hourlyRate,
            platformFee: 0,
            totalAmount: pitch.hourlyRate,
          },
        })
      }
    }
    created++
  }
  console.log(`✓ Discover fixtures seeded (${created} new venues, player@demo.ro)`)
}

const DIMENSIONS: Record<PitchSize, [number, number] | null> = {
  FIVE_A_SIDE: [25, 40],
  SIX_A_SIDE: [30, 50],
  SEVEN_A_SIDE: [40, 60],
  ELEVEN_A_SIDE: [68, 105],
  CUSTOM: null,
}

const REVIEW_TEXTS = [
  'Great surface and friendly staff. Lights were on well before kick-off.',
  'Good pitch, changing rooms could be cleaner.',
  null,
  'Booked last minute and everything was ready. Will be back.',
  'Nets had a few holes, otherwise fine.',
  'Excellent value for the price. Parking is easy.',
  'Our regular Thursday game. Never had a problem.',
]

/**
 * Pitch-detail data for the Discover venues — E04. Fills in what the E03
 * fixtures left empty, and only where it is still empty, so it is safe on a
 * database seeded before E04 and on a re-run.
 */
async function seedDetailFixtures(): Promise<void> {
  if (process.env.NODE_ENV === 'production') return

  const player = await prisma.user.findUnique({ where: { email: 'player@demo.ro' } })
  if (!player) return

  let photos = 0
  for (const venue of DEMO_VENUES) {
    const company = await prisma.company.findFirst({
      where: { owner: { email: `venue-${venue.slug}@demo.ro` } },
      include: { pitches: { orderBy: { name: 'asc' } } },
    })
    if (!company) continue

    if (!company.description) {
      await prisma.company.update({
        where: { id: company.id },
        data: {
          description: `${venue.name} — ${venue.pitches.length} ${venue.pitches.length === 1 ? 'pitch' : 'pitches'} in ${venue.city}, open to teams and casual groups. Book online, pay on the spot.`,
          websiteUrl: `https://${venue.slug}.example.ro`,
        },
      })
    }

    for (const [i, pitch] of company.pitches.entries()) {
      if (!pitch.description) {
        const dims = DIMENSIONS[pitch.size]
        const shirts = i === 0 && !!venue.pitches[0]?.amenities.includes('CHANGING_ROOMS')
        await prisma.pitch.update({
          where: { id: pitch.id },
          data: {
            description:
              `${pitch.name} is a well-kept ${pitch.surfaceType === 'FUTSAL' ? 'indoor futsal court' : 'outdoor pitch'} ` +
              'with fresh markings and full-size goals. Floodlit in the evening, with seating for substitutes along the touchline. ' +
              'Bring flat or moulded studs; metal studs are not allowed. Balls can be borrowed at reception. ' +
              'Please arrive ten minutes early so the previous game can finish on time.',
            widthMeters: dims?.[0] ?? null,
            lengthMeters: dims?.[1] ?? null,
            hasShirts: shirts,
          },
        })
        if (shirts) {
          for (const [colour, quantity] of [
            // Sets, one per team: free to borrow.
            ['RED', 2],
            ['BLUE', 2],
            ['YELLOW', 1],
          ] as const) {
            await prisma.shirtInventory.upsert({
              where: { pitchId_colour: { pitchId: pitch.id, colour } },
              update: {},
              create: { pitchId: pitch.id, colour, quantity },
            })
          }
        }
      }

      // Placeholder photos (stable per seed name). The inactive venue keeps
      // none, so the no-photo state has something to show.
      const hasPhotos = await prisma.pitchPhoto.count({ where: { pitchId: pitch.id } })
      if (!hasPhotos && venue.slug !== 'inactive') {
        const count = 3 + ((venue.slug.length + i) % 3)
        await prisma.pitchPhoto.createMany({
          data: Array.from({ length: count }, (_, n) => ({
            pitchId: pitch.id,
            url: `https://picsum.photos/seed/pitchup-${venue.slug}-${i}-${n}/1200/900`,
            cloudinaryPublicId: `seed/${venue.slug}-${i}-${n}`,
            order: n,
          })),
        })
        photos += count
      }
    }

    // Review text, one manager reply and one anonymous review per venue.
    const reviews = await prisma.review.findMany({
      where: { pitch: { companyId: company.id }, text: null },
      orderBy: { createdAt: 'asc' },
    })
    for (const [n, review] of reviews.entries()) {
      await prisma.review.update({
        where: { id: review.id },
        data: {
          // Leaves one in seven with a rating only, an allowed case.
          text: REVIEW_TEXTS[n % REVIEW_TEXTS.length] ?? '',
          isAnonymous: n === 1,
          ...(n === 0
            ? {
                managerReply: 'Thanks for playing with us — see you next week!',
                managerRepliedAt: new Date(),
              }
            : {}),
        },
      })
    }
  }

  // Enough reviews on one venue to page through (limit=10 → two pages).
  const arena = await prisma.company.findFirst({
    where: { owner: { email: 'venue-cluj-arena-park@demo.ro' } },
    include: { pitches: true },
  })
  if (arena) {
    const existing = await prisma.review.count({ where: { pitch: { companyId: arena.id } } })
    for (let n = existing; n < 14; n++) {
      const pitch = arena.pitches[n % arena.pitches.length]!
      const start = new Date(Date.now() - (n + 10) * 24 * HOUR)
      const booking = await prisma.booking.create({
        data: {
          pitchId: pitch.id,
          playerId: player.id,
          startTime: start,
          endTime: new Date(start.getTime() + HOUR),
          teamCount: 2,
          status: BookingStatus.COMPLETED,
          pitchRateSnapshot: pitch.hourlyRate,
          platformFee: 0,
          totalAmount: pitch.hourlyRate,
        },
      })
      await prisma.review.create({
        data: {
          bookingId: booking.id,
          pitchId: pitch.id,
          playerId: player.id,
          rating: [5, 4, 5, 3, 5, 4, 2][n % 7]!,
          text: REVIEW_TEXTS[n % REVIEW_TEXTS.length] ?? null,
          createdAt: start,
        },
      })
    }
  }

  // Availability cases on Arena Gheorgheni, Teren 1, from tomorrow (venue date).
  const gheorgheni = await prisma.company.findFirst({
    where: { owner: { email: 'venue-gheorgheni@demo.ro' } },
    include: { pitches: { orderBy: { name: 'asc' }, take: 1 } },
  })
  const teren = gheorgheni?.pitches[0]
  if (gheorgheni && teren) {
    const today = venueClock(new Date()).date
    const tomorrow = addDays(today, 1)
    const future = await prisma.booking.count({
      where: { pitchId: teren.id, startTime: { gt: new Date() } },
    })
    if (!future) {
      const at = (date: string, hhmm: string) => venueTimeToUtc(date, toMinutes(hhmm))
      const slots: [string, string, string, BookingStatus][] = [
        [tomorrow, '18:00', '20:00', BookingStatus.CONFIRMED],
        [tomorrow, '10:00', '11:00', BookingStatus.CANCELLED], // must not block
        [addDays(today, 2), '08:00', '23:00', BookingStatus.CONFIRMED], // fully booked day
      ]
      for (const [date, from, to, status] of slots) {
        await prisma.booking.create({
          data: {
            pitchId: teren.id,
            playerId: player.id,
            startTime: at(date, from),
            endTime: at(date, to),
            teamCount: 2,
            status,
            pitchRateSnapshot: teren.hourlyRate,
            platformFee: 0,
            totalAmount: teren.hourlyRate,
          },
        })
      }
    }
    // Closed for maintenance three days from now.
    await prisma.pitchException.upsert({
      where: {
        pitchId_date: { pitchId: teren.id, date: new Date(`${addDays(today, 3)}T00:00:00Z`) },
      },
      update: {},
      create: {
        pitchId: teren.id,
        date: new Date(`${addDays(today, 3)}T00:00:00Z`),
        reason: 'Pitch maintenance',
      },
    })
  }

  // Reviews made by the E03 fixtures were all stamped at seed time. Date each
  // a few hours after its game, so "newest first" has an order to show.
  const undated = await prisma.review.findMany({
    include: { booking: { select: { endTime: true } } },
  })
  for (const review of undated) {
    const when = new Date(review.booking.endTime.getTime() + 3 * HOUR)
    if (Math.abs(review.createdAt.getTime() - when.getTime()) > 60_000) {
      await prisma.review.update({ where: { id: review.id }, data: { createdAt: when } })
    }
  }

  // Zorilor closes on Sundays, for the closed-day state.
  const zorilor = await prisma.company.findFirst({
    where: { owner: { email: 'venue-zorilor@demo.ro' } },
  })
  if (zorilor) {
    await prisma.company.update({
      where: { id: zorilor.id },
      data: {
        workingHours: daily('10:00', '22:00').map(d =>
          d.day === 0 ? { ...d, isClosed: true } : d
        ),
      },
    })
  }

  console.log(`✓ Pitch detail fixtures seeded (${photos} new photos)`)
}

async function main(): Promise<void> {
  console.log('Seeding database…')
  await seedCities()
  await seedAdmin()
  await seedDevFixtures()
  await seedDiscoverFixtures()
  await seedDetailFixtures()
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
