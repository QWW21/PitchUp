/**
 * Managing pitches — E10-01 … E10-05 (with C-1, C-2, C-3). Each test makes
 * its own approved venue (open 08:00–23:00, closed Sundays) so nothing here
 * touches the seeded venues.
 */
import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
} from '@playwright/test'
import {
  DAY_SHORT,
  addDays,
  dayOfWeek,
  venueClock,
  type ManagerPitch,
  type ManagerPitchRow,
  type PitchAvailability,
  type PitchDetail,
} from '@pitchup/shared'
import { del, get, post, put } from '../support/api'
import {
  createManager,
  createPlayer,
  createVenue,
  db,
  seedBooking,
  uniqueEmail,
} from '../support/db'
import { E2E_BASE_URL } from '../support/env'
import { resetRateLimits, signInApi } from '../support/helpers'

const contexts: APIRequestContext[] = []
const today = venueClock(new Date()).date
/** The next date, n days or more ahead, that is not a Sunday (the test venue's closed day). */
const openDay = (n: number) => {
  let d = addDays(today, n)
  while (dayOfWeek(d) === 0) d = addDays(d, 1)
  return d
}
const PHOTO = (n: number) => ({
  url: `https://res.cloudinary.com/demo/image/upload/v1/pitchup/pitches/test/${n}.jpg`,
  cloudinaryPublicId: `pitchup/pitches/test/${n}`,
})

async function context(email: string, password: string) {
  const ctx = await playwrightRequest.newContext({ baseURL: E2E_BASE_URL })
  contexts.push(ctx)
  await signInApi(ctx, email, password)
  return ctx
}

async function newVenue() {
  const email = uniqueEmail('pitchmgr')
  const venue = await createVenue(email, `Pitch Test ${Date.now().toString(36)}`)
  return { ...venue, ctx: await context(email, 'Testing123') }
}

const patch = (r: APIRequestContext, path: string, body: unknown) =>
  r.patch(`/api/v1${path}`, { data: body }).then(async res => ({
    status: res.status(),
    body: await res.json(),
  }))

async function newPitch(ctx: APIRequestContext, extra: Record<string, unknown> = {}) {
  const r = await post<{ id: string }>(ctx, '/pitches', {
    name: 'Teren Test',
    surfaceType: 'ARTIFICIAL_GRASS',
    size: 'FIVE_A_SIDE',
    ...extra,
  })
  expect(r.status).toBe(201)
  return r.data!.id
}

/** A pitch players can book: a photo, a price, switched on. */
async function livePitch(ctx: APIRequestContext) {
  const id = await newPitch(ctx)
  await post(ctx, `/pitches/${id}/photos`, PHOTO(1))
  await put(ctx, `/pitches/${id}/pricing`, {
    hourlyRate: 100,
    minBookingHours: 1,
    maxBookingHours: 4,
    advanceBookingDays: 60,
  })
  expect((await patch(ctx, `/pitches/${id}/status`, { isActive: true })).status).toBe(200)
  return id
}

test.beforeEach(async ({ request }) => {
  await resetRateLimits(request)
})

test.afterAll(async () => {
  await db.booking.deleteMany({
    where: { pitch: { company: { owner: { email: { startsWith: 'pitchmgr-' } } } } },
  })
  await db.company.deleteMany({ where: { owner: { email: { startsWith: 'pitchmgr-' } } } })
  for (const c of contexts) await c.dispose()
})

test.describe('creating and editing (E10-01)', () => {
  test('managers with an approved venue only; a new pitch starts hidden with usual dimensions', async ({
    request,
  }) => {
    const body = { name: 'Teren A', surfaceType: 'FUTSAL', size: 'FIVE_A_SIDE' }
    expect((await post(request, '/pitches', body)).status).toBe(401)
    const playerEmail = uniqueEmail('pitchmgr-player')
    await createPlayer(playerEmail)
    expect((await post(await context(playerEmail, 'Testing123'), '/pitches', body)).status).toBe(
      403
    )
    const noVenueEmail = uniqueEmail('pitchmgr-new')
    await createManager(noVenueEmail)
    const noVenue = await post(await context(noVenueEmail, 'Testing123'), '/pitches', body)
    expect(noVenue.error?.details).toEqual({ reason: 'NOT_ACTIVE' })

    const v = await newVenue()
    const id = await newPitch(v.ctx, body)
    const pitch = (await get<ManagerPitch>(v.ctx, `/manager/pitches/${id}`)).data!
    expect(pitch).toMatchObject({
      name: 'Teren A',
      isActive: false,
      widthMeters: 25,
      lengthMeters: 42,
      hourlyRate: 0,
      photos: [],
      workingHours: null,
    })
    // Hidden from players until switched on.
    expect((await get<PitchDetail>(request, `/pitches/${id}`)).data?.isBookable).toBe(false)
  })

  test('custom sizes need dimensions; edits change only what is sent', async () => {
    const v = await newVenue()
    expect(
      (await post(v.ctx, '/pitches', { name: 'X1', surfaceType: 'FUTSAL', size: 'CUSTOM' })).status
    ).toBe(400)
    const id = await newPitch(v.ctx, { size: 'CUSTOM', widthMeters: 20, lengthMeters: 35 })

    expect((await put(v.ctx, `/pitches/${id}`, {})).status).toBe(400)
    await put(v.ctx, `/pitches/${id}`, { name: 'Teren Mare' })
    let p = (await get<ManagerPitch>(v.ctx, `/manager/pitches/${id}`)).data!
    expect(p).toMatchObject({ name: 'Teren Mare', size: 'CUSTOM', widthMeters: 20 })

    // A standard size brings its usual dimensions.
    await put(v.ctx, `/pitches/${id}`, { size: 'SIX_A_SIDE' })
    p = (await get<ManagerPitch>(v.ctx, `/manager/pitches/${id}`)).data!
    expect(p).toMatchObject({ size: 'SIX_A_SIDE', widthMeters: 30, lengthMeters: 50 })
  })

  test("another venue's manager gets a 404 everywhere", async () => {
    const a = await newVenue()
    const b = await newVenue()
    const id = await newPitch(a.ctx)
    expect((await put(b.ctx, `/pitches/${id}`, { name: 'Mine now' })).status).toBe(404)
    expect((await patch(b.ctx, `/pitches/${id}/status`, { isActive: false })).status).toBe(404)
    expect((await post(b.ctx, `/pitches/${id}/photos`, PHOTO(1))).status).toBe(404)
    expect((await get(b.ctx, `/manager/pitches/${id}`)).status).toBe(404)
    expect((await del(b.ctx, `/pitches/${id}`)).status).toBe(404)
  })
})

test.describe('photos (E10-02)', () => {
  test('ten at most, Cloudinary only, reordered together, gaps closed after a delete', async () => {
    const v = await newVenue()
    const id = await newPitch(v.ctx)
    expect(
      (
        await post(v.ctx, `/pitches/${id}/photos`, {
          url: 'https://evil.example/x.jpg',
          cloudinaryPublicId: 'x',
        })
      ).status
    ).toBe(400)
    // Uploads finishing together still each get their own place.
    const added = await Promise.all(
      Array.from({ length: 10 }, (_, n) =>
        post<{ id: string; order: number }>(v.ctx, `/pitches/${id}/photos`, PHOTO(n))
      )
    )
    expect(added.map(a => a.status)).toEqual(Array(10).fill(201))
    expect(new Set(added.map(a => a.data!.order)).size).toBe(10)
    const full = await post(v.ctx, `/pitches/${id}/photos`, PHOTO(11))
    expect(full.error?.details).toEqual({ reason: 'PHOTO_LIMIT' })

    let photos = (await get<ManagerPitch>(v.ctx, `/manager/pitches/${id}`)).data!.photos
    const reversed = [...photos].reverse().map(p => p.id)
    const stale = await put(v.ctx, `/pitches/${id}/photos/reorder`, { photoIds: reversed.slice(1) })
    expect(stale.error?.details).toEqual({ reason: 'OUT_OF_SYNC' })
    const reordered = await put<{ id: string; order: number }[]>(
      v.ctx,
      `/pitches/${id}/photos/reorder`,
      {
        photoIds: reversed,
      }
    )
    expect(reordered.data!.map(p => p.id)).toEqual(reversed)

    // Deleting the cover: the next one becomes the cover, orders stay 0…n-1.
    const after = await del<{ id: string; order: number }[]>(
      v.ctx,
      `/pitches/${id}/photos/${reversed[0]}`
    )
    expect(after.data!.map(p => p.id)).toEqual(reversed.slice(1))
    expect(after.data!.map(p => p.order)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
    photos = (await get<ManagerPitch>(v.ctx, `/manager/pitches/${id}`)).data!.photos
    expect(photos[0]!.id).toBe(reversed[1])
  })
})

test.describe('status, pricing, amenities (E10-03, E10-05)', () => {
  test('switching on needs a photo and a price; players then see the pitch as set up', async ({
    request,
  }) => {
    const v = await newVenue()
    const id = await newPitch(v.ctx)
    const on = () => patch(v.ctx, `/pitches/${id}/status`, { isActive: true })
    expect((await on()).body.error.details).toEqual({ reason: 'NO_PHOTOS' })
    await post(v.ctx, `/pitches/${id}/photos`, PHOTO(1))
    expect((await on()).body.error.details).toEqual({ reason: 'NO_PRICE' })

    const pricing = {
      hourlyRate: 150,
      minBookingHours: 1,
      maxBookingHours: 3,
      advanceBookingDays: 30,
    }
    expect(
      (
        await put(v.ctx, `/pitches/${id}/pricing`, {
          ...pricing,
          minBookingHours: 2,
          maxBookingHours: 2,
        })
      ).status
    ).toBe(200)
    expect(
      (
        await put(v.ctx, `/pitches/${id}/pricing`, {
          ...pricing,
          minBookingHours: 2,
          maxBookingHours: 1,
        })
      ).status
    ).toBe(400)
    expect(
      (await put(v.ctx, `/pitches/${id}/pricing`, { ...pricing, advanceBookingDays: 45 })).status
    ).toBe(400)
    expect((await put(v.ctx, `/pitches/${id}/pricing`, { ...pricing, hourlyRate: 0 })).status).toBe(
      400
    )
    expect((await put(v.ctx, `/pitches/${id}/pricing`, pricing)).data).toEqual(pricing)

    expect((await put(v.ctx, `/pitches/${id}/amenities`, { amenities: ['SAUNA'] })).status).toBe(
      400
    )
    await put(v.ctx, `/pitches/${id}/amenities`, { amenities: ['WIFI', 'CHANGING_ROOMS'] })
    await put(v.ctx, `/pitches/${id}/amenities`, { amenities: ['NIGHT_LIGHTING'] })

    expect((await on()).status).toBe(200)
    const detail = (await get<PitchDetail>(request, `/pitches/${id}`)).data!
    expect(detail).toMatchObject({
      isBookable: true,
      hourlyRate: 150,
      maxBookingHours: 3,
      advanceBookingDays: 30,
      amenities: [{ amenityType: 'NIGHT_LIGHTING' }],
    })
    // Switching off never blocks.
    expect((await patch(v.ctx, `/pitches/${id}/status`, { isActive: false })).status).toBe(200)
  })
})

test.describe('shirts (E10-04, C-1)', () => {
  test('sets per colour; fewer sets than upcoming bookings were promised asks for force', async ({
    request,
  }) => {
    const v = await newVenue()
    const id = await livePitch(v.ctx)
    expect(
      (
        await put(v.ctx, `/pitches/${id}/shirts`, {
          hasShirts: true,
          inventory: [{ colour: 'RED', quantity: 0 }],
        })
      ).status
    ).toBe(400)
    const two = {
      hasShirts: true,
      inventory: [
        { colour: 'RED', quantity: 1 },
        { colour: 'BLUE', quantity: 1 },
      ],
    }
    expect((await put(v.ctx, `/pitches/${id}/shirts`, two)).status).toBe(200)
    expect((await get<PitchDetail>(request, `/pitches/${id}`)).data).toMatchObject({
      hasShirts: true,
      shirtInventory: [
        { colour: 'RED', quantity: 1 },
        { colour: 'BLUE', quantity: 1 },
      ],
    })

    const playerEmail = uniqueEmail('pitchmgr-p')
    await createPlayer(playerEmail)
    const player = await db.user.findUniqueOrThrow({ where: { email: playerEmail } })
    const b = await seedBooking({
      pitchId: id,
      playerId: player.id,
      startsIn: 48,
      status: 'CONFIRMED',
    })
    await db.booking.update({ where: { id: b.id }, data: { shirtSets: 2 } })

    const off = await put(v.ctx, `/pitches/${id}/shirts`, { hasShirts: false })
    expect(off.status).toBe(409)
    expect(off.error?.details).toEqual({ reason: 'SHIRTS_PROMISED', bookingIds: [b.id] })
    expect(
      (await put(v.ctx, `/pitches/${id}/shirts`, { hasShirts: false, force: true })).status
    ).toBe(200)
    expect((await get<PitchDetail>(request, `/pitches/${id}`)).data).toMatchObject({
      hasShirts: false,
      shirtInventory: [],
    })
  })
})

test.describe('hours and blocked dates (E10-04)', () => {
  test("a pitch's own hours must fit in the venue's, and decide its slots", async ({ request }) => {
    const v = await newVenue()
    const id = await livePitch(v.ctx)
    const week = (patchDay: (day: number) => object) => ({
      workingHours: DAY_SHORT.map((_, day) => ({
        day,
        openTime: '10:00',
        closeTime: '14:00',
        isClosed: day === 0,
        ...patchDay(day),
      })),
    })
    const early = await put(
      v.ctx,
      `/pitches/${id}/availability`,
      week(d => (d === 1 ? { openTime: '07:00' } : {}))
    )
    expect(early.error?.details).toMatchObject({
      reason: 'OUTSIDE_VENUE_HOURS',
      days: [{ day: 1, message: 'Opens before the venue (08:00)' }],
    })
    const sunday = await put(
      v.ctx,
      `/pitches/${id}/availability`,
      week(d => (d === 0 ? { isClosed: false } : {}))
    )
    expect(sunday.error?.details).toMatchObject({ days: [{ day: 0 }] })
    expect(
      (
        await put(
          v.ctx,
          `/pitches/${id}/availability`,
          week(() => ({}))
        )
      ).status
    ).toBe(200)

    const date = openDay(3)
    const slots = (
      await get<PitchAvailability>(request, `/pitches/${id}/availability?date=${date}`)
    ).data!.slots
    expect(slots[0]!.time).toBe('10:00')
    expect(slots.at(-1)!.time).toBe('13:30')
  })

  test('blocked dates: today or later, never over bookings, and they close the day', async ({
    request,
  }) => {
    const v = await newVenue()
    const id = await livePitch(v.ctx)
    const date = openDay(4)
    expect(
      (await post(v.ctx, `/pitches/${id}/exceptions`, { date: addDays(today, -1) })).status
    ).toBe(400)
    const blocked = await post<{ id: string }>(v.ctx, `/pitches/${id}/exceptions`, {
      date,
      reason: 'Resurfacing',
    })
    expect(blocked.status).toBe(201)
    const twice = await post(v.ctx, `/pitches/${id}/exceptions`, { date })
    expect(twice.error?.details).toEqual({ reason: 'ALREADY_BLOCKED' })
    expect(
      (await get<PitchAvailability>(request, `/pitches/${id}/availability?date=${date}`)).data!
        .slots
    ).toEqual([])
    expect((await del(v.ctx, `/pitches/${id}/exceptions/${blocked.data!.id}`)).status).toBe(200)
    expect(
      (await get<PitchAvailability>(request, `/pitches/${id}/availability?date=${date}`)).data!
        .slots.length
    ).toBeGreaterThan(0)

    // A day with a booking cannot be blocked.
    const playerEmail = uniqueEmail('pitchmgr-p')
    await createPlayer(playerEmail)
    const player = await db.user.findUniqueOrThrow({ where: { email: playerEmail } })
    const b = await seedBooking({
      pitchId: id,
      playerId: player.id,
      startsIn: 30,
      status: 'CONFIRMED',
    })
    const bookedDay = venueClock(b.startTime).date
    const refused = await post(v.ctx, `/pitches/${id}/exceptions`, { date: bookedDay })
    expect(refused.error?.details).toEqual({ reason: 'HAS_BOOKINGS', bookingIds: [b.id] })
  })
})

test.describe('the list and deleting (E10-05)', () => {
  test('the list shows each pitch with its cover and counts; deleting waits for bookings to be played', async ({
    request,
  }) => {
    const v = await newVenue()
    const live = await livePitch(v.ctx)
    const draft = await newPitch(v.ctx, { name: 'Draft pitch' })
    const playerEmail = uniqueEmail('pitchmgr-p')
    await createPlayer(playerEmail)
    const player = await db.user.findUniqueOrThrow({ where: { email: playerEmail } })
    const b = await seedBooking({
      pitchId: live,
      playerId: player.id,
      startsIn: 50,
      status: 'CONFIRMED',
    })

    const rows = (await get<ManagerPitchRow[]>(v.ctx, '/manager/pitches')).data!
    expect(rows.map(r => r.name)).toEqual(['Draft pitch', 'Teren Test'])
    expect(rows.find(r => r.id === live)).toMatchObject({
      isActive: true,
      photoCount: 1,
      coverPhotoUrl: PHOTO(1).url,
      upcomingBookings: 1,
      avgRating: null,
    })
    expect(rows.find(r => r.id === draft)).toMatchObject({ isActive: false, coverPhotoUrl: null })

    const refused = await del(v.ctx, `/pitches/${live}`)
    expect(refused.error?.details).toEqual({ reason: 'HAS_BOOKINGS', count: 1 })
    await db.booking.delete({ where: { id: b.id } })
    expect((await del(v.ctx, `/pitches/${live}`)).status).toBe(200)
    expect((await get(request, `/pitches/${live}`)).status).toBe(404)
    expect((await get(request, `/pitches/${live}/availability?date=${openDay(2)}`)).status).toBe(
      404
    )
    expect((await get<ManagerPitchRow[]>(v.ctx, '/manager/pitches')).data!.map(r => r.id)).toEqual([
      draft,
    ])
    expect((await db.pitch.findUniqueOrThrow({ where: { id: live } })).deletedAt).not.toBeNull()
  })
})
