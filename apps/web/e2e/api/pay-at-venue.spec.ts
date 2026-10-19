/**
 * Paying at the venue with an online deposit — C-8. Test-payment mode.
 *
 * Uses Mănăștur Football Park (its manager is venue-manastur@demo.ro), 40+
 * days out for new bookings, and puts its payment settings back afterwards.
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
  type BookingDetail,
  type CreateBookingResult,
  type ManagerBooking,
  type ManagerBookingPage,
  type PaymentOptions,
} from '@pitchup/shared'
import { get, post, put } from '../support/api'
import { createPlayer, db, seedBooking, uniqueEmail, venue } from '../support/db'
import { E2E_BASE_URL } from '../support/env'
import { resetRateLimits, signInApi } from '../support/helpers'

const started = new Date()
const day = (n: number) => addDays(venueClock(started).date, n)
const r2 = (n: number) => Math.round(n * 100) / 100

let companyId: string
let pitchId: string
let manager: APIRequestContext
let player: APIRequestContext
let playerId: string

const contexts: APIRequestContext[] = []
async function context(email: string, password: string) {
  const ctx = await playwrightRequest.newContext({ baseURL: E2E_BASE_URL })
  contexts.push(ctx)
  await signInApi(ctx, email, password)
  return ctx
}

const settings = (paymentMode: string, depositPercent = 20) =>
  put(manager, '/manager/settings/payments', { paymentMode, depositPercent })

const book = (r: APIRequestContext, date: string, paymentMethod: string) =>
  post<CreateBookingResult>(r, '/bookings', {
    pitchId,
    date,
    startTime: '18:00',
    endTime: '19:30',
    teamCount: 2,
    teamsData: [{}, {}],
    paymentMethod,
  })

const pay = (r: APIRequestContext, bookingId: string) =>
  post<BookingConfirmation>(r, '/payments/test/confirm', { bookingId, outcome: 'succeed' })

/** A booking that started `hoursAgo` ago, paid at the venue with a 20% deposit. */
async function startedBooking(
  hoursAgo: number,
  method: 'VENUE_REFUND_DEPOSIT' | 'VENUE_DEPOSIT_TOWARDS'
) {
  const b = await seedBooking({
    pitchId,
    playerId,
    startsIn: -hoursAgo,
    status: 'CONFIRMED',
    rate: 150,
  })
  return db.booking.update({
    where: { id: b.id },
    data: {
      paymentMethod: method,
      depositAmount: 60,
      dueAtVenue: method === 'VENUE_REFUND_DEPOSIT' ? 300 : 240,
    },
  })
}

test.beforeAll(async () => {
  const m = await venue('manastur')
  companyId = m.id
  pitchId = m.pitches[0]!.id
  manager = await context('venue-manastur@demo.ro', 'Player1234!')
  const email = uniqueEmail('venuepay')
  await createPlayer(email)
  playerId = (await db.user.findUniqueOrThrow({ where: { email } })).id
  player = await context(email, 'Testing123')
})

test.beforeEach(async ({ request }) => {
  await resetRateLimits(request)
})

test.afterAll(async () => {
  await db.company.update({
    where: { id: companyId },
    data: { paymentMode: 'ONLINE', depositPercent: 20 },
  })
  await db.booking.deleteMany({ where: { playerId } })
  for (const c of contexts) await c.dispose()
})

test.describe('the venue setting', () => {
  test('a manager sets the mode and a deposit of 0–50%; players may not', async () => {
    expect((await settings('ONLINE_OR_VENUE', 55)).status).toBe(400)
    const r = await settings('ONLINE_OR_VENUE', 25)
    expect(r.data).toEqual({ paymentMode: 'ONLINE_OR_VENUE', depositPercent: 25 })
    expect((await get(manager, '/manager/settings/payments')).data).toEqual(r.data)
    expect((await settings('ONLINE')).status).toBe(200)
    expect((await put(player, '/manager/settings/payments', r.data)).status).toBe(403)
  })
})

test.describe('who may pay at the venue', () => {
  test('70+ trust chooses; below 70 pays online; a venue-only venue refuses them', async ({
    request,
  }) => {
    await settings('ONLINE_OR_VENUE', 20)
    const options = await get<PaymentOptions>(player, `/pitches/${pitchId}/payment-options`)
    expect(options.data).toEqual({
      mode: 'ONLINE_OR_VENUE',
      depositPercent: 20,
      methods: ['ONLINE', 'VENUE_DEPOSIT_TOWARDS', 'VENUE_REFUND_DEPOSIT'],
      trustTooLow: false,
      refundPolicy: { fullRefundHours: 12, partialRefundHours: 2, partialRefundPercent: 75 },
      autoApproveBookings: true,
    })
    expect((await get(request, `/pitches/${pitchId}/payment-options`)).status).toBe(401)

    await db.user.update({ where: { id: playerId }, data: { trustScore: 65 } })
    try {
      expect(
        (await get<PaymentOptions>(player, `/pitches/${pitchId}/payment-options`)).data
      ).toMatchObject({ methods: ['ONLINE'], trustTooLow: true })
      const refused = await book(player, day(41), 'VENUE_DEPOSIT_TOWARDS')
      expect(refused.status).toBe(403)
      expect(refused.error?.details).toEqual({ reason: 'PAYMENT_METHOD_UNAVAILABLE' })

      await settings('VENUE', 20)
      expect(
        (await get<PaymentOptions>(player, `/pitches/${pitchId}/payment-options`)).data
      ).toMatchObject({ methods: [], trustTooLow: true })
      expect((await book(player, day(41), 'ONLINE')).status).toBe(403)
    } finally {
      await db.user.update({ where: { id: playerId }, data: { trustScore: 100 } })
    }
    // An online-only venue never takes payment at the venue.
    await settings('ONLINE')
    expect((await book(player, day(41), 'VENUE_REFUND_DEPOSIT')).status).toBe(403)
  })
})

test.describe('booking with a deposit', () => {
  test('only the deposit is charged; cancelling refunds the deposit by the usual tiers', async () => {
    await settings('ONLINE_OR_VENUE', 20)
    const created = await book(player, day(42), 'VENUE_DEPOSIT_TOWARDS')
    expect(created.status).toBe(201)
    const total = created.data!.total
    expect(created.data).toMatchObject({
      payNow: r2(total * 0.2),
      dueAtVenue: r2(total * 0.8),
      payment: { provider: 'test' },
    })
    expect((await pay(player, created.data!.bookingId)).data?.status).toBe('CONFIRMED')

    const detail = await get<BookingDetail>(player, `/bookings/${created.data!.bookingId}`)
    expect(detail.data).toMatchObject({
      paymentMethod: 'VENUE_DEPOSIT_TOWARDS',
      deposit: r2(total * 0.2),
      dueAtVenue: r2(total * 0.8),
      attendedAt: null,
      cancellation: { refundPercent: 100, refundAmount: r2(total * 0.2) },
    })

    const cancelled = await post<{ refundAmount: number }>(
      player,
      `/bookings/${created.data!.bookingId}/cancel`,
      {}
    )
    expect(cancelled.data?.refundAmount).toBe(r2(total * 0.2))
  })

  test('with no deposit nothing is paid online and the booking is confirmed at once', async () => {
    await settings('VENUE', 0)
    const created = await book(player, day(43), 'VENUE_DEPOSIT_TOWARDS')
    expect(created.status).toBe(201)
    expect(created.data).toMatchObject({
      payNow: 0,
      dueAtVenue: created.data!.total,
      payment: { provider: 'none' },
    })
    const b = await db.booking.findUniqueOrThrow({ where: { id: created.data!.bookingId } })
    expect(b).toMatchObject({ status: 'CONFIRMED', paymentProvider: null, paidAt: null })
    // Cancelling refunds nothing: nothing was paid.
    const cancelled = await post<{ refundAmount: number }>(player, `/bookings/${b.id}/cancel`, {})
    expect(cancelled.data?.refundAmount).toBe(0)
  })
})

test.describe("the manager's Bookings page", () => {
  test('confirming attendance refunds the deposit for "deposit back", once', async () => {
    const b = await startedBooking(1, 'VENUE_REFUND_DEPOSIT')
    const upcoming = await seedBooking({ pitchId, playerId, startsIn: 30, status: 'CONFIRMED' })

    const list = (await get<ManagerBookingPage>(manager, '/manager/bookings?limit=100')).data!
    const row = list.items.find(r => r.id === b.id)
    expect(row).toMatchObject({
      paymentMethod: 'VENUE_REFUND_DEPOSIT',
      deposit: 60,
      dueAtVenue: 300,
      canConfirmAttended: true,
      canReportNoShow: true,
    })
    expect(list.items.find(r => r.id === upcoming.id)).toMatchObject({
      canConfirmAttended: false,
      canReportNoShow: false,
    })

    const done = await post<ManagerBooking>(manager, `/manager/bookings/${b.id}/attended`, {})
    expect(done.data).toMatchObject({ canConfirmAttended: false, canReportNoShow: false })
    expect(done.data?.attendedAt).not.toBeNull()
    const after = await db.booking.findUniqueOrThrow({ where: { id: b.id } })
    expect(Number(after.refundAmount)).toBe(60)
    expect(after.stripeRefundId).not.toBeNull()
    expect(
      await db.notification.count({ where: { userId: playerId, type: 'REFUND_PROCESSED' } })
    ).toBe(1)

    const twice = await post(manager, `/manager/bookings/${b.id}/attended`, {})
    expect(twice.status).toBe(409)
    const early = await post(manager, `/manager/bookings/${upcoming.id}/attended`, {})
    expect(early.error?.details).toEqual({ reason: 'NOT_ALLOWED' })
    // The player sees it paid.
    expect((await get<BookingDetail>(player, `/bookings/${b.id}`)).data?.attendedAt).not.toBeNull()
  })

  test('"deposit counts": confirming attendance refunds nothing', async () => {
    const b = await startedBooking(1, 'VENUE_DEPOSIT_TOWARDS')
    expect((await post(manager, `/manager/bookings/${b.id}/attended`, {})).status).toBe(200)
    expect((await db.booking.findUniqueOrThrow({ where: { id: b.id } })).refundAmount).toBeNull()
  })

  test('a no-show keeps the deposit, costs 20 trust points, and can be disputed', async () => {
    const b = await startedBooking(2, 'VENUE_DEPOSIT_TOWARDS')
    const soon = await startedBooking(0.25, 'VENUE_DEPOSIT_TOWARDS')
    const tooEarly = await post(manager, `/manager/bookings/${soon.id}/no-show`, {})
    expect(tooEarly.status).toBe(409)

    const before = (await db.user.findUniqueOrThrow({ where: { id: playerId } })).trustScore
    const r = await post<ManagerBooking>(manager, `/manager/bookings/${b.id}/no-show`, {
      reason: 'Nobody came.',
    })
    expect(r.data).toMatchObject({ status: 'NO_SHOW', canConfirmAttended: false })
    const after = await db.booking.findUniqueOrThrow({
      where: { id: b.id },
      include: { noShow: true },
    })
    expect(after.refundAmount).toBeNull()
    expect(Number(after.noShow!.penaltyAmount)).toBe(60)
    expect((await db.user.findUniqueOrThrow({ where: { id: playerId } })).trustScore).toBe(
      Math.max(0, before - 20)
    )
    expect(
      await db.trustScoreEvent.count({ where: { relatedBookingId: b.id, reason: 'NO_SHOW' } })
    ).toBe(1)
    // The E06 dispute works on it.
    expect(
      (
        await post(player, `/bookings/${b.id}/dispute`, {
          disputeText: 'I was there at 18:00, ask the guard.',
        })
      ).status
    ).toBe(200)
    expect((await post(manager, `/manager/bookings/${b.id}/attended`, {})).status).toBe(409)
    await db.user.update({ where: { id: playerId }, data: { trustScore: 100 } })
  })

  test("another venue's manager cannot see or act on these bookings", async () => {
    const b = await startedBooking(1, 'VENUE_DEPOSIT_TOWARDS')
    const otherManager = await context('venue-gheorgheni@demo.ro', 'Player1234!')
    const list = (await get<ManagerBookingPage>(otherManager, '/manager/bookings?limit=100')).data!
    expect(list.items.map(r => r.id)).not.toContain(b.id)
    expect((await post(otherManager, `/manager/bookings/${b.id}/attended`, {})).status).toBe(404)
    expect((await post(player, `/manager/bookings/${b.id}/attended`, {})).status).toBe(403)
  })
})
