/**
 * The venue's rules — C-9 … C-13: the 12-hour trust window, each venue's
 * refund policy, new-booking notices, the manager declining or cancelling,
 * confirming bookings by hand, and venue details approved again by an admin.
 * Each test makes its own approved venue (open 08:00–23:00, closed Sundays).
 */
import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
} from '@playwright/test'
import type {
  BookingDetail,
  ManagerBooking,
  PendingVenueChange,
  VenueBookingSettings,
  VenueChangesStatus,
} from '@pitchup/shared'
import { get, post, put } from '../support/api'
import { createPlayer, createVenue, db, seedBooking, uniqueEmail } from '../support/db'
import { E2E_BASE_URL, E2E_CRON_SECRET } from '../support/env'
import { resetRateLimits, signInApi } from '../support/helpers'

const HOUR = 3_600_000
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin1234!'
const contexts: APIRequestContext[] = []

async function context(email: string, password = 'Testing123') {
  const ctx = await playwrightRequest.newContext({ baseURL: E2E_BASE_URL })
  contexts.push(ctx)
  await signInApi(ctx, email, password)
  return ctx
}

async function setup() {
  const managerEmail = uniqueEmail('rules-mgr')
  const v = await createVenue(managerEmail, `Rules Arena ${Date.now().toString(36)}`)
  const pitch = await db.pitch.create({
    data: {
      companyId: v.companyId,
      name: 'Teren R',
      surfaceType: 'FUTSAL',
      size: 'FIVE_A_SIDE',
      hourlyRate: 100,
      isActive: true,
    },
  })
  const email = uniqueEmail('rules-p')
  await createPlayer(email)
  const player = await db.user.findUniqueOrThrow({ where: { email }, select: { id: true } })
  return {
    ...v,
    pitchId: pitch.id,
    playerId: player.id,
    player: await context(email),
    manager: await context(managerEmail),
  }
}

/** A weekday five days or so ahead, in the venue's opening hours. */
function bookableDate() {
  const d = new Date(Date.now() + 5 * 24 * HOUR)
  return (d.getDay() === 0 ? new Date(d.getTime() + 24 * HOUR) : d).toISOString().slice(0, 10)
}

async function bookAndPay(s: Awaited<ReturnType<typeof setup>>, startTime = '18:00') {
  const created = await post<{ bookingId: string }>(s.player, '/bookings', {
    pitchId: s.pitchId,
    date: bookableDate(),
    startTime,
    endTime: `${String(Number(startTime.slice(0, 2)) + 1).padStart(2, '0')}:00`,
    teamCount: 2,
    teamsData: [{}, {}],
  })
  expect(created.status).toBe(201)
  await post(s.player, '/payments/test/confirm', {
    bookingId: created.data!.bookingId,
    outcome: 'succeed',
  })
  return created.data!.bookingId
}

const notices = (userId: string, type: string) =>
  db.notification.findMany({ where: { userId, type: type as 'OTP' } })
const trust = async (id: string) =>
  (await db.user.findUniqueOrThrow({ where: { id }, select: { trustScore: true } })).trustScore

test.beforeEach(async ({ request }) => {
  await resetRateLimits(request)
})

test.afterAll(async () => {
  await db.booking.deleteMany({ where: { player: { email: { startsWith: 'rules-p-' } } } })
  await db.company.deleteMany({ where: { owner: { email: { startsWith: 'rules-mgr-' } } } })
  for (const c of contexts) await c.dispose()
})

test.describe('cancelling late (C-9) under the venue’s policy (C-10)', () => {
  test('from 12 hours: everything back and no penalty; under 12: 75% and −5', async () => {
    const s = await setup()
    const early = await seedBooking({
      pitchId: s.pitchId,
      playerId: s.playerId,
      startsIn: 13,
      status: 'CONFIRMED',
    })
    const late = await seedBooking({
      pitchId: s.pitchId,
      playerId: s.playerId,
      startsIn: 5,
      status: 'CONFIRMED',
    })
    const first = await post<{ refundPercent: number }>(
      s.player,
      `/bookings/${early.id}/cancel`,
      {}
    )
    expect(first.data!.refundPercent).toBe(100)
    expect(await trust(s.playerId)).toBe(100)
    const second = await post<{ refundPercent: number; refundAmount: number }>(
      s.player,
      `/bookings/${late.id}/cancel`,
      {}
    )
    expect(second.data).toMatchObject({ refundPercent: 75, refundAmount: 270 })
    expect(await trust(s.playerId)).toBe(95)
  })

  test('a booking keeps the policy it was made under', async () => {
    const s = await setup()
    const strict = { fullRefundHours: 48, partialRefundHours: 24, partialRefundPercent: 50 }
    expect(
      (
        await put<VenueBookingSettings>(s.manager, '/manager/settings/bookings', {
          refundPolicy: strict,
        })
      ).data!.refundPolicy
    ).toEqual(strict)
    const id = await bookAndPay(s)
    expect((await db.booking.findUniqueOrThrow({ where: { id } })).refundPolicy).toEqual(strict)
    // The venue relaxes its policy later; this booking doesn't change.
    await put(s.manager, '/manager/settings/bookings', {
      refundPolicy: { fullRefundHours: 1, partialRefundHours: 0, partialRefundPercent: 0 },
    })
    const detail = await get<BookingDetail>(s.player, `/bookings/${id}`)
    expect(detail.data!.refundPolicy).toBe(
      'Free cancellation up to 48 hours before kick-off; 50% back up to 24 hours before; nothing after.'
    )
    // Shown on the pitch for new bookings.
    const options = await get<{ refundPolicy: object }>(
      s.player,
      `/pitches/${s.pitchId}/payment-options`
    )
    expect(options.data!.refundPolicy).toEqual({
      fullRefundHours: 1,
      partialRefundHours: 0,
      partialRefundPercent: 0,
    })
  })

  test('the policy is checked', async () => {
    const s = await setup()
    const bad = await put(s.manager, '/manager/settings/bookings', {
      refundPolicy: { fullRefundHours: 6, partialRefundHours: 12, partialRefundPercent: 50 },
    })
    expect(bad.status).toBe(400)
    expect(
      (await put(s.player, '/manager/settings/bookings', { autoApproveBookings: false })).status
    ).toBe(403)
  })
})

test.describe('the venue hears of every booking, and may cancel (C-11, C-12)', () => {
  test('a paid booking is a notice for the manager', async () => {
    const s = await setup()
    const id = await bookAndPay(s)
    await expect.poll(async () => (await notices(s.userId, 'BOOKING_RECEIVED')).length).toBe(1)
    expect((await notices(s.userId, 'BOOKING_RECEIVED'))[0]!.data).toEqual({
      bookingId: id,
      link: `/manager/bookings/${id}`,
    })
  })

  test('cancelling: a reason, everything back, no trust lost, the player told', async () => {
    const s = await setup()
    const b = await seedBooking({
      pitchId: s.pitchId,
      playerId: s.playerId,
      startsIn: 3,
      status: 'CONFIRMED',
    })
    expect(
      (await post(s.manager, `/manager/bookings/${b.id}/cancel`, { reason: 'no' })).status
    ).toBe(400)
    const done = await post<ManagerBooking>(s.manager, `/manager/bookings/${b.id}/cancel`, {
      reason: 'The pitch is flooded',
    })
    expect(done.status).toBe(200)
    expect(done.data!.status).toBe('CANCELLED')
    expect(await db.booking.findUniqueOrThrow({ where: { id: b.id } })).toMatchObject({
      cancelledBy: 'MANAGER',
      cancellationReason: 'The pitch is flooded',
    })
    expect(Number((await db.booking.findUniqueOrThrow({ where: { id: b.id } })).refundAmount)).toBe(
      360
    )
    expect(await trust(s.playerId)).toBe(100)
    const told = await notices(s.playerId, 'BOOKING_CANCELLED_MANAGER')
    expect(told[0]!.title).toBe('The venue cancelled your booking')
    expect(told[0]!.body).toContain('The pitch is flooded.')
  })

  test('not once it has started, and not another venue’s booking', async () => {
    const s = await setup()
    const other = await setup()
    const started = await seedBooking({
      pitchId: s.pitchId,
      playerId: s.playerId,
      startsIn: -1,
      status: 'CONFIRMED',
    })
    const why = { reason: 'Something came up' }
    expect((await post(s.manager, `/manager/bookings/${started.id}/cancel`, why)).status).toBe(409)
    expect((await post(other.manager, `/manager/bookings/${started.id}/cancel`, why)).status).toBe(
      404
    )
  })
})

test.describe('confirming each booking by hand (C-13)', () => {
  test('paid, held, then accepted', async () => {
    const s = await setup()
    await put(s.manager, '/manager/settings/bookings', { autoApproveBookings: false })
    const id = await bookAndPay(s)
    const row = await db.booking.findUniqueOrThrow({ where: { id } })
    expect(row.status).toBe('AWAITING_APPROVAL')
    expect(row.approvalDeadline).not.toBeNull()
    await expect.poll(async () => (await notices(s.userId, 'BOOKING_REQUESTED')).length).toBe(1)
    expect(await notices(s.playerId, 'BOOKING_AWAITING_APPROVAL')).toHaveLength(1)
    expect(await notices(s.playerId, 'BOOKING_CONFIRMED')).toHaveLength(0)

    // The slot is held: nobody else can book it meanwhile.
    const email = uniqueEmail('rules-p')
    await createPlayer(email)
    const rival = await post(await context(email), '/bookings', {
      pitchId: s.pitchId,
      date: bookableDate(),
      startTime: '18:00',
      endTime: '19:00',
      teamCount: 2,
      teamsData: [{}, {}],
    })
    expect(rival.status).toBe(409)

    const accepted = await post<ManagerBooking>(s.manager, `/manager/bookings/${id}/accept`, {})
    expect(accepted.data!.status).toBe('CONFIRMED')
    expect(await notices(s.playerId, 'BOOKING_CONFIRMED')).toHaveLength(1)
    // Accepting twice changes nothing.
    expect((await post(s.manager, `/manager/bookings/${id}/accept`, {})).status).toBe(200)
  })

  test('declined: refunded in full; or withdrawn by the player', async () => {
    const s = await setup()
    await put(s.manager, '/manager/settings/bookings', { autoApproveBookings: false })
    const declined = await bookAndPay(s, '18:00')
    const declinedRow = await post<ManagerBooking>(
      s.manager,
      `/manager/bookings/${declined}/cancel`,
      { reason: 'We have a tournament that evening' }
    )
    expect(declinedRow.data!.status).toBe('CANCELLED')
    expect(
      Number((await db.booking.findUniqueOrThrow({ where: { id: declined } })).refundAmount)
    ).toBe(100)
    expect((await notices(s.playerId, 'BOOKING_CANCELLED_MANAGER'))[0]!.title).toBe(
      'Your booking request was declined'
    )

    const withdrawn = await bookAndPay(s, '20:00')
    const back = await post<{ refundPercent: number }>(
      s.player,
      `/bookings/${withdrawn}/cancel`,
      {}
    )
    expect(back.data!.refundPercent).toBe(100)
    expect(await trust(s.playerId)).toBe(100)
  })

  test('unanswered: declined by the hourly job, both told', async ({ request }) => {
    const s = await setup()
    const b = await seedBooking({
      pitchId: s.pitchId,
      playerId: s.playerId,
      startsIn: 30,
      status: 'AWAITING_APPROVAL',
      approvalDeadline: new Date(Date.now() - 60_000),
    })
    const run = await request.get('/api/v1/cron/notifications', {
      headers: { Authorization: `Bearer ${E2E_CRON_SECRET}` },
    })
    expect(run.status()).toBe(200)
    expect(await db.booking.findUniqueOrThrow({ where: { id: b.id } })).toMatchObject({
      status: 'CANCELLED',
      cancelledBy: 'SYSTEM',
    })
    expect((await notices(s.playerId, 'BOOKING_CANCELLED_MANAGER'))[0]!.title).toBe(
      'Your booking request expired'
    )
    expect(await notices(s.userId, 'BOOKING_CANCELLED_MANAGER')).toHaveLength(1)
    expect((await post(s.manager, `/manager/bookings/${b.id}/accept`, {})).status).toBe(409)
  })
})

test.describe('venue details approved again (C-13)', () => {
  test('proposed, turned down with a reason, proposed again, approved', async () => {
    const s = await setup()
    const admin = await context('admin@pitchup.ro', ADMIN_PASSWORD)
    const before = await db.company.findUniqueOrThrow({ where: { id: s.companyId } })
    const sent = await put<VenueChangesStatus>(s.manager, '/manager/venue/info', {
      name: 'Rules Arena Renamed',
      description: 'Now with floodlights.',
    })
    expect(sent.data!.pending).toEqual(['info'])
    // Nothing public changes yet.
    expect((await db.company.findUniqueOrThrow({ where: { id: s.companyId } })).name).toBe(
      before.name
    )
    expect((await get(s.manager, '/admin/venue-changes')).status).toBe(403)
    const list = (await get<PendingVenueChange[]>(admin, '/admin/venue-changes')).data!
    const mine = list.find(c => c.companyId === s.companyId)!
    expect(mine.lines).toEqual(
      expect.arrayContaining([
        { field: 'Name', before: before.name, after: 'Rules Arena Renamed' },
        { field: 'Description', before: '—', after: 'Now with floodlights.' },
      ])
    )

    await post(admin, `/admin/venue-changes/${s.companyId}/reject`, {
      reason: 'Keep the registered company name.',
    })
    const after = (await get<VenueChangesStatus>(s.manager, '/manager/venue')).data!
    expect(after).toMatchObject({
      pending: [],
      rejectionReason: 'Keep the registered company name.',
    })
    expect((await notices(s.userId, 'COMPANY_REJECTED'))[0]!.title).toBe(
      'Your changes were not approved'
    )

    await put(s.manager, '/manager/venue/contact-hours', {
      phone: '+40712000555',
      email: 'new@rules.test',
      workingHours: [0, 1, 2, 3, 4, 5, 6].map(day => ({
        day,
        openTime: '09:00',
        closeTime: '22:00',
        isClosed: false,
      })),
    })
    expect((await post(admin, `/admin/venue-changes/${s.companyId}/approve`, {})).status).toBe(200)
    expect(await db.company.findUniqueOrThrow({ where: { id: s.companyId } })).toMatchObject({
      phone: '+40712000555',
      email: 'new@rules.test',
      pendingChanges: null,
      changesRejectionReason: null,
    })
    expect((await post(admin, `/admin/venue-changes/${s.companyId}/approve`, {})).status).toBe(409)
  })

  test('the manager can withdraw what waits', async () => {
    const s = await setup()
    await put(s.manager, '/manager/venue/info', { name: 'Withdrawn Name' })
    const res = await s.manager.delete('/api/v1/manager/venue')
    expect(res.status()).toBe(200)
    expect((await get<VenueChangesStatus>(s.manager, '/manager/venue')).data!.pending).toEqual([])
  })
})
