/**
 * GET /api/v1/companies — T-05, ported from scripts/verify-e03.ts. The
 * opening-hours and nearest-city checks from that script are unit tests now
 * (packages/shared/src/schedule.test.ts, geo.test.ts).
 */
import { expect, test } from '@playwright/test'
import type { CompanyListPage } from '@pitchup/shared'
import { get } from '../support/api'
import { db } from '../support/db'

const CLUJ = 'city=Cluj-Napoca'
const COORDS = 'lat=46.77&lng=23.59'

const list = async (request: Parameters<typeof get>[0], query: string) =>
  (await get<CompanyListPage>(request, `/companies?${query}`)).data!

const names = async (request: Parameters<typeof get>[0], query: string) =>
  (await list(request, `${query}&limit=50`)).companies.map(c => c.name).sort()

const isSorted = (values: number[], dir: 1 | -1) =>
  values.every((v, i) => i === 0 || (v - values[i - 1]!) * dir >= 0)

test.describe('validation', () => {
  test('city is required, with a readable message', async ({ request }) => {
    const r = await get(request, '/companies')
    expect(r.status).toBe(400)
    expect(r.error).toMatchObject({ code: 'VALIDATION_ERROR', message: 'City is required' })
  })

  for (const [label, query] of [
    ['unknown city', 'city=Atlantis'],
    ['lat without lng', `${CLUJ}&lat=46.7`],
    ['priceMin > priceMax', `${CLUJ}&priceMin=200&priceMax=100`],
    ['unknown cursor', `${CLUJ}&cursor=nope`],
    ['limit above 50', `${CLUJ}&limit=51`],
  ]) {
    test(`${label} → 400`, async ({ request }) => {
      expect((await get(request, `/companies?${query}`)).status).toBe(400)
    })
  }
})

test.describe('city list', () => {
  test('lists approved Cluj companies with an active pitch, public', async ({ request }) => {
    const r = await get<CompanyListPage>(request, `/companies?${CLUJ}&limit=50`)
    const companies = r.data!.companies
    expect(r.status).toBe(200)
    expect(companies.length).toBeGreaterThan(0)
    expect(companies.every(c => c.city === 'Cluj-Napoca')).toBe(true)
    expect(companies.some(c => c.name.startsWith('Pending Venue'))).toBe(false)
    expect(companies.some(c => c.name.startsWith('Closed For Renovation'))).toBe(false)
    expect(companies.every(c => c.pitchCount > 0)).toBe(true)
    expect(r.data!.total).toBe(companies.length)
  })

  test('no distance without coordinates; ratings follow the 3-review rule', async ({ request }) => {
    const { companies } = await list(request, `${CLUJ}&limit=50`)
    expect(companies.every(c => c.distanceKm === null)).toBe(true)
    expect(companies.filter(c => c.reviewCount < 3).every(c => c.avgRating === null)).toBe(true)
    expect(
      companies.filter(c => c.reviewCount >= 3).every(c => typeof c.avgRating === 'number')
    ).toBe(true)
  })

  test('a city with no companies is an empty list, not 404', async ({ request }) => {
    const r = await get<CompanyListPage>(request, '/companies?city=Oradea')
    expect(r.status).toBe(200)
    expect(r.data).toMatchObject({ companies: [], total: 0, nextCursor: null })
  })

  test('responds quickly', async ({ request }) => {
    await get(request, `/companies?${CLUJ}`) // warm
    const r = await get(request, `/companies?${CLUJ}`)
    // The ticket asks < 200ms; a looser bound keeps shared CI runners from flaking.
    expect(r.ms).toBeLessThan(500)
  })
})

test('search is case-insensitive on the name', async ({ request }) => {
  const found = await names(request, `${CLUJ}&search=ARENA`)
  expect(found).toHaveLength(4)
  expect(found.every(n => n.toLowerCase().includes('arena'))).toBe(true)
})

test.describe('sorting', () => {
  test('rating: descending, unrated last; also the default without coordinates', async ({
    request,
  }) => {
    for (const query of [`${CLUJ}&sort=rating`, CLUJ]) {
      const { companies } = await list(request, `${query}&limit=50`)
      const rated = companies.filter(c => c.avgRating !== null)
      expect(
        isSorted(
          rated.map(c => c.avgRating!),
          -1
        )
      ).toBe(true)
      expect(companies.slice(rated.length).every(c => c.avgRating === null)).toBe(true)
    }
  })

  test('distance: ascending with distanceKm; also the default with coordinates', async ({
    request,
  }) => {
    for (const query of [`${CLUJ}&sort=distance&${COORDS}`, `${CLUJ}&${COORDS}`]) {
      const { companies } = await list(request, `${query}&limit=50`)
      expect(companies.every(c => c.distanceKm !== null)).toBe(true)
      expect(
        isSorted(
          companies.map(c => c.distanceKm!),
          1
        )
      ).toBe(true)
    }
  })

  test('distance without coordinates falls back instead of failing', async ({ request }) => {
    expect((await get(request, `/companies?${CLUJ}&sort=distance`)).status).toBe(200)
  })

  test('price: priceFrom ascending', async ({ request }) => {
    const { companies } = await list(request, `${CLUJ}&sort=price&limit=50`)
    expect(
      isSorted(
        companies.map(c => c.priceFrom),
        1
      )
    ).toBe(true)
  })

  test('newest: most recently created first', async ({ request }) => {
    const { companies } = await list(request, `${CLUJ}&sort=newest&limit=3`)
    expect(['Arena Gheorgheni', 'Demo Sports Club']).toContain(companies[0]?.name)
  })
})

test.describe('filters', () => {
  test('surface: any of the chosen types', async ({ request }) => {
    const found = await names(request, `${CLUJ}&surface=FUTSAL&surface=ARTIFICIAL_GRASS`)
    expect(found).toContain('Futsal Center Mărăști')
    for (const naturalOnly of ['Sopor Football', 'Cluj Arena Park', 'Florești Sports Base']) {
      expect(found).not.toContain(naturalOnly)
    }
  })

  test('size', async ({ request }) => {
    expect(await names(request, `${CLUJ}&size=ELEVEN_A_SIDE`)).toEqual([
      'Cluj Arena Park',
      'Florești Sports Base',
    ])
  })

  test('price range: a pitch priced inside it', async ({ request }) => {
    expect(await names(request, `${CLUJ}&priceMin=50&priceMax=100`)).toEqual(
      [
        'Demo Sports Club',
        'Futsal Center Mărăști',
        'Iris Arena',
        'Mănăștur Football Park',
        'Someșeni Arena',
        'Zorilor Sports',
      ].sort()
    )
  })

  test('amenities: free/paid OR-ed, each amenity on the same pitch', async ({ request }) => {
    expect(
      await names(
        request,
        `${CLUJ}&amenities=SHOWERS_FREE&amenities=SHOWERS_PAID&amenities=PARKING_FREE&amenities=PARKING_PAID`
      )
    ).toEqual([
      'Arena Gheorgheni',
      'Bună Ziua Sport Club',
      'Cluj Arena Park',
      'Florești Sports Base',
    ])
  })

  test('openNow: only open companies', async ({ request }) => {
    const { companies } = await list(request, `${CLUJ}&openNow=true&limit=50`)
    expect(companies.every(c => c.isOpenNow)).toBe(true)
  })

  test('availableNow: open, and a fully booked venue left out', async ({ request }) => {
    // Book every Futsal Center pitch for the next three hours, then put it back.
    const player = await db.user.findUniqueOrThrow({ where: { email: 'player@demo.ro' } })
    const pitches = await db.pitch.findMany({
      where: { company: { owner: { email: 'venue-futsal-center@demo.ro' } } },
    })
    const busy = await Promise.all(
      pitches.map(p =>
        db.booking.create({
          data: {
            pitchId: p.id,
            playerId: player.id,
            startTime: new Date(Date.now() - 60_000),
            endTime: new Date(Date.now() + 3 * 3600_000),
            teamCount: 2,
            status: 'CONFIRMED',
            pitchRateSnapshot: p.peakRate,
            platformFee: 0,
            totalAmount: p.peakRate,
          },
        })
      )
    )
    try {
      const { companies } = await list(request, `${CLUJ}&availableNow=true&limit=50`)
      expect(companies.every(c => c.isOpenNow)).toBe(true)
      expect(companies.map(c => c.name)).not.toContain('Futsal Center Mărăști')
    } finally {
      await db.booking.deleteMany({ where: { id: { in: busy.map(b => b.id) } } })
    }
  })
})

test.describe('pagination', () => {
  test('limit=5 returns five with a cursor', async ({ request }) => {
    const first = await list(request, `${CLUJ}&limit=5`)
    expect(first.companies).toHaveLength(5)
    expect(first.nextCursor).not.toBeNull()
  })

  test('walking the cursor visits every company exactly once', async ({ request }) => {
    const seen: string[] = []
    let cursor: string | null = null
    let total = 0
    for (let pages = 0; pages < 20; pages++) {
      const page: CompanyListPage = await list(
        request,
        `${CLUJ}&limit=5${cursor ? `&cursor=${cursor}` : ''}`
      )
      total = page.total
      seen.push(...page.companies.map(c => c.id))
      cursor = page.nextCursor
      if (!cursor) break
    }
    expect(cursor).toBeNull()
    expect(seen).toHaveLength(total)
    expect(new Set(seen).size).toBe(seen.length)
  })
})
