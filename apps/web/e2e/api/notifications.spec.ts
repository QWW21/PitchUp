/**
 * Notifications — E13-01 … E13-07. Email and SMS go to the built-in
 * loggers in E2E (no Resend or Twilio keys), which still count as sent; push
 * is skipped without Firebase. Each test makes its own venue and players.
 */
import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
} from '@playwright/test'
import type { NotificationPage, NotificationPreferences } from '@pitchup/shared'
import { get, post, put } from '../support/api'
import { createPlayer, createVenue, db, seedBooking, uniqueEmail } from '../support/db'
import { E2E_BASE_URL, E2E_CRON_SECRET } from '../support/env'
import { resetRateLimits, signInApi } from '../support/helpers'

const HOUR = 3_600_000
const contexts: APIRequestContext[] = []

async function context(email: string) {
  const ctx = await playwrightRequest.newContext({ baseURL: E2E_BASE_URL })
  contexts.push(ctx)
  await signInApi(ctx, email, 'Testing123')
  return ctx
}

async function setup() {
  const managerEmail = uniqueEmail('notif-mgr')
  const v = await createVenue(managerEmail, `Notif Arena ${Date.now().toString(36)}`)
  const pitch = await db.pitch.create({
    data: {
      companyId: v.companyId,
      name: 'Teren N',
      surfaceType: 'FUTSAL',
      size: 'FIVE_A_SIDE',
      hourlyRate: 100,
      isActive: true,
    },
  })
  const email = uniqueEmail('notif-p')
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

const rows = (userId: string, type?: string) =>
  db.notification.findMany({
    where: { userId, ...(type ? { type: type as 'OTP' } : {}) },
    orderBy: { createdAt: 'asc' },
  })
const cron = (request: APIRequestContext) =>
  request.get('/api/v1/cron/notifications', {
    headers: { Authorization: `Bearer ${E2E_CRON_SECRET}` },
  })

test.beforeEach(async ({ request }) => {
  await resetRateLimits(request)
})

test.afterAll(async () => {
  await db.booking.deleteMany({ where: { player: { email: { startsWith: 'notif-p-' } } } })
  await db.company.deleteMany({ where: { owner: { email: { startsWith: 'notif-mgr-' } } } })
  for (const c of contexts) await c.dispose()
})

test.describe('preferences (E13-07)', () => {
  test('defaults, partial changes, only mutable kinds', async ({ request }) => {
    const s = await setup()
    expect((await get(request, '/notifications/preferences')).status).toBe(401)
    expect(
      (await get<NotificationPreferences>(s.player, '/notifications/preferences')).data
    ).toEqual({
      pushEnabled: true,
      emailEnabled: true,
      smsEnabled: false,
      disabledTypes: [],
      hasPhone: true,
    })
    const changed = await put<NotificationPreferences>(s.player, '/notifications/preferences', {
      emailEnabled: false,
      disabledTypes: ['REVIEW_LEFT'],
    })
    expect(changed.data).toMatchObject({
      emailEnabled: false,
      pushEnabled: true,
      disabledTypes: ['REVIEW_LEFT'],
    })
    expect((await put(s.player, '/notifications/preferences', {})).status).toBe(400)
    expect(
      (await put(s.player, '/notifications/preferences', { disabledTypes: ['COMPANY_APPROVED'] }))
        .status
    ).toBe(400)

    // Every account has a phone (E02), so text messages can be switched on.
    const sms = await put<NotificationPreferences>(s.player, '/notifications/preferences', {
      smsEnabled: true,
    })
    expect(sms.data?.smsEnabled).toBe(true)
  })
})

test.describe('booking notices (E13-05)', () => {
  test('a paid booking tells the player, by email too; a muted kind writes nothing', async () => {
    const s = await setup()
    const date = new Date(Date.now() + 5 * 24 * HOUR)
    const day = date.getDay() === 0 ? new Date(date.getTime() + 24 * HOUR) : date
    const iso = day.toISOString().slice(0, 10)
    const created = await post<{ bookingId: string }>(s.player, '/bookings', {
      pitchId: s.pitchId,
      date: iso,
      startTime: '18:00',
      endTime: '19:00',
      teamCount: 2,
      teamsData: [{}, {}],
    })
    expect(created.status).toBe(201)
    await post(s.player, '/payments/test/confirm', {
      bookingId: created.data!.bookingId,
      outcome: 'succeed',
    })
    await expect
      .poll(async () => (await rows(s.playerId, 'BOOKING_CONFIRMED'))[0]?.sentEmail)
      .toBe(true)
    const confirmed = (await rows(s.playerId, 'BOOKING_CONFIRMED'))[0]!
    expect(confirmed.data).toEqual({ bookingId: created.data!.bookingId })
    expect(confirmed.deliveredAt).not.toBeNull()

    // Muting cancellations: the player's notice isn't written; the venue still hears.
    await put(s.player, '/notifications/preferences', {
      disabledTypes: ['BOOKING_CANCELLED_PLAYER', 'BOOKING_CANCELLED_MANAGER', 'REFUND_PROCESSED'],
    })
    expect((await post(s.player, `/bookings/${created.data!.bookingId}/cancel`, {})).status).toBe(
      200
    )
    expect(await rows(s.playerId, 'BOOKING_CANCELLED_PLAYER')).toHaveLength(0)
    const venueNotice = await rows(s.userId, 'BOOKING_CANCELLED_PLAYER')
    expect(venueNotice).toHaveLength(1)
    expect(venueNotice[0]!.data).toMatchObject({
      link: `/manager/bookings/${created.data!.bookingId}`,
    })
  })

  test('dropping a trust tier is a notice of its own', async () => {
    const s = await setup()
    await db.user.update({ where: { id: s.playerId }, data: { trustScore: 72 } })
    const b = await seedBooking({
      pitchId: s.pitchId,
      playerId: s.playerId,
      startsIn: 10,
      status: 'CONFIRMED',
    })
    await post(s.player, `/bookings/${b.id}/cancel`, {})
    const tier = await rows(s.playerId, 'TRUST_TIER_CHANGED')
    expect(tier).toHaveLength(1)
    expect(tier[0]!.title).toBe('Your trust tier is now Fair')
  })
})

test.describe('the inbox (E13-06)', () => {
  test('an unread count, unread only, and marking read', async () => {
    const s = await setup()
    for (const title of ['One', 'Two', 'Three']) {
      await db.notification.create({
        data: { userId: s.playerId, type: 'MANAGER_REPLIED', title, body: 'x', data: {} },
      })
    }
    const first = await db.notification.findFirstOrThrow({
      where: { userId: s.playerId, title: 'One' },
    })
    await db.notification.update({ where: { id: first.id }, data: { isRead: true } })
    expect((await get<{ unread: number }>(s.player, '/notifications/count')).data).toEqual({
      unread: 2,
    })
    const unread = (await get<NotificationPage>(s.player, '/notifications?unreadOnly=true')).data!
    expect(unread.items.map(i => i.title)).toEqual(['Three', 'Two'])
    await s.player.patch('/api/v1/notifications/read-all')
    expect((await get<{ unread: number }>(s.player, '/notifications/count')).data).toEqual({
      unread: 0,
    })
  })
})

test.describe('the hourly job (E13-04)', () => {
  test('reminds once, 23–25 hours ahead, by text too when switched on; and sweeps the outbox', async ({
    request,
  }) => {
    const s = await setup()
    await put(s.player, '/notifications/preferences', { smsEnabled: true })
    const soon = await seedBooking({
      pitchId: s.pitchId,
      playerId: s.playerId,
      startsIn: 24,
      status: 'CONFIRMED',
    })
    const later = await seedBooking({
      pitchId: s.pitchId,
      playerId: s.playerId,
      startsIn: 30,
      status: 'CONFIRMED',
    })
    // A notice written without delivery (as a trust change in a background job is).
    const stray = await db.notification.create({
      data: { userId: s.playerId, type: 'MANAGER_REPLIED', title: 'Stray', body: 'x', data: {} },
    })

    expect((await request.get('/api/v1/cron/notifications')).status()).toBe(401)
    expect((await cron(request)).status()).toBe(200)
    const reminders = await rows(s.playerId, 'BOOKING_REMINDER_24H')
    expect(reminders).toHaveLength(1)
    expect(reminders[0]!.data).toEqual({ bookingId: soon.id })
    expect(reminders[0]!.title).toBe('Your game is tomorrow')
    expect(reminders[0]).toMatchObject({ sentEmail: true, sentSms: true })
    expect(
      (await db.booking.findUniqueOrThrow({ where: { id: soon.id } })).reminderSentAt
    ).not.toBeNull()
    expect(
      (await db.booking.findUniqueOrThrow({ where: { id: later.id } })).reminderSentAt
    ).toBeNull()
    expect(
      (await db.notification.findUniqueOrThrow({ where: { id: stray.id } })).deliveredAt
    ).not.toBeNull()

    await cron(request)
    expect(await rows(s.playerId, 'BOOKING_REMINDER_24H')).toHaveLength(1)
  })
})
