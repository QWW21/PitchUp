/**
 * My Bookings API — E06-01 … E06-05: the list and its tabs, counts, the
 * detail, cancelling with refunds, no-show disputes and reviews.
 *
 * Each test uses a fresh player. Bookings in awkward states (finished, a
 * no-show, five hours from now) are written straight to the test database;
 * the rest go through the real booking and test-payment endpoints.
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
  type BookingCounts,
  type BookingDetail,
  type BookingListPage,
  type CancelBookingResult,
  type CreateBookingResult,
  type ReviewPage,
} from '@pitchup/shared'
import { del, get, post, put } from '../support/api'
import { createPlayer, db, seedBooking as seed, uniqueEmail, venue } from '../support/db'
import { E2E_BASE_URL } from '../support/env'
import { resetRateLimits, signInApi } from '../support/helpers'

const HOUR = 3_600_000
const started = new Date()
const day = (n: number) => addDays(venueClock(started).date, n)

let pitchId: string // Arena Gheorgheni, Teren 2: 180 RON/h
let playerId: string
let api: APIRequestContext
const contexts: APIRequestContext[] = []

async function newPlayer() {
  const email = uniqueEmail('mine')
  await createPlayer(email)
  const ctx = await playwrightRequest.newContext({ baseURL: E2E_BASE_URL })
  contexts.push(ctx)
  await signInApi(ctx, email, 'Testing123')
  const user = await db.user.findUniqueOrThrow({ where: { email } })
  return { ctx, id: user.id }
}

const seedBooking = (opts: {
  player?: string
  startsIn: number
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW'
  paid?: boolean
  createdAgo?: number
}) => seed({ ...opts, pitchId, playerId: opts.player ?? playerId })

const list = (ctx: APIRequestContext, tab: string, extra = '') =>
  get<BookingListPage>(ctx, `/bookings?tab=${tab}${extra}`)

test.beforeAll(async () => {
  const g = await venue('gheorgheni')
  pitchId = g.pitches[1]!.id
})

test.beforeEach(async ({ request }) => {
  await resetRateLimits(request)
  const p = await newPlayer()
  api = p.ctx
  playerId = p.id
})

test.afterAll(async () => {
  await db.booking.deleteMany({
    where: {
      createdAt: { gte: new Date(started.getTime() - 100 * HOUR) },
      player: { email: { endsWith: '@e2e.test' } },
    },
  })
  for (const c of contexts) await c.dispose()
})

test.describe('the list (E06-01)', () => {
  test('needs an account', async () => {
    const anonymous = await playwrightRequest.newContext({ baseURL: E2E_BASE_URL })
    expect((await list(anonymous, 'upcoming')).status).toBe(401)
    await anonymous.dispose()
  })

  test('sorts bookings into tabs, settling finished and abandoned ones', async () => {
    const soon = await seedBooking({ startsIn: 5, status: 'CONFIRMED' })
    const later = await seedBooking({ startsIn: 30, status: 'CONFIRMED' })
    const holding = await seedBooking({ startsIn: 50, status: 'PENDING', createdAgo: 0.05 })
    const abandoned = await seedBooking({ startsIn: 70, status: 'PENDING', createdAgo: 1 })
    const played = await seedBooking({ startsIn: -5, status: 'CONFIRMED' })
    const noShow = await seedBooking({ startsIn: -30, status: 'NO_SHOW' })
    const cancelled = await seedBooking({ startsIn: 40, status: 'CANCELLED' })
    const neverPaid = await seedBooking({ startsIn: 45, status: 'CANCELLED', paid: false })

    const upcoming = (await list(api, 'upcoming')).data!
    expect(upcoming.items.map(b => b.id)).toEqual([soon.id, later.id, holding.id])
    expect(upcoming.items[0]).toMatchObject({
      status: 'CONFIRMED',
      total: 360,
      minutes: 120,
      pitch: { name: 'Teren 2', surfaceType: 'ARTIFICIAL_GRASS' },
      company: { name: 'Arena Gheorgheni' },
      hasReview: false,
    })
    expect(upcoming.items[0]!.reference).toMatch(/^#[A-Z0-9]{6}$/)

    const past = (await list(api, 'past')).data!
    expect(past.items.map(b => [b.id, b.status])).toEqual([
      [played.id, 'COMPLETED'], // ended, so settled to COMPLETED
      [noShow.id, 'NO_SHOW'],
    ])
    expect(past.items[0]!.canReview).toBe(true)

    // Only real (paid) bookings show as cancelled; the abandoned checkout and the
    // unpaid one are not something the player cancelled.
    const cancelledTab = (await list(api, 'cancelled')).data!
    expect(cancelledTab.items.map(b => b.id)).toEqual([cancelled.id])
    const settled = await db.booking.findUniqueOrThrow({ where: { id: abandoned.id } })
    expect(settled).toMatchObject({
      status: 'CANCELLED',
      cancellationReason: 'Checkout not completed',
    })
    void neverPaid

    expect((await get<BookingCounts>(api, '/bookings/count')).data).toEqual({
      upcoming: 3,
      unreviewed: 1,
    })
  })

  test('pages with a cursor, clamps the limit, and refuses an unknown tab', async () => {
    for (const h of [10, 20, 30, 40, 50]) await seedBooking({ startsIn: h, status: 'CONFIRMED' })
    const first = (await list(api, 'upcoming', '&limit=2')).data!
    expect(first.items).toHaveLength(2)
    expect(first.hasMore).toBe(true)
    const second = (await list(api, 'upcoming', `&limit=2&cursor=${first.nextCursor}`)).data!
    const third = (await list(api, 'upcoming', `&limit=2&cursor=${second.nextCursor}`)).data!
    expect(third).toMatchObject({ hasMore: false, nextCursor: null })
    const ids = [...first.items, ...second.items, ...third.items].map(b => b.id)
    expect(new Set(ids).size).toBe(5)

    expect((await list(api, 'upcoming', '&limit=999')).status).toBe(200)
    expect((await list(api, 'someday')).status).toBe(400)
    expect((await list(api, 'past')).data).toEqual({ items: [], nextCursor: null, hasMore: false })
  })
})

test.describe('the detail (E06-02)', () => {
  test('a booking made and paid through the API, with its timeline', async () => {
    const created = await post<CreateBookingResult>(api, '/bookings', {
      pitchId,
      date: day(30),
      startTime: '10:00',
      endTime: '12:00',
      teamCount: 2,
      teamsData: [{ playerCount: 6 }, { playerCount: 7 }],
      noteToManager: 'Goals at full size, please',
    })
    expect(created.status).toBe(201)
    await post(api, '/payments/test/confirm', {
      bookingId: created.data!.bookingId,
      outcome: 'succeed',
    })

    const d = (await get<BookingDetail>(api, `/bookings/${created.data!.bookingId}`)).data!
    expect(d).toMatchObject({
      status: 'CONFIRMED',
      date: day(30),
      startTime: '10:00',
      endTime: '12:00',
      total: 360,
      note: 'Goals at full size, please',
      pitch: { name: 'Teren 2', size: 'SEVEN_A_SIDE' },
      company: { name: 'Arena Gheorgheni', city: 'Cluj-Napoca' },
      teams: [
        { name: 'Team A', players: 6, colour: null },
        { name: 'Team B', players: 7, colour: null },
      ],
      payment: { provider: 'test', cardLast4: null, refundAmount: null },
      cancellation: { refundPercent: 100, refundAmount: 360 },
      review: null,
      canReview: false,
      noShow: null,
    })
    expect(d.statusHistory.map(s => s.status)).toEqual(['PENDING', 'CONFIRMED'])
  })

  test('a booking from before the timeline existed keeps its whole history', async () => {
    // Seeded rows have no status events; settling then records COMPLETED.
    const b = await seedBooking({ startsIn: -5, status: 'CONFIRMED' })
    const d = (await get<BookingDetail>(api, `/bookings/${b.id}`)).data!
    expect(d.status).toBe('COMPLETED')
    expect(d.statusHistory.map(s => s.status)).toEqual(['PENDING', 'CONFIRMED', 'COMPLETED'])
    // Played when the game ended, not when it was settled.
    const row = await db.booking.findUniqueOrThrow({ where: { id: b.id } })
    expect(d.statusHistory.at(-1)!.at).toBe(row.endTime.toISOString())
  })

  test("is another player's 404", async () => {
    const b = await seedBooking({ startsIn: 30, status: 'CONFIRMED' })
    const other = await newPlayer()
    expect((await get(other.ctx, `/bookings/${b.id}`)).status).toBe(404)
    expect((await post(other.ctx, `/bookings/${b.id}/cancel`, {})).status).toBe(404)
  })
})

test.describe('cancelling (E06-03)', () => {
  for (const [label, hours, percent, amount] of [
    ['more than 24 hours ahead: all of it back', 48, 100, 360],
    ['between 2 and 24 hours: half back', 5, 50, 180],
    ['under 2 hours: nothing back', 1, 0, 0],
  ] as const) {
    test(label, async () => {
      const b = await seedBooking({ startsIn: hours, status: 'CONFIRMED' })
      const preview = (await get<BookingDetail>(api, `/bookings/${b.id}`)).data!.cancellation
      expect(preview).toEqual({ refundPercent: percent, refundAmount: amount })

      const r = await post<CancelBookingResult>(api, `/bookings/${b.id}/cancel`, {})
      expect(r.status).toBe(200)
      expect(r.data).toMatchObject({ refundAmount: amount, refundPercent: percent })
      expect(r.data!.booking).toMatchObject({
        status: 'CANCELLED',
        cancelledBy: 'PLAYER',
        cancellation: null,
        payment: { refundAmount: amount },
      })
      expect(r.data!.booking.statusHistory.at(-1)!.status).toBe('CANCELLED')
      const row = await db.booking.findUniqueOrThrow({ where: { id: b.id } })
      expect(row.stripeRefundId).toEqual(amount > 0 ? expect.stringMatching(/^test_re_/) : null)

      // Twice is refused.
      const again = await post(api, `/bookings/${b.id}/cancel`, {})
      expect(again.status).toBe(400)
      expect(again.error?.details).toEqual({ reason: 'NOT_CANCELLABLE' })
    })
  }

  test('a booking that has started cannot be cancelled', async () => {
    const b = await seedBooking({ startsIn: -0.5, status: 'CONFIRMED' })
    const r = await post(api, `/bookings/${b.id}/cancel`, {})
    expect(r.status).toBe(400)
  })

  test('cancelling frees the slot for someone else', async () => {
    const created = await post<CreateBookingResult>(api, '/bookings', {
      pitchId,
      date: day(31),
      startTime: '10:00',
      endTime: '12:00',
      teamCount: 2,
      teamsData: [{}, {}],
    })
    await post(api, '/payments/test/confirm', {
      bookingId: created.data!.bookingId,
      outcome: 'succeed',
    })
    await post(api, `/bookings/${created.data!.bookingId}/cancel`, {})
    const other = await newPlayer()
    const retaken = await post(other.ctx, '/bookings', {
      pitchId,
      date: day(31),
      startTime: '10:00',
      endTime: '12:00',
      teamCount: 2,
      teamsData: [{}, {}],
    })
    expect(retaken.status).toBe(201)
  })
})

test.describe('no-show disputes (E06-04)', () => {
  async function noShow(reportedAgoHours: number) {
    const b = await seedBooking({ startsIn: -reportedAgoHours - 3, status: 'NO_SHOW' })
    const manager = await db.user.findUniqueOrThrow({ where: { email: 'manager@demo.ro' } })
    await db.noShow.create({
      data: {
        bookingId: b.id,
        reportedByManagerId: manager.id,
        reason: 'Nobody came',
        penaltyAmount: 82,
        createdAt: new Date(Date.now() - reportedAgoHours * HOUR),
      },
    })
    return b
  }

  test('opens a dispute once and tells the admins', async () => {
    const b = await noShow(2)
    const before = (await get<BookingDetail>(api, `/bookings/${b.id}`)).data!.noShow!
    expect(before.disputeStatus).toBe('NONE')
    expect(before.disputeUntil).not.toBeNull()

    const r = await post(api, `/bookings/${b.id}/dispute`, {
      disputeText: 'We played; ask the referee.',
    })
    expect(r.status).toBe(200)
    const row = await db.noShow.findUniqueOrThrow({ where: { bookingId: b.id } })
    expect(row).toMatchObject({ disputeStatus: 'OPEN', disputeText: 'We played; ask the referee.' })
    expect(
      await db.notification.count({
        where: { type: 'DISPUTE_OPENED', data: { path: ['bookingId'], equals: b.id } },
      })
    ).toBeGreaterThan(0)

    const again = await post(api, `/bookings/${b.id}/dispute`, { disputeText: 'Again' })
    expect(again.status).toBe(409)
  })

  test('closes after 24 hours, and only no-shows can be disputed', async () => {
    const late = await noShow(25)
    const r = await post(api, `/bookings/${late.id}/dispute`, { disputeText: 'Too late?' })
    expect(r.status).toBe(400)
    expect(r.error?.details).toEqual({ reason: 'DISPUTE_WINDOW_CLOSED' })

    const fine = await seedBooking({ startsIn: -5, status: 'COMPLETED' })
    expect((await post(api, `/bookings/${fine.id}/dispute`, { disputeText: 'x' })).status).toBe(400)
    expect((await post(api, `/bookings/${late.id}/dispute`, { disputeText: '' })).status).toBe(400)
  })
})

test.describe('reviews (E06-05)', () => {
  test('a finished booking can be reviewed once; the review shows on the pitch', async () => {
    const b = await seedBooking({ startsIn: -4, status: 'CONFIRMED' }) // finished: settles to COMPLETED
    const r = await post<{ id: string }>(api, '/reviews', {
      bookingId: b.id,
      rating: 5,
      text: 'Lovely pitch, lights on time.',
    })
    expect(r.status).toBe(201)

    const again = await post(api, '/reviews', { bookingId: b.id, rating: 4 })
    expect(again.status).toBe(409)

    const d = (await get<BookingDetail>(api, `/bookings/${b.id}`)).data!
    expect(d).toMatchObject({ status: 'COMPLETED', canReview: false, review: { rating: 5 } })

    const page = (await get<ReviewPage>(api, `/reviews?pitchId=${pitchId}&limit=50`)).data!
    expect(page.reviews.some(rv => rv.id === r.data!.id)).toBe(true)

    // The venue's manager is told.
    const owner = await db.company.findFirstOrThrow({
      where: { pitches: { some: { id: pitchId } } },
    })
    expect(
      await db.notification.count({
        where: {
          userId: owner.ownerId,
          type: 'REVIEW_LEFT',
          data: { path: ['reviewId'], equals: r.data!.id },
        },
      })
    ).toBe(1)
  })

  test('rules: completed only, own only, at least ten characters', async () => {
    const upcoming = await seedBooking({ startsIn: 20, status: 'CONFIRMED' })
    const notYet = await post(api, '/reviews', { bookingId: upcoming.id, rating: 4 })
    expect(notYet.status).toBe(400)
    expect(notYet.error?.details).toEqual({ reason: 'NOT_REVIEWABLE' })

    const done = await seedBooking({ startsIn: -6, status: 'COMPLETED' })
    expect(
      (await post(api, '/reviews', { bookingId: done.id, rating: 4, text: 'Too short' })).status
    ).toBe(400)
    expect((await post(api, '/reviews', { bookingId: done.id, rating: 0 })).status).toBe(400)

    const other = await newPlayer()
    expect((await post(other.ctx, '/reviews', { bookingId: done.id, rating: 4 })).status).toBe(404)

    const old = await seedBooking({ startsIn: -15 * 24, status: 'COMPLETED' })
    const tooLate = await post(api, '/reviews', { bookingId: old.id, rating: 4 })
    expect(tooLate.error?.details).toEqual({ reason: 'REVIEW_WINDOW_CLOSED' })
  })

  test('the author edits and deletes within 24 hours; a deleted review disappears', async () => {
    const b = await seedBooking({ startsIn: -4, status: 'COMPLETED' })
    const { id } = (await post<{ id: string }>(api, '/reviews', { bookingId: b.id, rating: 3 }))
      .data!

    expect(
      (await put(api, `/reviews/${id}`, { rating: 4, text: 'Better than I said.' })).status
    ).toBe(200)
    expect((await db.review.findUniqueOrThrow({ where: { id } })).rating).toBe(4)

    const other = await newPlayer()
    expect((await del(other.ctx, `/reviews/${id}`)).status).toBe(404)

    expect((await del(api, `/reviews/${id}`)).status).toBe(204)
    const page = (await get<ReviewPage>(api, `/reviews?pitchId=${pitchId}&limit=50`)).data!
    expect(page.reviews.some(rv => rv.id === id)).toBe(false)
    // Still reviewed: a deleted review cannot be replaced by a new one.
    expect((await get<BookingDetail>(api, `/bookings/${b.id}`)).data).toMatchObject({
      review: null,
      canReview: false,
    })

    const b2 = await seedBooking({ startsIn: -4, status: 'COMPLETED' })
    const second = (await post<{ id: string }>(api, '/reviews', { bookingId: b2.id, rating: 5 }))
      .data!
    await db.review.update({
      where: { id: second.id },
      data: { createdAt: new Date(Date.now() - 25 * HOUR) },
    })
    const locked = await put(api, `/reviews/${second.id}`, { rating: 1 })
    expect(locked.error?.details).toEqual({ reason: 'EDIT_WINDOW_CLOSED' })
  })
})
