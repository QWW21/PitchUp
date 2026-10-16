/**
 * A venue's analytics — E14-01 … E14-05, against known bookings. Each test
 * makes its own venue (open 08:00–23:00, closed Sundays) with two pitches;
 * bookings are seeded at 18:00–20:00 venue time on the last open day.
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
  type AnalyticsOccupancy,
  type AnalyticsRevenue,
  type AnalyticsSummary,
  type PitchPerformanceRow,
} from '@pitchup/shared'
import { get } from '../support/api'
import { createPlayer, createVenue, db, seedBooking, uniqueEmail } from '../support/db'
import { E2E_BASE_URL } from '../support/env'
import { resetRateLimits, signInApi } from '../support/helpers'

const HOUR = 3_600_000
const contexts: APIRequestContext[] = []

async function context(email: string) {
  const ctx = await playwrightRequest.newContext({ baseURL: E2E_BASE_URL })
  contexts.push(ctx)
  await signInApi(ctx, email, 'Testing123')
  return ctx
}

/** The last day before today the venue was open (not a Sunday). */
function lastOpenDay() {
  let d = addDays(venueClock(new Date()).date, -1)
  while (dayOfWeek(d) === 0) d = addDays(d, -1)
  return d
}

/** Hours from now to 18:00 on that venue day, for seedBooking. */
const at18 = (date: string) => (venueTimeToUtc(date, 18 * 60).getTime() - Date.now()) / HOUR

async function setup() {
  const managerEmail = uniqueEmail('stats-mgr')
  const v = await createVenue(managerEmail, `Stats Arena ${Date.now().toString(36)}`)
  const pitch = (name: string) =>
    db.pitch.create({
      data: {
        companyId: v.companyId,
        name,
        surfaceType: 'FUTSAL',
        size: 'FIVE_A_SIDE',
        hourlyRate: 100,
        isActive: true,
      },
    })
  const a = await pitch('Pitch A')
  const b = await pitch('Pitch B')
  const email = uniqueEmail('stats-p')
  await createPlayer(email)
  const player = await db.user.update({ where: { email }, data: { name: 'Pop, Ioana' } })
  return {
    ...v,
    a: a.id,
    b: b.id,
    playerId: player.id,
    player: email,
    manager: await context(managerEmail),
  }
}

test.beforeEach(async ({ request }) => {
  await resetRateLimits(request)
})

test.afterAll(async () => {
  await db.booking.deleteMany({ where: { player: { email: { startsWith: 'stats-p-' } } } })
  await db.company.deleteMany({ where: { owner: { email: { startsWith: 'stats-mgr-' } } } })
  for (const c of contexts) await c.dispose()
})

test('revenue: what the venue earned, in every bucket, and only its own', async () => {
  const s = await setup()
  const other = await setup()
  const day = lastOpenDay()
  const seed = (
    pitchId: string,
    status: Parameters<typeof seedBooking>[0]['status'],
    hours = at18(day)
  ) => seedBooking({ pitchId, playerId: s.playerId, startsIn: hours, status, rate: 100 })
  await seed(s.a, 'COMPLETED') // 200 played
  await seed(s.b, 'CONFIRMED') // 200, started: played
  const late = await seed(s.a, 'CANCELLED', at18(day) + 0.01) // refunded 150 of 200: 50 kept
  await db.booking.update({ where: { id: late.id }, data: { refundAmount: 150 } })
  await seed(s.b, 'NO_SHOW', at18(day) - 3) // 200 paid online, kept
  await seed(s.a, 'CONFIRMED', 30) // upcoming: nothing yet
  await seed(s.a, 'PENDING', at18(day) - 6) // unpaid: nothing
  await seedBooking({
    pitchId: other.a,
    playerId: s.playerId,
    startsIn: at18(day),
    status: 'COMPLETED',
  })

  expect((await get(s.manager, '/manager/analytics/revenue?period=1y')).status).toBe(400)
  const res = await get<AnalyticsRevenue>(s.manager, '/manager/analytics/revenue?period=7d')
  expect(res.status).toBe(200)
  expect(res.data!.groupBy).toBe('day')
  expect(res.data!.data).toHaveLength(7)
  const point = res.data!.data.find(p => p.period === day)!
  expect(point).toEqual({
    period: day,
    gross: 650,
    online: 650,
    atVenue: 0,
    fees: 52,
    payout: 598,
    bookings: 3,
  })
  expect(res.data!.data.reduce((n, p) => n + p.gross, 0)).toBe(650)

  // One pitch; another venue's pitch matches nothing.
  const onlyA = await get<AnalyticsRevenue>(
    s.manager,
    `/manager/analytics/revenue?period=7d&pitchId=${s.a}`
  )
  expect(onlyA.data!.data.find(p => p.period === day)!.gross).toBe(250)
  const foreign = await get<AnalyticsRevenue>(
    s.manager,
    `/manager/analytics/revenue?period=7d&pitchId=${other.a}`
  )
  expect(foreign.data!.data.every(p => p.gross === 0)).toBe(true)

  expect(
    (await get<AnalyticsRevenue>(s.manager, '/manager/analytics/revenue?period=12m')).data!.data
  ).toHaveLength(12)
  const player = await context(s.player)
  expect((await get(player, '/manager/analytics/revenue')).status).toBe(403)
})

test('occupancy: a 7×24 grid of booked over open time, closed hours empty', async () => {
  const s = await setup()
  const day = lastOpenDay()
  // One pitch of two booked 18:00–20:00: half the venue's open time then.
  await seedBooking({
    pitchId: s.a,
    playerId: s.playerId,
    startsIn: at18(day),
    status: 'COMPLETED',
  })
  const res = await get<AnalyticsOccupancy>(s.manager, '/manager/analytics/occupancy?period=7d')
  const grid = res.data!.grid
  expect(grid).toHaveLength(7)
  expect(grid.every(row => row.length === 24)).toBe(true)
  const dow = dayOfWeek(day)
  expect(grid[dow]![18]).toBe(50)
  expect(grid[dow]![19]).toBe(50)
  expect(grid[dow]![20]).toBe(0)
  // Before opening, and all of Sunday: closed.
  expect(grid[dow]![6]).toBeNull()
  expect(grid[0]!.every(v => v === null)).toBe(true)

  const onlyA = await get<AnalyticsOccupancy>(
    s.manager,
    `/manager/analytics/occupancy?period=7d&pitchId=${s.a}`
  )
  expect(onlyA.data!.grid[dow]![18]).toBe(100)
})

test('summary: five figures, with nothing earlier to compare', async () => {
  const s = await setup()
  const day = lastOpenDay()
  await seedBooking({
    pitchId: s.a,
    playerId: s.playerId,
    startsIn: at18(day),
    status: 'COMPLETED',
    rate: 100,
  })
  await seedBooking({
    pitchId: s.b,
    playerId: s.playerId,
    startsIn: at18(day),
    status: 'NO_SHOW',
    rate: 100,
  })
  const sum = (await get<AnalyticsSummary>(s.manager, '/manager/analytics/summary?period=30d'))
    .data!
  expect(sum.revenue).toMatchObject({ value: 400, online: 400, atVenue: 0, change: null })
  expect(sum.bookings).toEqual({ value: 2, change: null })
  expect(sum.noShowRate).toEqual({ value: 50, change: null })
  expect(sum.avgRating).toEqual({ value: null, change: null })
  expect(sum.occupancy.value).toBeGreaterThan(0)
})

test('summary: against the same length just before', async () => {
  const s = await setup()
  const day = lastOpenDay()
  await seedBooking({
    pitchId: s.a,
    playerId: s.playerId,
    startsIn: at18(day),
    status: 'COMPLETED',
    rate: 150,
  })
  // Ten days earlier: in the previous 7-day window.
  let before = addDays(day, -10)
  while (dayOfWeek(before) === 0) before = addDays(before, -1)
  await seedBooking({
    pitchId: s.a,
    playerId: s.playerId,
    startsIn: at18(before),
    status: 'COMPLETED',
    rate: 100,
  })
  const sum = (await get<AnalyticsSummary>(s.manager, '/manager/analytics/summary?period=7d')).data!
  expect(sum.revenue).toMatchObject({ value: 300, change: 50 })
  expect(sum.bookings).toEqual({ value: 1, change: 0 })
})

test('pitches: one row each, with rates and ratings', async () => {
  const s = await setup()
  const day = lastOpenDay()
  const played = await seedBooking({
    pitchId: s.a,
    playerId: s.playerId,
    startsIn: at18(day),
    status: 'COMPLETED',
    rate: 100,
  })
  await seedBooking({
    pitchId: s.a,
    playerId: s.playerId,
    startsIn: at18(day) - 4,
    status: 'CANCELLED',
    rate: 100,
  })
  await db.review.create({
    data: {
      bookingId: played.id,
      pitchId: s.a,
      playerId: s.playerId,
      rating: 4,
      text: 'Good pitch, good lights.',
    },
  })
  const rows = (
    await get<PitchPerformanceRow[]>(s.manager, '/manager/analytics/pitches?period=30d')
  ).data!
  expect(rows.map(r => r.name)).toEqual(['Pitch A', 'Pitch B'])
  expect(rows[0]).toMatchObject({
    revenue: 200,
    totalBookings: 2,
    completedBookings: 1,
    cancellationRate: 50,
    noShowRate: 0,
    avgRating: 4,
    reviewCount: 1,
  })
  expect(rows[1]).toMatchObject({
    revenue: 0,
    totalBookings: 0,
    avgRating: null,
    cancellationRate: 0,
  })
})

test('export: every booking of the period as CSV, names escaped', async () => {
  const s = await setup()
  const day = lastOpenDay()
  await seedBooking({
    pitchId: s.a,
    playerId: s.playerId,
    startsIn: at18(day),
    status: 'COMPLETED',
    rate: 100,
  })
  const res = await s.manager.get('/api/v1/manager/analytics/export?period=7d')
  expect(res.status()).toBe(200)
  expect(res.headers()['content-type']).toContain('text/csv')
  expect(res.headers()['content-disposition']).toMatch(
    /^attachment; filename="pitchup-analytics-7d-\d{4}-\d{2}-\d{2}\.csv"$/
  )
  expect(res.headers()['x-truncated']).toBeUndefined()
  const lines = (await res.text())
    .replace(/^\uFEFF/, '')
    .trim()
    .split('\r\n')
  expect(lines[0]).toBe(
    'Reference,Date,Start,End,Pitch,Size,Player,Status,Price (RON),Payment,Earned (RON),Online (RON),At venue (RON),PitchUp fee (RON),Payout (RON),Refunded (RON),Teams'
  )
  expect(lines).toHaveLength(2)
  expect(lines[1]).toContain(`,${day},18:00,20:00,Pitch A,`)
  expect(lines[1]).toContain(',"Pop, Ioana",COMPLETED,200,Online,200,200,0,16,184,,2')
})
