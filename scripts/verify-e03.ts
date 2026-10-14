/**
 * Re-runs the E03-01 acceptance checks against a running dev server, plus the
 * pure helpers behind Discover (opening hours, nearest city).
 *
 * Usage: cd apps/web && ./node_modules/.bin/tsx ../../scripts/verify-e03.ts
 * Needs: `pnpm db:seed` run (the Discover fixtures) and `pnpm dev` on :3000,
 * or BASE_URL pointing elsewhere.
 */
import { foldForSearch, nearestCity, type CompanyListItem } from '@pitchup/shared'
import { isOpenAt } from '../apps/web/src/lib/discover/opening-hours'

const BASE = `${process.env.BASE_URL ?? 'http://localhost:3000'}/api/v1/companies`

let pass = 0
let fail = 0
function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) pass++
  else fail++
  console.log(
    `  ${condition ? 'PASS' : 'FAIL'}  ${name}${condition ? '' : `  ${JSON.stringify(detail)}`}`
  )
}
const step = (title: string) => console.log(`\n── ${title}`)

interface Envelope {
  data: { companies: CompanyListItem[]; nextCursor: string | null; total: number } | null
  error: { code: string; message: string } | null
}

async function get(query: string): Promise<{ status: number; body: Envelope; ms: number }> {
  const started = Date.now()
  const res = await fetch(`${BASE}?${query}`)
  return { status: res.status, body: (await res.json()) as Envelope, ms: Date.now() - started }
}

async function names(query: string): Promise<string[]> {
  const { body } = await get(`${query}&limit=50`)
  return (body.data?.companies ?? []).map(c => c.name).sort()
}

const sorted = (values: number[], dir: 1 | -1) =>
  values.every((v, i) => i === 0 || (v - values[i - 1]!) * dir >= 0)

const CLUJ = 'city=Cluj-Napoca'
const COORDS = 'lat=46.77&lng=23.59'

async function main() {
  step('Validation')
  {
    const r = await get('')
    check(
      'city missing → 400 VALIDATION_ERROR "City is required"',
      r.status === 400 &&
        r.body.error?.code === 'VALIDATION_ERROR' &&
        r.body.error.message === 'City is required',
      r.body
    )
    check('unknown city → 400', (await get('city=Atlantis')).status === 400)
    check('lat without lng → 400', (await get(`${CLUJ}&lat=46.7`)).status === 400)
    check(
      'priceMin > priceMax → 400',
      (await get(`${CLUJ}&priceMin=200&priceMax=100`)).status === 400
    )
    check('unknown cursor → 400', (await get(`${CLUJ}&cursor=nope`)).status === 400)
    check('limit above 50 → 400', (await get(`${CLUJ}&limit=51`)).status === 400)
  }

  step('City list')
  {
    const r = await get(`${CLUJ}&limit=50`)
    const list = r.body.data?.companies ?? []
    check('200, public (no auth header sent)', r.status === 200)
    check(
      'every company is in Cluj-Napoca',
      list.length > 0 && list.every(c => c.city === 'Cluj-Napoca')
    )
    check('pending company excluded', !list.some(c => c.name.startsWith('Pending Venue')))
    check(
      'company with no active pitch excluded',
      !list.some(c => c.name.startsWith('Closed For Renovation'))
    )
    check(
      'no company has pitchCount 0',
      list.every(c => c.pitchCount > 0)
    )
    check('total matches list length', r.body.data?.total === list.length, r.body.data?.total)
    check(
      'distanceKm null without lat/lng',
      list.every(c => c.distanceKm === null)
    )
    check(
      'avgRating null below 3 reviews (PRD §11.2)',
      list.filter(c => c.reviewCount < 3).every(c => c.avgRating === null)
    )
    check(
      'avgRating shown at 3+ reviews',
      list.filter(c => c.reviewCount >= 3).every(c => typeof c.avgRating === 'number')
    )
    check(
      'default sort without coords is rating',
      sorted(
        list.filter(c => c.avgRating !== null).map(c => c.avgRating!),
        -1
      )
    )

    const empty = await get('city=Oradea')
    check(
      'city with no companies → empty array, not 404',
      empty.status === 200 && empty.body.data?.companies.length === 0 && empty.body.data.total === 0
    )

    const warm = await get(CLUJ)
    check(`response under 200ms (${warm.ms}ms)`, warm.ms < 200)
  }

  step('Search')
  {
    const found = await names(`${CLUJ}&search=ARENA`)
    check(
      'search=ARENA is case-insensitive on name',
      found.length === 4 && found.every(n => n.toLowerCase().includes('arena')),
      found
    )
  }

  step('Sorting')
  {
    const rating = (await get(`${CLUJ}&sort=rating&limit=50`)).body.data!.companies
    const rated = rating.filter(c => c.avgRating !== null)
    check(
      'sort=rating: descending, unrated last',
      sorted(
        rated.map(c => c.avgRating!),
        -1
      ) && rating.slice(rated.length).every(c => c.avgRating === null)
    )

    const dist = (await get(`${CLUJ}&sort=distance&${COORDS}&limit=50`)).body.data!.companies
    check(
      'sort=distance: ascending, distanceKm populated',
      dist.every(c => c.distanceKm !== null) &&
        sorted(
          dist.map(c => c.distanceKm!),
          1
        )
    )

    const def = (await get(`${CLUJ}&${COORDS}&limit=50`)).body.data!.companies
    check(
      'default sort with coords is distance',
      sorted(
        def.map(c => c.distanceKm!),
        1
      )
    )

    const noCoords = await get(`${CLUJ}&sort=distance`)
    check('sort=distance without coords falls back, still 200', noCoords.status === 200)

    const price = (await get(`${CLUJ}&sort=price&limit=50`)).body.data!.companies
    check(
      'sort=price: priceFrom ascending',
      sorted(
        price.map(c => c.priceFrom),
        1
      )
    )

    const newest = (await get(`${CLUJ}&sort=newest&limit=3`)).body.data!.companies
    check(
      'sort=newest: most recently created first',
      newest[0]?.name === 'Demo Sports Club' || newest[0]?.name === 'Arena Gheorgheni',
      newest.map(c => c.name)
    )
  }

  step('Filters')
  {
    const surfaces = await names(`${CLUJ}&surface=FUTSAL&surface=ARTIFICIAL_GRASS`)
    check(
      'surface=FUTSAL|ARTIFICIAL_GRASS excludes natural-grass-only venues',
      !surfaces.includes('Sopor Football') &&
        !surfaces.includes('Cluj Arena Park') &&
        !surfaces.includes('Florești Sports Base') &&
        surfaces.includes('Futsal Center Mărăști'),
      surfaces
    )

    const size = await names(`${CLUJ}&size=ELEVEN_A_SIDE`)
    check(
      'size=ELEVEN_A_SIDE',
      JSON.stringify(size) === JSON.stringify(['Cluj Arena Park', 'Florești Sports Base']),
      size
    )

    const priced = await names(`${CLUJ}&priceMin=50&priceMax=100`)
    check(
      'priceMin=50&priceMax=100 → a pitch priced in range',
      JSON.stringify(priced) ===
        JSON.stringify(
          [
            'Demo Sports Club',
            'Futsal Center Mărăști',
            'Iris Arena',
            'Mănăștur Football Park',
            'Someșeni Arena',
            'Zorilor Sports',
          ].sort()
        ),
      priced
    )

    const amen = await names(
      `${CLUJ}&amenities=SHOWERS_FREE&amenities=SHOWERS_PAID&amenities=PARKING_FREE&amenities=PARKING_PAID`
    )
    check(
      'amenities: free/paid OR-ed, showers AND parking on one pitch',
      JSON.stringify(amen) ===
        JSON.stringify([
          'Arena Gheorgheni',
          'Bună Ziua Sport Club',
          'Cluj Arena Park',
          'Florești Sports Base',
        ]),
      amen
    )

    const open = (await get(`${CLUJ}&openNow=true&limit=50`)).body.data!.companies
    check(
      'openNow=true → only open companies',
      open.every(c => c.isOpenNow)
    )

    const avail = (await get(`${CLUJ}&availableNow=true&limit=50`)).body.data!.companies
    check(
      'availableNow=true → open, and fully booked venue excluded',
      avail.every(c => c.isOpenNow) && !avail.some(c => c.name === 'Futsal Center Mărăști'),
      avail.map(c => c.name)
    )
  }

  step('Pagination')
  {
    const first = (await get(`${CLUJ}&limit=5`)).body.data!
    check(
      'limit=5 returns 5 with a nextCursor',
      first.companies.length === 5 && first.nextCursor !== null
    )

    const seen: string[] = []
    let cursor: string | null = null
    let pages = 0
    do {
      const page: Envelope['data'] = (
        await get(`${CLUJ}&limit=5${cursor ? `&cursor=${cursor}` : ''}`)
      ).body.data!
      seen.push(...page.companies.map(c => c.id))
      cursor = page.nextCursor
      pages++
    } while (cursor && pages < 20)
    check(
      `walking pages visits every company once (${pages} pages)`,
      seen.length === first.total && new Set(seen).size === seen.length,
      { seen: seen.length, total: first.total }
    )
    check('nextCursor null on the last page', cursor === null)
  }

  step('Opening hours (Europe/Bucharest)')
  {
    // 2026-10-14 is a Wednesday; Bucharest is UTC+3 in October.
    const at = (utc: string) => new Date(`2026-10-14T${utc}Z`)
    const daily = (o: string, c: string) =>
      [0, 1, 2, 3, 4, 5, 6].map(day => ({ day, openTime: o, closeTime: c, isClosed: false }))
    check('09:00 local inside 08:00–23:00', isOpenAt(daily('08:00', '23:00'), at('06:00:00')))
    check('07:59 local before opening', !isOpenAt(daily('08:00', '23:00'), at('04:59:00')))
    check(
      '23:00 local is closed (close is exclusive)',
      !isOpenAt(daily('08:00', '23:00'), at('20:00:00'))
    )
    check(
      '01:00 local open via previous day 16:00–02:00',
      isOpenAt(daily('16:00', '02:00'), at('22:00:00'))
    )
    check('00:00–00:00 is open round the clock', isOpenAt(daily('00:00', '00:00'), at('01:30:00')))
    check(
      'closed day is closed',
      !isOpenAt([{ day: 3, openTime: '08:00', closeTime: '22:00', isClosed: true }], at('09:00:00'))
    )
    check('missing hours count as closed', !isOpenAt(null, at('09:00:00')))
  }

  step('City detection helpers')
  {
    check('Florești snaps to Cluj-Napoca', nearestCity(46.7476, 23.4904)?.name === 'Cluj-Napoca')
    check('central Bucharest → București', nearestCity(44.43, 26.1)?.name === 'București')
    check('Vienna → null (no supported city nearby)', nearestCity(48.2082, 16.3738) === null)
    check(
      'diacritic-insensitive: "timis" ⊂ "Timișoara"',
      foldForSearch('Timișoara').includes(foldForSearch('timis'))
    )
  }

  console.log(`\n${pass} passed, ${fail} failed`)
  process.exitCode = fail ? 1 : 0
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
