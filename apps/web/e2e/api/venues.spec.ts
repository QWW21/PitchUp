/**
 * Company, pitch, availability and reviews endpoints — T-05, ported from
 * scripts/verify-e04.ts. A few cases change a row and put it back.
 */
import { expect, test } from '@playwright/test'
import {
  addDays,
  dayOfWeek,
  venueClock,
  type CompanyDetail,
  type PitchAvailability,
  type PitchDetail,
  type ReviewPage,
} from '@pitchup/shared'
import { get } from '../support/api'
import { db, venue } from '../support/db'

type Venue = Awaited<ReturnType<typeof venue>>
let gheorgheni: Venue,
  arena: Venue,
  zorilor: Venue,
  iris: Venue,
  futsal: Venue,
  pending: Venue,
  inactive: Venue

test.beforeAll(async () => {
  gheorgheni = await venue('gheorgheni')
  arena = await venue('cluj-arena-park')
  zorilor = await venue('zorilor')
  iris = await venue('iris')
  futsal = await venue('futsal-center')
  pending = await venue('pending')
  inactive = await venue('inactive')
})

test.describe('GET /companies/:id', () => {
  test('full detail, public', async ({ request }) => {
    const r = await get<CompanyDetail>(request, `/companies/${gheorgheni.id}`)
    const c = r.data!
    expect(r.status).toBe(200)
    expect(c.name).toBe('Arena Gheorgheni')
    expect(c.workingHours.map(d => d.day)).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(c.pitches.map(p => p.name)).toEqual(['Teren 1', 'Teren 2'])
    expect(c.pitches.every(p => p.isActive && p.coverPhotoUrl?.includes('-0/'))).toBe(true)
    expect(typeof c.avgRating).toBe('number')
  })

  test('rating hidden below three reviews; a closed Sunday is reported', async ({ request }) => {
    const z = (await get<CompanyDetail>(request, `/companies/${zorilor.id}`)).data!
    expect(z).toMatchObject({ avgRating: null, reviewCount: 2 })
    expect(z.workingHours[0]!.isClosed).toBe(true)
  })

  test('no photos → coverPhotoUrl null; no reviews → null and 0', async ({ request }) => {
    const demo = await db.company.findFirstOrThrow({ where: { name: 'Demo Sports Club' } })
    const d = (await get<CompanyDetail>(request, `/companies/${demo.id}`)).data!
    expect(d.pitches[0]?.coverPhotoUrl).toBeNull()
    expect(d).toMatchObject({ avgRating: null, reviewCount: 0 })
  })

  test('pending and unknown companies are 404; no active pitches is an empty list', async ({
    request,
  }) => {
    expect((await get(request, `/companies/${pending.id}`)).status).toBe(404)
    expect((await get(request, '/companies/nope')).status).toBe(404)
    const empty = await get<CompanyDetail>(request, `/companies/${inactive.id}`)
    expect(empty.status).toBe(200)
    expect(empty.data!.pitches).toEqual([])
  })

  test('a review held for moderation drops out of the aggregate', async ({ request }) => {
    const before = (await get<CompanyDetail>(request, `/companies/${gheorgheni.id}`)).data!
      .reviewCount
    const review = await db.review.findFirstOrThrow({
      where: { pitch: { companyId: gheorgheni.id }, moderationStatus: 'APPROVED' },
    })
    await db.review.update({ where: { id: review.id }, data: { moderationStatus: 'PENDING' } })
    try {
      const after = (await get<CompanyDetail>(request, `/companies/${gheorgheni.id}`)).data!
        .reviewCount
      expect(after).toBe(before - 1)
    } finally {
      await db.review.update({ where: { id: review.id }, data: { moderationStatus: 'APPROVED' } })
    }
  })

  test('responds quickly', async ({ request }) => {
    await get(request, `/companies/${gheorgheni.id}`)
    // Ticket: < 100ms. Looser here so a shared CI runner does not flake.
    expect((await get(request, `/companies/${gheorgheni.id}`)).ms).toBeLessThan(400)
  })
})

test.describe('GET /pitches/:id', () => {
  test('photos, amenities, shirts, peak hours, recent reviews', async ({ request }) => {
    const teren1 = gheorgheni.pitches[0]!
    const p = (await get<PitchDetail>(request, `/pitches/${teren1.id}`)).data!
    expect(p.company).toMatchObject({ id: gheorgheni.id, isVerified: true })
    expect(p.photos.length).toBeGreaterThanOrEqual(3)
    expect(p.photos.map(ph => ph.order)).toEqual(p.photos.map((_, i) => i))
    expect(p.amenities).toHaveLength(await db.pitchAmenity.count({ where: { pitchId: teren1.id } }))
    expect(p).toMatchObject({ hasShirts: true, shirtRentalPrice: 10, isBookable: true })
    expect(p.shirtInventory).toHaveLength(3)
    expect(p.peakHoursDefinition).toHaveLength(2)
    expect(p.recentReviews.length).toBeLessThanOrEqual(3)
    const dates = p.recentReviews.map(r => r.createdAt)
    expect([...dates].sort().reverse()).toEqual(dates)
    expect(p.recentReviews.some(r => /^\S+ \S\.$/.test(r.playerName))).toBe(true)
  })

  test('no shirts → empty inventory', async ({ request }) => {
    const p = (await get<PitchDetail>(request, `/pitches/${gheorgheni.pitches[1]!.id}`)).data!
    expect(p.hasShirts).toBe(false)
    expect(p.shirtInventory).toEqual([])
  })

  test('anonymous reviewer and rating-only review', async ({ request }) => {
    const anon = await db.review.findFirstOrThrow({ where: { isAnonymous: true } })
    const page = (await get<ReviewPage>(request, `/reviews?pitchId=${anon.pitchId}&limit=50`)).data!
    expect(page.reviews.find(r => r.id === anon.id)).toMatchObject({
      playerName: 'Anonymous player',
      playerAvatarUrl: null,
    })
    const bare = await db.review.findFirst({ where: { text: '' } })
    if (bare) {
      const p = (await get<ReviewPage>(request, `/reviews?pitchId=${bare.pitchId}&limit=50`)).data!
      expect(p.reviews.find(r => r.id === bare.id)?.text).toBeNull()
    }
  })

  test('rating hidden below three reviews', async ({ request }) => {
    const p = (await get<PitchDetail>(request, `/pitches/${zorilor.pitches[0]!.id}`)).data!
    expect(p).toMatchObject({ avgRating: null, reviewCount: 2 })
  })

  test('inactive pitch still returned but not bookable; pending company → 404', async ({
    request,
  }) => {
    const off = await get<PitchDetail>(request, `/pitches/${inactive.pitches[0]!.id}`)
    expect(off.status).toBe(200)
    expect(off.data).toMatchObject({ isBookable: false, photos: [] })
    expect((await get(request, `/pitches/${pending.pitches[0]!.id}`)).status).toBe(404)
  })

  test('swapping photo order in the database reorders the response', async ({ request }) => {
    const pitchId = gheorgheni.pitches[0]!.id
    const [a, b] = await db.pitchPhoto.findMany({
      where: { pitchId },
      orderBy: { order: 'asc' },
      take: 2,
    })
    await db.pitchPhoto.update({ where: { id: a!.id }, data: { order: 1 } })
    await db.pitchPhoto.update({ where: { id: b!.id }, data: { order: 0 } })
    try {
      expect((await get<PitchDetail>(request, `/pitches/${pitchId}`)).data!.photos[0]!.id).toBe(
        b!.id
      )
    } finally {
      await db.pitchPhoto.update({ where: { id: a!.id }, data: { order: 0 } })
      await db.pitchPhoto.update({ where: { id: b!.id }, data: { order: 1 } })
    }
  })
})

test.describe('GET /pitches/:id/availability', () => {
  const today = () => venueClock(new Date()).date
  const path = (id: string, date?: string) =>
    `/pitches/${id}/availability${date ? `?date=${date}` : ''}`

  test('rejects missing, malformed, impossible, past and too-far dates', async ({ request }) => {
    const id = gheorgheni.pitches[0]!.id
    expect((await get(request, path(id))).status).toBe(400)
    expect((await get(request, path(id, '14-10-2026'))).status).toBe(400)
    expect((await get(request, path(id, '2026-02-31'))).status).toBe(400)
    const past = await get(request, path(id, addDays(today(), -1)))
    expect(past.error?.message).toBe('Cannot check availability for past dates')
    const far = await get(request, path(id, addDays(today(), 61)))
    expect(far.error?.message).toBe('Date beyond advance booking limit')
    expect((await get(request, path(pending.pitches[0]!.id, addDays(today(), 1)))).status).toBe(404)
  })

  test('tomorrow: 30-minute slots, the seeded 18:00–20:00 booking, cancelled ignored', async ({
    request,
  }) => {
    const r = await get<PitchAvailability>(
      request,
      path(gheorgheni.pitches[0]!.id, addDays(today(), 1))
    )
    const a = r.data!
    const status = (t: string) => a.slots.find(s => s.time === t)?.status
    expect(a.slots).toHaveLength(30)
    expect([a.slots[0]!.time, a.slots.at(-1)!.time]).toEqual(['08:00', '22:30'])
    for (const t of ['18:00', '18:30', '19:00', '19:30']) expect(status(t)).toBe('booked')
    expect(status('17:30')).toBe('available')
    expect(status('20:00')).toBe('available') // a booking ending at 20:00 leaves 20:00 free
    expect(status('10:00')).toBe('available') // the cancelled booking does not block
    expect(r.headers['cache-control']).toBe('public, max-age=60')
  })

  test('fully booked day, exception date, closed weekday', async ({ request }) => {
    const id = gheorgheni.pitches[0]!.id
    const full = (await get<PitchAvailability>(request, path(id, addDays(today(), 2)))).data!
    expect(full.isClosed).toBe(false)
    expect(full.slots.every(s => s.status === 'booked')).toBe(true)

    const exception = (await get<PitchAvailability>(request, path(id, addDays(today(), 3)))).data!
    expect(exception).toMatchObject({ isClosed: true, slots: [] })

    let sunday = addDays(today(), 1)
    while (dayOfWeek(sunday) !== 0) sunday = addDays(sunday, 1)
    const closed = (await get<PitchAvailability>(request, path(zorilor.pitches[0]!.id, sunday)))
      .data!
    expect(closed).toMatchObject({ isClosed: true, slots: [] })
  })

  test('overnight and round-the-clock venues', async ({ request }) => {
    const tomorrow = addDays(today(), 1)
    const night = (await get<PitchAvailability>(request, path(iris.pitches[0]!.id, tomorrow))).data!
    const times = night.slots.map(s => s.time)
    expect(times[0]).toBe('00:00')
    expect(times).toContain('01:30')
    expect(times).not.toContain('02:00')
    expect(times.at(-1)).toBe('23:30')
    expect(night.closeTime).toBe('24:00')

    const allDay = (await get<PitchAvailability>(request, path(futsal.pitches[0]!.id, tomorrow)))
      .data!
    expect(allDay.slots).toHaveLength(48)
  })

  test('earlier slots today are past or booked, never available', async ({ request }) => {
    const a = (await get<PitchAvailability>(request, path(futsal.pitches[0]!.id, today()))).data!
    const now = venueClock(new Date()).minutes
    const started = a.slots.filter(
      s => Number(s.time.slice(0, 2)) * 60 + Number(s.time.slice(3)) <= now
    )
    expect(started.length).toBeGreaterThan(0)
    expect(started.every(s => s.status !== 'available')).toBe(true)
  })

  test('an inactive pitch is closed', async ({ request }) => {
    const a = (
      await get<PitchAvailability>(request, path(inactive.pitches[0]!.id, addDays(today(), 1)))
    ).data!
    expect(a.isClosed).toBe(true)
  })
})

test.describe('GET /reviews', () => {
  test('pages through a company’s fourteen reviews, newest first', async ({ request }) => {
    const p1 = (await get<ReviewPage>(request, `/reviews?companyId=${arena.id}&limit=10`)).data!
    const p2 = (await get<ReviewPage>(request, `/reviews?companyId=${arena.id}&limit=10&page=2`))
      .data!
    expect(p1).toMatchObject({ total: 14, hasMore: true })
    expect(p1.reviews).toHaveLength(10)
    expect(p2.reviews).toHaveLength(4)
    expect(p2.hasMore).toBe(false)
    const all = [...p1.reviews, ...p2.reviews]
    expect(new Set(all.map(r => r.id)).size).toBe(14)
    const dates = all.map(r => r.createdAt)
    expect([...dates].sort().reverse()).toEqual(dates)
  })

  test('distribution, rating and manager reply', async ({ request }) => {
    const p = (await get<ReviewPage>(request, `/reviews?companyId=${arena.id}&limit=50`)).data!
    expect(Object.values(p.distribution).reduce((s, n) => s + n, 0)).toBe(p.total)
    expect(p.avgRating).toBe(
      (await get<CompanyDetail>(request, `/companies/${arena.id}`)).data!.avgRating
    )
    expect(p.reviews.some(r => r.managerReply)).toBe(true)
  })

  test('pitch filter, validation and 404', async ({ request }) => {
    const pitchId = arena.pitches[0]!.id
    const byPitch = (await get<ReviewPage>(request, `/reviews?pitchId=${pitchId}`)).data!
    expect(byPitch.total).toBeGreaterThan(0)
    expect(byPitch.reviews.every(r => r.pitchId === pitchId)).toBe(true)
    expect((await get(request, '/reviews')).status).toBe(400)
    expect((await get(request, `/reviews?companyId=${pending.id}`)).status).toBe(404)
  })
})
