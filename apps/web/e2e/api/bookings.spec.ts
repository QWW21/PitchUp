/**
 * Booking and payment API — E05-07, E05-08, E05-09. Runs in test-payment
 * mode (no Stripe keys), which goes through the same booking code and the
 * same paid/failed handlers as Stripe.
 *
 * Bookings land on Arena Gheorgheni at least ten days out, clear of the
 * seeded fixtures the browser tests read, and are removed afterwards.
 */
import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
} from '@playwright/test'
import {
  addDays,
  venueClock,
  type BookingConfirmation,
  type CalendarDay,
  type CreateBookingResult,
  type PitchAvailability,
} from '@pitchup/shared'
import { get, post } from '../support/api'
import { createPlayer, db, uniqueEmail, venue } from '../support/db'
import { E2E_BASE_URL } from '../support/env'
import { resetRateLimits, signInApi } from '../support/helpers'

const started = new Date()
const today = venueClock(started).date
const day = (n: number) => addDays(today, n)

let teren1: string // 5v5, 120 RON/h, lends shirts (2 red, 2 blue, 1 yellow)
let teren2: string // 7v7, 180 RON/h, no shirts
let other: APIRequestContext // a second player

const body = (patch: Record<string, unknown> = {}) => ({
  pitchId: teren1,
  date: day(10),
  startTime: '18:00',
  endTime: '20:00',
  teamCount: 2,
  teamsData: [{}, {}],
  ...patch,
})

const book = (r: APIRequestContext, patch: Record<string, unknown> = {}) =>
  post<CreateBookingResult>(r, '/bookings', body(patch))

const pay = (r: APIRequestContext, bookingId: string, outcome: 'succeed' | 'decline' = 'succeed') =>
  post<BookingConfirmation>(r, '/payments/test/confirm', { bookingId, outcome })

test.beforeAll(async () => {
  const g = await venue('gheorgheni')
  teren1 = g.pitches[0]!.id
  teren2 = g.pitches[1]!.id
  const email = uniqueEmail('booker')
  await createPlayer(email)
  other = await playwrightRequest.newContext({ baseURL: E2E_BASE_URL })
  await signInApi(other, email, 'Testing123')
})

test.beforeEach(async ({ request }) => {
  await resetRateLimits(request)
  await signInApi(request, 'player@demo.ro', 'Player1234!')
})

test.afterAll(async () => {
  await db.booking.deleteMany({
    where: { createdAt: { gte: started }, pitchId: { in: [teren1, teren2] } },
  })
  await other?.dispose()
})

test.describe('setup', () => {
  test('payments run in test mode without Stripe keys', async ({ request }) => {
    expect((await get(request, '/payments/config')).data).toEqual({
      provider: 'test',
      publishableKey: null,
    })
    expect((await get(request, '/payments/methods')).data).toEqual([])
    expect((await post(request, '/payments/setup-intent', {})).status).toBe(503)
    // The Stripe webhook does not exist without Stripe.
    expect((await request.post('/api/v1/payments/webhook', { data: '{}' })).status()).toBe(404)
  })

  test('booking needs an account', async () => {
    const anonymous = await playwrightRequest.newContext({ baseURL: E2E_BASE_URL })
    expect((await book(anonymous)).status).toBe(401)
    await anonymous.dispose()
  })
})

test.describe('creating and paying', () => {
  test('a booking is PENDING, priced at the hourly rate, and confirmed by payment', async ({
    request,
  }) => {
    const r = await book(request, { date: day(11) })
    expect(r.status).toBe(201)
    expect(r.data).toMatchObject({ total: 240, payment: { provider: 'test' } })
    expect(r.data!.reference).toMatch(/^#[A-Z0-9]{6}$/)
    const holdMinutes = (new Date(r.data!.holdExpiresAt).getTime() - Date.now()) / 60_000
    expect(holdMinutes).toBeGreaterThan(14)
    // Fifteen minutes from the server's clock; a few ms of skew from this
    // process's clock is not a failure.
    expect(holdMinutes).toBeLessThanOrEqual(15.05)

    const row = await db.booking.findUniqueOrThrow({ where: { id: r.data!.bookingId } })
    expect(row).toMatchObject({ status: 'PENDING', paymentProvider: 'test', shirtSets: 0 })
    // The player pays the pitch price, all of it the venue's (C-15: no commission).
    expect(Number(row.totalAmount)).toBe(240)

    const paid = await pay(request, r.data!.bookingId)
    expect(paid.status).toBe(200)
    expect(paid.data).toMatchObject({
      status: 'CONFIRMED',
      date: day(11),
      startTime: '18:00',
      endTime: '20:00',
      minutes: 120,
      total: 240,
      pitch: { name: 'Teren 1' },
      company: { name: 'Arena Gheorgheni' },
    })
    expect(paid.data!.paidAt).not.toBeNull()

    // Paying twice changes nothing.
    expect((await pay(request, r.data!.bookingId)).data!.status).toBe('CONFIRMED')

    const slots = (
      await get<PitchAvailability>(request, `/pitches/${teren1}/availability?date=${day(11)}`)
    ).data!.slots
    expect(slots.filter(s => s.status === 'booked').map(s => s.time)).toEqual([
      '18:00',
      '18:30',
      '19:00',
      '19:30',
    ])
  })

  test('a declined card cancels the booking and frees the slot', async ({ request }) => {
    const r = await book(request, { date: day(12) })
    const declined = await pay(request, r.data!.bookingId, 'decline')
    expect(declined.data).toMatchObject({ status: 'CANCELLED' })
    expect(declined.data!.cancellationReason).toMatch(/declined/)
    expect((await book(other, { date: day(12) })).status).toBe(201)
  })

  test('another player cannot take a slot that is held or paid', async ({ request }) => {
    const r = await book(request, { date: day(13) })
    expect(r.status).toBe(201)
    const clash = await book(other, { date: day(13), startTime: '19:00', endTime: '21:00' })
    expect(clash.status).toBe(409)
    expect(clash.error?.details).toEqual({ reason: 'SLOT_CONFLICT' })
    // Back to back is fine: half-open intervals.
    expect(
      (await book(other, { date: day(13), startTime: '20:00', endTime: '21:00' })).status
    ).toBe(201)
  })

  test('two players racing for one slot: exactly one gets it', async ({ request }) => {
    const [a, b] = await Promise.all([
      book(request, { date: day(14) }),
      book(other, { date: day(14) }),
    ])
    expect([a.status, b.status].sort()).toEqual([201, 409])
  })

  test("a player's own unpaid attempt is replaced, not a conflict", async ({ request }) => {
    const first = await book(request, { date: day(15) })
    const second = await book(request, { date: day(15), startTime: '18:30', endTime: '20:30' })
    expect(second.status).toBe(201)
    const old = await db.booking.findUniqueOrThrow({ where: { id: first.data!.bookingId } })
    expect(old).toMatchObject({
      status: 'CANCELLED',
      cancellationReason: 'Replaced by a new checkout',
    })
  })

  test('an abandoned checkout stops holding the slot after 15 minutes', async ({ request }) => {
    const abandoned = await book(request, { date: day(16) })
    await db.booking.update({
      where: { id: abandoned.data!.bookingId },
      data: { createdAt: new Date(Date.now() - 16 * 60_000) },
    })
    const taken = await book(other, { date: day(16) })
    expect(taken.status).toBe(201)
    await pay(other, taken.data!.bookingId)

    // The first player pays late: there is no slot left, so it is refunded in full.
    const late = await pay(request, abandoned.data!.bookingId)
    expect(late.data!.status).toBe('CANCELLED')
    const row = await db.booking.findUniqueOrThrow({ where: { id: abandoned.data!.bookingId } })
    expect(Number(row.refundAmount)).toBe(240)
    expect(row.stripeRefundId).toMatch(/^test_re_/)
  })
})

test.describe('rules', () => {
  for (const [label, patch, message] of [
    ['outside opening hours', { startTime: '22:30', endTime: '23:30' }, /not open/],
    ['a day the pitch is closed for maintenance', { date: day(3) }, /not open/],
    ['beyond the advance booking window', { date: day(61) }, /days ahead/],
    ['off the half-hour grid', { startTime: '18:15', endTime: '19:15' }, /Invalid request/],
    ['longer than four hours', { startTime: '10:00', endTime: '14:30' }, /Invalid request/],
    ['a date that has passed', { date: day(-1) }, /passed/],
  ] as const) {
    test(`refuses ${label}`, async ({ request }) => {
      const r = await book(request, patch)
      expect(r.status).toBe(400)
      expect(r.error?.message).toMatch(message)
    })
  }

  test('free shirts: one set per team but one, from what the pitch has', async ({ request }) => {
    const three = await book(request, {
      date: day(17),
      teamCount: 3,
      teamsData: [{ colour: 'RED' }, { colour: 'BLUE' }, {}],
      wantsShirts: true,
    })
    expect(three.status).toBe(201)
    const row = await db.booking.findUniqueOrThrow({ where: { id: three.data!.bookingId } })
    expect(row.shirtSets).toBe(2)
    expect(Number(row.totalAmount)).toBe(240) // shirts add nothing

    const green = await book(request, {
      date: day(18),
      wantsShirts: true,
      teamsData: [{ colour: 'GREEN' }, {}],
    })
    expect(green.status).toBe(400)
    expect(green.error?.message).toMatch(/no green shirts/)

    const none = await book(request, { pitchId: teren2, date: day(18), wantsShirts: true })
    expect(none.status).toBe(400)
    expect(none.error?.message).toMatch(/does not lend shirts/)
  })

  test('a Suspended player cannot book', async ({ request }) => {
    await db.user.update({ where: { email: 'player@demo.ro' }, data: { trustScore: 20 } })
    try {
      const r = await book(request, { date: day(19) })
      expect(r.status).toBe(403)
      expect(r.error?.details).toEqual({ reason: 'TRUST_SCORE_TOO_LOW' })
    } finally {
      await db.user.update({ where: { email: 'player@demo.ro' }, data: { trustScore: 100 } })
    }
  })

  test('an inactive pitch takes no bookings', async ({ request }) => {
    const inactive = await venue('inactive')
    const r = await book(request, { pitchId: inactive.pitches[0]!.id, date: day(19) })
    expect([403, 404]).toContain(r.status)
  })

  test('a booking is visible to its player only', async ({ request }) => {
    const r = await book(request, { date: day(20) })
    expect((await get(request, `/bookings/${r.data!.bookingId}`)).status).toBe(200)
    expect((await get(other, `/bookings/${r.data!.bookingId}`)).status).toBe(404)
    expect((await pay(other, r.data!.bookingId)).status).toBe(404)
  })
})

test('the calendar gives one status per day', async ({ request }) => {
  const days = (
    await get<CalendarDay[]>(request, `/pitches/${teren1}/calendar?from=${today}&days=7`)
  ).data!
  expect(days.map(d => d.date)).toEqual([0, 1, 2, 3, 4, 5, 6].map(day))
  // Seeded on Teren 1: fully booked the day after tomorrow, closed the day after that.
  expect(days[2]!.status).toBe('full')
  expect(days[3]!.status).toBe('closed')
  expect(days[1]!.status).toBe('available')
  expect((await get(request, `/pitches/${teren1}/calendar?from=2026-02-31&days=7`)).status).toBe(
    400
  )
})
