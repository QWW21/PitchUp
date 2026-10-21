/**
 * A venue's bookings — E11-01 … E11-05 and the nightly job (E11-10). Each
 * test makes its own approved venue (open 08:00–23:00, closed Sundays) with
 * two pitches, so the seeded venues are untouched.
 */
import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
} from '@playwright/test'
import {
  addDays,
  dayOfWeek,
  venueClock,
  venueTimeToUtc,
  type AvailabilityGap,
  type ManagerBooking,
  type ManagerBookingDetail,
  type ManagerBookingPage,
  type ManagerCalendar,
} from '@pitchup/shared'
import { get, post } from '../support/api'
import { createManager, createPlayer, createVenue, db, uniqueEmail } from '../support/db'
import { E2E_BASE_URL, E2E_CRON_SECRET } from '../support/env'
import { resetRateLimits, signInApi } from '../support/helpers'

const HOUR = 3_600_000
const today = venueClock(new Date()).date
const contexts: APIRequestContext[] = []

async function context(email: string, password = 'Testing123') {
  const ctx = await playwrightRequest.newContext({ baseURL: E2E_BASE_URL })
  contexts.push(ctx)
  await signInApi(ctx, email, password)
  return ctx
}

/** A venue with pitches A and B and two players, Ana and Bogdan. */
async function setup() {
  const email = uniqueEmail('mgrbk')
  const venue = await createVenue(email, `Bookings Test ${Date.now().toString(36)}`)
  const pitch = (name: string) =>
    db.pitch.create({
      data: {
        companyId: venue.companyId,
        name,
        surfaceType: 'FUTSAL',
        size: 'FIVE_A_SIDE',
        hourlyRate: 100,
      },
    })
  const a = await pitch('Pitch A')
  const b = await pitch('Pitch B')
  const player = async (name: string) => {
    const e = uniqueEmail(`mgrbk-${name.split(' ')[0]!.toLowerCase()}`)
    await createPlayer(e)
    return db.user.update({
      where: { email: e },
      data: { name },
      select: { id: true, email: true },
    })
  }
  return {
    ...venue,
    ctx: await context(email),
    a: a.id,
    b: b.id,
    ana: await player('Ana Ionescu'),
    bogdan: await player('Bogdan Pop'),
  }
}

/** A booking from `start` (a Date) lasting `hours`, written directly. */
function book(
  pitchId: string,
  playerId: string,
  start: Date,
  status: string,
  hours = 2,
  extra = {}
) {
  return db.booking.create({
    data: {
      pitchId,
      playerId,
      startTime: start,
      endTime: new Date(start.getTime() + hours * HOUR),
      teamCount: 2,
      teamsData: [{ playerCount: 6 }, { playerCount: 6 }],
      status: status as 'CONFIRMED',
      pitchRateSnapshot: 100,
      totalAmount: 200,
      paymentProvider: 'test',
      stripePaymentIntentId: `test_pi_mgr_${Math.random().toString(36).slice(2)}`,
      paidAt: new Date(start.getTime() - 48 * HOUR),
      ...extra,
    },
  })
}
const at = (date: string, hhmm: string) =>
  venueTimeToUtc(date, Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3)))
const hoursFromNow = (h: number) => new Date(Date.now() + h * HOUR)
/** The next day at least n ahead that is not a Sunday (the test venue's closed day). */
const openDay = (n: number) => {
  let d = addDays(today, n)
  while (dayOfWeek(d) === 0) d = addDays(d, 1)
  return d
}

test.beforeEach(async ({ request }) => {
  await resetRateLimits(request)
})

test.afterAll(async () => {
  const mine = { pitch: { company: { owner: { email: { startsWith: 'mgrbk-' } } } } }
  await db.booking.deleteMany({ where: mine })
  await db.company.deleteMany({ where: { owner: { email: { startsWith: 'mgrbk-' } } } })
  for (const c of contexts) await c.dispose()
})

test.describe('the list (E11-01)', () => {
  test('managers of approved venues only, their own bookings only, no player emails', async ({
    request,
  }) => {
    const v = await setup()
    const other = await setup()
    const mine = await book(v.a, v.ana.id, hoursFromNow(30), 'CONFIRMED')
    const theirs = await book(other.a, other.ana.id, hoursFromNow(31), 'CONFIRMED')

    expect((await get(request, '/manager/bookings')).status).toBe(401)
    expect((await get(await context(v.ana.email), '/manager/bookings')).status).toBe(403)
    const newEmail = uniqueEmail('mgrbk-new')
    await createManager(newEmail)
    const pending = await get(await context(newEmail), '/manager/bookings')
    expect(pending.error?.details).toEqual({ reason: 'NOT_ACTIVE' })

    const page = (await get<ManagerBookingPage>(v.ctx, '/manager/bookings')).data!
    expect(page.items.map(i => i.id)).toEqual([mine.id])
    expect(page.items[0]).toMatchObject({
      player: { name: 'Ana Ionescu' },
      pitch: { id: v.a, name: 'Pitch A', color: expect.stringMatching(/^#[0-9A-F]{6}$/) },
      total: 200,
    })
    expect(JSON.stringify(page)).not.toContain('@')
    // Another venue's pitch id matches nothing rather than erroring.
    const cross = await get<ManagerBookingPage>(v.ctx, `/manager/bookings?pitchId=${other.a}`)
    expect(cross.data!.items).toEqual([])
    expect(theirs.id).not.toBe(mine.id)
  })

  test('filters combine; dates are venue days; pages follow the cursor', async () => {
    const v = await setup()
    const d1 = openDay(5)
    const d2 = openDay(9)
    const b1 = await book(v.a, v.ana.id, at(d1, '18:00'), 'CONFIRMED')
    const b2 = await book(v.b, v.bogdan.id, at(d1, '20:00'), 'CONFIRMED')
    const b3 = await book(v.a, v.bogdan.id, at(d2, '10:00'), 'CANCELLED', 2, {
      cancelledBy: 'PLAYER',
      cancelledAt: new Date(),
    })
    const ids = async (q: string) =>
      (await get<ManagerBookingPage>(v.ctx, `/manager/bookings?${q}`)).data!.items.map(i => i.id)

    expect(await ids('')).toEqual([b3.id, b2.id, b1.id])
    expect(await ids(`pitchId=${v.a}`)).toEqual([b3.id, b1.id])
    expect(await ids('status=CANCELLED')).toEqual([b3.id])
    expect(await ids(`dateFrom=${d1}&dateTo=${d1}`)).toEqual([b2.id, b1.id])
    expect(await ids(`dateFrom=${d2}`)).toEqual([b3.id])
    expect(await ids('search=bogdan')).toEqual([b3.id, b2.id])
    expect(await ids(`search=${v.ana.email.slice(0, 12)}`)).toEqual([b1.id])
    expect(await ids(`search=bogdan&pitchId=${v.b}`)).toEqual([b2.id])

    expect((await get(v.ctx, '/manager/bookings?search=a')).status).toBe(400)
    expect((await get(v.ctx, `/manager/bookings?dateFrom=${d2}&dateTo=${d1}`)).status).toBe(400)
    expect((await get(v.ctx, '/manager/bookings?status=LOST')).status).toBe(400)
    expect((await get(v.ctx, '/manager/bookings?limit=500')).status).toBe(200)

    const first = (await get<ManagerBookingPage>(v.ctx, '/manager/bookings?limit=2')).data!
    expect(first.items.map(i => i.id)).toEqual([b3.id, b2.id])
    const second = (
      await get<ManagerBookingPage>(v.ctx, `/manager/bookings?limit=2&cursor=${first.nextCursor}`)
    ).data!
    expect(second).toEqual({ items: [expect.objectContaining({ id: b1.id })], nextCursor: null })
  })
})

test.describe('the week (E11-02)', () => {
  test('any day gives its Monday-to-Sunday week; cancelled bookings are left out', async () => {
    const v = await setup()
    const day = openDay(14)
    const monday = addDays(day, -((dayOfWeek(day) + 6) % 7))
    const shown = await book(v.a, v.ana.id, at(day, '19:00'), 'CONFIRMED')
    await book(v.b, v.ana.id, at(day, '19:00'), 'CANCELLED', 2, {
      cancelledBy: 'PLAYER',
      cancelledAt: new Date(),
    })
    const nextWeek = await book(v.b, v.bogdan.id, at(addDays(monday, 7), '10:00'), 'CONFIRMED')

    expect((await get(v.ctx, '/manager/bookings/calendar')).status).toBe(400)
    const cal = (await get<ManagerCalendar>(v.ctx, `/manager/bookings/calendar?week=${day}`)).data!
    expect(cal.weekStart).toBe(monday)
    expect(cal.days).toHaveLength(7)
    expect(cal.events.map(e => e.id)).toEqual([shown.id])
    expect(cal.events[0]).toMatchObject({
      date: day,
      startTime: '19:00',
      endTime: '21:00',
      playerName: 'Ana Ionescu',
      pitchName: 'Pitch A',
    })
    expect(cal).toMatchObject({ from: 8 * 60, to: 23 * 60 })
    // Each pitch has its own colour, the same one its events carry.
    const [a, b] = [cal.pitches.find(p => p.id === v.a)!, cal.pitches.find(p => p.id === v.b)!]
    expect(a.color).not.toBe(b.color)
    expect(cal.events[0]!.pitchColor).toBe(a.color)

    const filtered = (
      await get<ManagerCalendar>(
        v.ctx,
        `/manager/bookings/calendar?week=${addDays(monday, 7)}&pitchId=${v.a}`
      )
    ).data!
    expect(filtered.events).toEqual([])
    expect(nextWeek.id).toBeTruthy()
  })
})

test.describe('one booking (E11-03)', () => {
  test("the price, teams and the player's history at this venue; another venue gets a 404", async () => {
    const v = await setup()
    const other = await setup()
    const b = await book(v.a, v.ana.id, hoursFromNow(40), 'CONFIRMED')
    await book(v.b, v.ana.id, hoursFromNow(-60), 'COMPLETED')
    await book(v.b, v.ana.id, hoursFromNow(-30), 'NO_SHOW')
    const late = hoursFromNow(20)
    await book(v.a, v.ana.id, late, 'CANCELLED', 2, {
      cancelledBy: 'PLAYER',
      cancelledAt: new Date(late.getTime() - 5 * HOUR),
    })
    // At another venue: not counted.
    await book(other.a, v.ana.id, hoursFromNow(-80), 'NO_SHOW')

    const d = (await get<ManagerBookingDetail>(v.ctx, `/manager/bookings/${b.id}`)).data!
    expect(d).toMatchObject({
      total: 200,
      minutes: 120,
      teams: [
        { name: 'Team A', players: 6 },
        { name: 'Team B', players: 6 },
      ],
      player: {
        name: 'Ana Ionescu',
        history: { bookings: 4, completed: 1, noShows: 1, lateCancels: 1 },
      },
    })
    expect(JSON.stringify(d)).not.toContain('trustScore')
    expect((await get(other.ctx, `/manager/bookings/${b.id}`)).status).toBe(404)
  })
})

test.describe('no-show, complete and free time (E11-04, E11-05)', () => {
  test('a no-show from 30 minutes to 4 hours after kick-off, once', async () => {
    const v = await setup()
    const early = await book(v.a, v.ana.id, hoursFromNow(-0.25), 'CONFIRMED')
    const late = await book(v.a, v.ana.id, hoursFromNow(-5), 'CONFIRMED', 1)
    const ok = await book(v.b, v.ana.id, hoursFromNow(-1), 'CONFIRMED')
    expect((await post(v.ctx, `/manager/bookings/${early.id}/no-show`, {})).error?.message).toMatch(
      /30 minutes after kick-off/
    )
    expect((await post(v.ctx, `/manager/bookings/${late.id}/no-show`, {})).error?.message).toMatch(
      /4 hours after kick-off/
    )

    const first = await post<ManagerBooking & { alreadyMarked: boolean }>(
      v.ctx,
      `/manager/bookings/${ok.id}/no-show`,
      { reason: 'Nobody came' }
    )
    expect(first.data).toMatchObject({ status: 'NO_SHOW', alreadyMarked: false })
    const again = await post<ManagerBooking & { alreadyMarked: boolean }>(
      v.ctx,
      `/manager/bookings/${ok.id}/no-show`,
      {}
    )
    expect(again.status).toBe(200)
    expect(again.data?.alreadyMarked).toBe(true)
    expect(await db.trustScoreEvent.count({ where: { relatedBookingId: ok.id } })).toBe(1)
  })

  test('complete only after the end; free time is what the bookings leave', async () => {
    const v = await setup()
    const ended = await book(v.a, v.ana.id, hoursFromNow(-3), 'CONFIRMED')
    const playing = await book(v.b, v.ana.id, hoursFromNow(-1), 'CONFIRMED')
    expect((await post(v.ctx, `/manager/bookings/${playing.id}/complete`, {})).error?.message).toBe(
      'This booking has not ended yet'
    )
    const done = await post<ManagerBooking>(v.ctx, `/manager/bookings/${ended.id}/complete`, {})
    expect(done.data?.status).toBe('COMPLETED')
    expect((await post(v.ctx, `/manager/bookings/${ended.id}/complete`, {})).status).toBe(409)

    const day = openDay(6)
    await book(v.a, v.ana.id, at(day, '10:00'), 'CONFIRMED')
    const gaps = (
      await get<{ gaps: AvailabilityGap[] }>(
        v.ctx,
        `/manager/pitches/${v.a}/availability-gaps?date=${day}`
      )
    ).data!.gaps
    expect(gaps).toEqual([
      { start: '08:00', end: '10:00', minutes: 120 },
      { start: '12:00', end: '23:00', minutes: 660 },
    ])
    let sunday = addDays(today, 3)
    while (dayOfWeek(sunday) !== 0) sunday = addDays(sunday, 1)
    expect(
      (
        await get<{ gaps: AvailabilityGap[] }>(
          v.ctx,
          `/manager/pitches/${v.a}/availability-gaps?date=${sunday}`
        )
      ).data!.gaps
    ).toEqual([])
  })
})

test.describe('the nightly job (E11-10)', () => {
  test('needs the cron token; completes finished bookings and clears abandoned checkouts', async ({
    request,
  }) => {
    const v = await setup()
    const finished = await book(v.a, v.ana.id, hoursFromNow(-4), 'CONFIRMED')
    const abandoned = await book(v.b, v.ana.id, hoursFromNow(30), 'PENDING', 2, {
      paidAt: null,
      createdAt: new Date(Date.now() - HOUR),
    })
    const upcoming = await book(v.b, v.bogdan.id, hoursFromNow(50), 'CONFIRMED')

    expect((await request.get('/api/v1/cron/auto-complete')).status()).toBe(401)
    const wrong = await request.get('/api/v1/cron/auto-complete', {
      headers: { Authorization: 'Bearer nope' },
    })
    expect(wrong.status()).toBe(401)
    const run = await request.get('/api/v1/cron/auto-complete', {
      headers: { Authorization: `Bearer ${E2E_CRON_SECRET}` },
    })
    expect(run.status()).toBe(200)
    const body = await run.json()
    expect(body.data.completed).toBeGreaterThanOrEqual(1)
    const status = async (id: string) =>
      (await db.booking.findUniqueOrThrow({ where: { id } })).status
    expect(await status(finished.id)).toBe('COMPLETED')
    expect(await status(abandoned.id)).toBe('CANCELLED')
    expect(await status(upcoming.id)).toBe('CONFIRMED')
  })
})
