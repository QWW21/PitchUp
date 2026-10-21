/**
 * The admin panel's API — E15-01 … E15-05: venues and their statuses, users
 * (suspension ends every session, trust adjusted with a reason, players
 * deleted), disputes, review moderation, the figures, and the settings
 * (the subscription prices, maintenance mode). Tests run one at a
 * time, so switching maintenance on briefly is safe; it is always put back.
 */
import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
} from '@playwright/test'
import type {
  AdminCompanyPage,
  AdminReviewPage,
  AdminStats,
  AdminUserDetail,
  AdminUserPage,
  CompanyListPage,
  OpenDispute,
  PlatformConfigView,
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

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin1234!'
const contexts: APIRequestContext[] = []

async function context(email: string, password = 'Testing123') {
  const ctx = await playwrightRequest.newContext({ baseURL: E2E_BASE_URL })
  contexts.push(ctx)
  await signInApi(ctx, email, password)
  return ctx
}

const admin = () => context('admin@pitchup.ro', ADMIN_PASSWORD)

async function player(prefix = 'adm-p') {
  const email = uniqueEmail(prefix)
  await createPlayer(email)
  const user = await db.user.findUniqueOrThrow({ where: { email } })
  return { email, id: user.id }
}

test.beforeEach(async ({ request }) => {
  await resetRateLimits(request)
})

test.afterAll(async () => {
  await db.platformConfig.updateMany({ data: { maintenanceMode: false, subMonthlyRon: 30 } })
  await db.booking.deleteMany({ where: { player: { email: { startsWith: 'adm-p-' } } } })
  await db.company.deleteMany({ where: { owner: { email: { startsWith: 'adm-mgr-' } } } })
  for (const c of contexts) await c.dispose()
})

test.describe('venues (E15-01, E15-02)', () => {
  test('a list for admins only, filtered and paged', async () => {
    const a = await admin()
    const p = await player()
    const v = await createVenue(uniqueEmail('adm-mgr'), `Admin Arena ${Date.now().toString(36)}`)
    expect((await get(await context(p.email), '/admin/companies')).status).toBe(403)
    expect((await get(a, '/admin/companies?status=CLOSED')).status).toBe(400)
    expect((await get(a, '/admin/companies?search=x')).status).toBe(400)
    const found = await get<AdminCompanyPage>(
      a,
      '/admin/companies?search=Admin Arena&status=ACTIVE'
    )
    expect(found.data!.items.map(c => c.id)).toContain(v.companyId)
    const first = await get<AdminCompanyPage>(a, '/admin/companies?limit=2')
    expect(first.data!.items).toHaveLength(2)
    const second = await get<AdminCompanyPage>(
      a,
      `/admin/companies?limit=2&cursor=${first.data!.nextCursor}`
    )
    expect(second.data!.items[0]!.id).not.toBe(first.data!.items[0]!.id)
  })

  test('suspend with a reason, then reinstate; nothing else', async () => {
    const a = await admin()
    const managerEmail = uniqueEmail('adm-mgr')
    const v = await createVenue(managerEmail, `Suspend Arena ${Date.now().toString(36)}`)
    const status = (body: object) => put(a, `/admin/companies/${v.companyId}/status`, body)
    expect((await status({ status: 'SUSPENDED' })).status).toBe(400)
    expect((await status({ status: 'DRAFT', reason: 'Not possible from live' })).status).toBe(409)
    expect(
      (await status({ status: 'SUSPENDED', reason: 'Complaints about the lights' })).status
    ).toBe(200)
    expect(await db.company.findUniqueOrThrow({ where: { id: v.companyId } })).toMatchObject({
      status: 'SUSPENDED',
      suspensionReason: 'Complaints about the lights',
    })
    const notice = await db.notification.findFirstOrThrow({
      where: { userId: v.userId, type: 'ADMIN_NOTICE' },
    })
    expect(notice.body).toContain('Complaints about the lights')
    // Off Discover meanwhile.
    const listed = await get<CompanyListPage>(a, '/companies?city=Cluj-Napoca&limit=50')
    expect(listed.data!.companies.map(c => c.id)).not.toContain(v.companyId)
    expect((await status({ status: 'ACTIVE' })).status).toBe(200)
    expect((await db.company.findUniqueOrThrow({ where: { id: v.companyId } })).status).toBe(
      'ACTIVE'
    )
  })
})

test.describe('users (E15-03)', () => {
  test('a list with filters, and one user in full', async () => {
    const a = await admin()
    const p = await player()
    await db.user.update({ where: { id: p.id }, data: { trustScore: 55 } })
    const page = await get<AdminUserPage>(a, `/admin/users?search=${p.email}&tier=Fair&role=PLAYER`)
    expect(page.data!.items.map(u => u.id)).toEqual([p.id])
    expect(page.data!.items[0]).toMatchObject({ tier: 'Fair', trustScore: 55 })
    expect(
      (await get<AdminUserPage>(a, `/admin/users?search=${p.email}&tier=Good`)).data!.items
    ).toEqual([])
    const detail = await get<AdminUserDetail>(a, `/admin/users/${p.id}`)
    expect(detail.data).toMatchObject({
      id: p.id,
      role: 'PLAYER',
      company: null,
      suspendedAt: null,
    })
  })

  test('a trust adjustment needs a reason, is clamped, recorded and told', async () => {
    const a = await admin()
    const p = await player()
    const url = `/admin/users/${p.id}`
    expect((await put(a, url, { trustScoreAdjust: 5 })).status).toBe(400)
    expect((await put(a, url, { trustScoreAdjust: 0, trustAdjustReason: 'Nothing' })).status).toBe(
      400
    )
    const down = await put<AdminUserDetail>(a, url, {
      trustScoreAdjust: -30,
      trustAdjustReason: 'Abusive messages to a venue',
    })
    expect(down.data!.trustScore).toBe(70)
    expect(down.data!.trustHistory[0]).toMatchObject({
      reason: 'ADMIN_ADJUSTMENT',
      delta: -30,
      note: 'Abusive messages to a venue',
    })
    const up = await put<AdminUserDetail>(a, url, {
      trustScoreAdjust: 100,
      trustAdjustReason: 'Restored after review',
    })
    expect(up.data!.trustScore).toBe(100)
    const told = await db.notification.findMany({ where: { userId: p.id, type: 'ADMIN_NOTICE' } })
    expect(told.map(n => n.title)).toContain('PitchUp adjusted your trust score by -30')
  })

  test('suspension ends every session and refuses sign-in, until reinstated', async () => {
    const a = await admin()
    const p = await player()
    const session = await context(p.email)
    expect((await get(session, '/me')).status).toBe(200)
    const login = (password: string) =>
      post<{ accessToken: string }>(session, '/auth/mobile/login', { email: p.email, password })
    const bearer = (await login('Testing123')).data!.accessToken
    expect((await put(a, `/admin/users/${p.id}`, { suspended: true })).status).toBe(400)
    expect(
      (await put(a, `/admin/users/${p.id}`, { suspended: true, suspensionReason: 'Fraud checks' }))
        .status
    ).toBe(200)
    expect((await get(session, '/me')).status).toBe(401)
    const app = await playwrightRequest.newContext({
      baseURL: E2E_BASE_URL,
      extraHTTPHeaders: { Authorization: `Bearer ${bearer}` },
    })
    contexts.push(app)
    expect((await get(app, '/me')).status).toBe(401)
    expect((await login('Testing123')).error?.details).toMatchObject({
      reason: 'ACCOUNT_SUSPENDED',
    })

    expect((await put(a, `/admin/users/${p.id}`, { suspended: false })).status).toBe(200)
    expect((await login('Testing123')).status).toBe(200)
  })

  test("an admin can't suspend themselves; only players are deleted", async () => {
    const a = await admin()
    const me = await db.user.findUniqueOrThrow({ where: { email: 'admin@pitchup.ro' } })
    expect(
      (await put(a, `/admin/users/${me.id}`, { suspended: true, suspensionReason: 'Testing it' }))
        .status
    ).toBe(403)
    const managerId = await createManager(uniqueEmail('adm-mgr'))
    expect((await del(a, `/admin/users/${managerId}`, { reason: 'Closing it' })).status).toBe(400)

    const p = await player()
    const g = await db.pitch.findFirstOrThrow({ where: { company: { status: 'ACTIVE' } } })
    const upcoming = await seedBooking({
      pitchId: g.id,
      playerId: p.id,
      startsIn: 48,
      status: 'CONFIRMED',
    })
    expect((await del(a, `/admin/users/${p.id}`, { reason: 'Asked by email' })).status).toBe(200)
    expect((await db.user.findUniqueOrThrow({ where: { id: p.id } })).deletedAt).not.toBeNull()
    expect(await db.booking.findUniqueOrThrow({ where: { id: upcoming.id } })).toMatchObject({
      status: 'CANCELLED',
    })
  })
})

test.describe('disputes and reviews (E15-04)', () => {
  test('disputes: open by default, decided ones on request', async () => {
    const a = await admin()
    expect((await get(a, '/admin/disputes?status=maybe')).status).toBe(400)
    const open = await get<OpenDispute[]>(a, '/admin/disputes')
    expect(open.data!.every(d => d.status === 'OPEN')).toBe(true)
    const decided = await get<OpenDispute[]>(a, '/admin/disputes?status=resolved')
    expect(decided.data!.every(d => d.status !== 'OPEN')).toBe(true)
  })

  test('a reported review: listed first, deleted with a reason, the author told', async () => {
    const a = await admin()
    const author = await player()
    const reporter = await player()
    const g = await db.pitch.findFirstOrThrow({ where: { company: { status: 'ACTIVE' } } })
    const b = await seedBooking({
      pitchId: g.id,
      playerId: author.id,
      startsIn: -30,
      status: 'COMPLETED',
    })
    const review = await db.review.create({
      data: {
        bookingId: b.id,
        pitchId: g.id,
        playerId: author.id,
        rating: 1,
        text: 'Buy cheap watches at spam.example',
      },
    })
    await db.reviewReport.create({
      data: { reviewId: review.id, reporterId: reporter.id, category: 'SPAM' },
    })

    const list = await get<AdminReviewPage>(a, '/admin/reviews?minReports=1&search=cheap watches')
    expect(list.data!.items[0]).toMatchObject({ id: review.id, reports: 1 })
    expect((await del(a, `/admin/reviews/${review.id}`, { reason: 'short' })).status).toBe(400)
    expect(
      (await del(a, `/admin/reviews/${review.id}`, { reason: 'Advertising is not a review.' }))
        .status
    ).toBe(200)
    expect(await db.review.findUnique({ where: { id: review.id } })).toBeNull()
    expect(await db.reviewReport.count({ where: { reviewId: review.id } })).toBe(0)
    const told = await db.notification.findFirstOrThrow({
      where: { userId: author.id, type: 'ADMIN_NOTICE' },
    })
    expect(told.body).toContain('Advertising is not a review.')
    expect(
      (await del(a, `/admin/reviews/${review.id}`, { reason: 'Advertising again.' })).status
    ).toBe(404)
  })
})

test.describe('figures and settings (E15-05)', () => {
  test('the platform figures', async () => {
    const stats = await get<AdminStats>(await admin(), '/admin/stats')
    expect(stats.status).toBe(200)
    expect(stats.data!.users).toBeGreaterThan(0)
    expect(stats.data!.companies.active).toBeGreaterThan(0)
    expect(stats.data!.gmv).toBeGreaterThanOrEqual(stats.data!.last30dGmv)
  })

  test('subscription prices: whole numbers, only what is sent changes (C-15)', async () => {
    const a = await admin()
    expect((await put(a, '/admin/config', { subMonthlyRon: -1 })).status).toBe(400)
    expect((await put(a, '/admin/config', { subMonthlyRon: 2.5 })).status).toBe(400)
    const saved = await put<PlatformConfigView>(a, '/admin/config', { subMonthlyRon: 35 })
    expect(saved.data).toMatchObject({
      subMonthlyRon: 35,
      subYearlyRon: 300,
      subIntroMonthlyRon: 10,
    })
    expect(saved.data).not.toHaveProperty('platformFeePercent')
    await put(a, '/admin/config', { subMonthlyRon: 30 })
  })

  test('maintenance mode: 503 for everyone but admins, and back', async ({ request }) => {
    const a = await admin()
    const p = await player()
    const ctx = await context(p.email)
    expect(
      (await put(a, '/admin/config', { maintenanceMessage: 'Back at 14:00 after an upgrade.' }))
        .status
    ).toBe(200)
    await put(a, '/admin/config', { maintenanceMode: true })
    try {
      const blocked = await get(ctx, '/me')
      expect(blocked.status).toBe(503)
      expect(blocked.error).toMatchObject({
        message: 'Back at 14:00 after an upgrade.',
        details: { reason: 'MAINTENANCE' },
      })
      expect((await request.get('/api/v1/health')).status()).toBe(200)
      expect((await get(a, '/me')).status).toBe(200)
      expect((await get(a, '/admin/stats')).status).toBe(200)
    } finally {
      await put(a, '/admin/config', { maintenanceMode: false })
    }
    expect((await get(ctx, '/me')).status).toBe(200)
  })
})
