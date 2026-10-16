/**
 * Reviews API, E07: sorted public lists (E07-01), a player's own reviews
 * (E07-02), the venue's reply (E07-03), reports (E07-04) and the manager's
 * list (E07-05).
 *
 * Every test writes its own reviews on Arena Gheorgheni (whose manager is
 * venue-gheorgheni@demo.ro) through the real endpoints, from finished
 * bookings seeded for fresh players. Seeded demo reviews share the pitch, so
 * assertions look only at the test's own reviews.
 */
import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
} from '@playwright/test'
import type { ManagerReviewPage, MyReview, ReviewItem, ReviewPage } from '@pitchup/shared'
import { del, get, post, put } from '../support/api'
import { createPlayer, db, seedBooking, uniqueEmail, venue } from '../support/db'
import { E2E_BASE_URL } from '../support/env'
import { resetRateLimits, signInApi } from '../support/helpers'

const HOUR = 3_600_000
const started = new Date()
const contexts: APIRequestContext[] = []

let companyId: string
let pitchId: string // Teren 2
let otherPitchId: string // Teren 1
let manager: APIRequestContext
let otherManager: APIRequestContext

async function signedIn(email: string, password: string) {
  const ctx = await playwrightRequest.newContext({ baseURL: E2E_BASE_URL })
  contexts.push(ctx)
  await signInApi(ctx, email, password)
  return ctx
}

async function newPlayer(name = 'Review Tester') {
  const email = uniqueEmail('rev')
  await createPlayer(email)
  const user = await db.user.update({ where: { email }, data: { name } })
  return { ctx: await signedIn(email, 'Testing123'), id: user.id }
}

/** A finished booking for this player, reviewed through the API. */
async function review(
  player: { ctx: APIRequestContext; id: string },
  body: { rating: number; text?: string; isAnonymous?: boolean },
  pitch = pitchId
) {
  const b = await seedBooking({
    pitchId: pitch,
    playerId: player.id,
    startsIn: -5,
    status: 'COMPLETED',
  })
  const r = await post<{ id: string }>(player.ctx, '/reviews', { bookingId: b.id, ...body })
  expect(r.status).toBe(201)
  return r.data!.id
}

const pitchReviews = async (sort: string) =>
  (await get<ReviewPage>(manager, `/pitches/${pitchId}/reviews?sort=${sort}&limit=50`)).data!

const only = (items: { id: string }[], ids: string[]) =>
  items.map(r => r.id).filter(id => ids.includes(id))

test.beforeAll(async () => {
  const g = await venue('gheorgheni')
  companyId = g.id
  otherPitchId = g.pitches[0]!.id
  pitchId = g.pitches[1]!.id
})

test.beforeEach(async ({ request }) => {
  await resetRateLimits(request)
  manager ??= await signedIn('venue-gheorgheni@demo.ro', 'Player1234!')
  otherManager ??= await signedIn('venue-manastur@demo.ro', 'Player1234!')
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

test.describe('the public list (E07-01)', () => {
  test('sorts newest, highest and lowest; counts every star', async () => {
    const p = await newPlayer()
    const two = await review(p, { rating: 2 })
    const five = await review(p, { rating: 5 })
    const four = await review(p, { rating: 4 })
    const ids = [two, five, four]

    expect(only((await pitchReviews('newest')).reviews, ids)).toEqual([four, five, two])
    expect(only((await pitchReviews('highest')).reviews, ids)).toEqual([five, four, two])
    expect(only((await pitchReviews('lowest')).reviews, ids)).toEqual([two, four, five])

    const page = await pitchReviews('newest')
    expect(Object.keys(page.distribution).sort()).toEqual(['1', '2', '3', '4', '5'])
    expect((await get(manager, `/pitches/${pitchId}/reviews?sort=best`)).status).toBe(400)
    expect((await get(manager, '/pitches/nope/reviews')).status).toBe(404)
  })

  test('unanswered reviews come first; replies and anonymity show', async () => {
    const p = await newPlayer('Ioana Pop')
    const answered = await review(p, { rating: 4, text: 'Lovely evening game.' })
    const open = await review(p, { rating: 3, isAnonymous: true })
    await post(manager, `/reviews/${answered}/reply`, { reply: 'Thanks, see you soon!' })

    const page = await pitchReviews('unanswered')
    const mine = only(page.reviews, [answered, open])
    expect(mine).toEqual([open, answered])

    const byId = new Map(page.reviews.map((r: ReviewItem) => [r.id, r]))
    expect(byId.get(answered)).toMatchObject({
      playerName: 'Ioana P.',
      managerReply: 'Thanks, see you soon!',
      managerRepliedAt: expect.any(String),
    })
    expect(byId.get(open)).toMatchObject({
      playerName: 'Anonymous player',
      playerAvatarUrl: null,
      managerReply: null,
    })
  })
})

test.describe("a player's own reviews (E07-02)", () => {
  test('newest first, editable for 24 hours by the server clock, deleted ones gone', async () => {
    const p = await newPlayer()
    expect((await get(p.ctx, '/reviews/mine')).data).toEqual([])

    const older = await review(p, { rating: 3, text: 'Decent pitch, ok lights.' })
    const newer = await review(p, { rating: 5 })
    await db.review.update({
      where: { id: older },
      data: { createdAt: new Date(Date.now() - 25 * HOUR) },
    })
    await post(manager, `/reviews/${older}/reply`, { reply: 'Lights are fixed now.' })

    const list = (await get<MyReview[]>(p.ctx, '/reviews/mine')).data!
    expect(list.map(r => r.id)).toEqual([newer, older])
    expect(list[0]).toMatchObject({ isEditable: true, reply: null })
    expect(list[1]).toMatchObject({
      isEditable: false,
      pitch: { id: pitchId, name: 'Teren 2' },
      company: { id: companyId, name: 'Arena Gheorgheni' },
      reply: { text: 'Lights are fixed now.' },
      bookingDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    })

    // Past the window: no edits, but the author can still delete it (E07-06).
    const locked = await put(p.ctx, `/reviews/${older}`, { rating: 4 })
    expect(locked.error?.details).toEqual({ reason: 'EDIT_WINDOW_CLOSED' })
    expect((await del(p.ctx, `/reviews/${older}`)).status).toBe(204)
    expect((await get<MyReview[]>(p.ctx, '/reviews/mine')).data!.map(r => r.id)).toEqual([newer])

    const other = await newPlayer()
    expect((await get<MyReview[]>(other.ctx, '/reviews/mine')).data).toEqual([])
  })

  test('needs an account', async ({ request }) => {
    expect((await get(request, '/reviews/mine')).status).toBe(401)
  })
})

test.describe("the venue's reply (E07-03)", () => {
  test('once, edited within 24 hours, removable; the player is told', async () => {
    const p = await newPlayer()
    const id = await review(p, { rating: 2, text: 'The nets were torn.' })

    expect((await post(manager, `/reviews/${id}/reply`, { reply: '' })).status).toBe(400)
    expect((await post(manager, `/reviews/${id}/reply`, { reply: 'x'.repeat(301) })).status).toBe(
      400
    )
    expect(
      (await post(manager, `/reviews/${id}/reply`, { reply: 'New nets on Monday.' })).status
    ).toBe(201)
    const twice = await post(manager, `/reviews/${id}/reply`, { reply: 'Again' })
    expect(twice.status).toBe(409)
    expect(twice.error?.details).toEqual({ reason: 'ALREADY_REPLIED' })

    const told = await db.notification.findFirst({
      where: { userId: p.id, type: 'MANAGER_REPLIED' },
    })
    expect(told?.data).toEqual({ reviewId: id })

    expect((await put(manager, `/reviews/${id}/reply`, { reply: 'New nets are up.' })).status).toBe(
      200
    )
    expect((await db.review.findUniqueOrThrow({ where: { id } })).managerReply).toBe(
      'New nets are up.'
    )

    await db.review.update({
      where: { id },
      data: { managerRepliedAt: new Date(Date.now() - 25 * HOUR) },
    })
    const late = await put(manager, `/reviews/${id}/reply`, { reply: 'Too late' })
    expect(late.error?.details).toEqual({ reason: 'EDIT_WINDOW_CLOSED' })

    expect((await del(manager, `/reviews/${id}/reply`)).status).toBe(204)
    expect(await db.review.findUniqueOrThrow({ where: { id } })).toMatchObject({
      managerReply: null,
      managerRepliedAt: null,
    })
    expect((await del(manager, `/reviews/${id}/reply`)).status).toBe(404)
  })

  test("only the venue's own manager", async () => {
    const p = await newPlayer()
    const id = await review(p, { rating: 4 })
    expect((await post(p.ctx, `/reviews/${id}/reply`, { reply: 'Me too' })).status).toBe(403)
    expect((await post(otherManager, `/reviews/${id}/reply`, { reply: 'Hi' })).status).toBe(404)
  })
})

test.describe('reports (E07-04)', () => {
  test('once per person; the review is flagged, stays up, and the admins are told', async () => {
    const author = await newPlayer()
    const id = await review(author, { rating: 1, text: 'Worst place in town.' })
    const reader = await newPlayer()

    expect((await post(reader.ctx, `/reviews/${id}/report`, { category: 'RUDE' })).status).toBe(400)
    const r = await post(reader.ctx, `/reviews/${id}/report`, {
      category: 'FAKE',
      detail: 'Never played here',
    })
    expect(r.status).toBe(200)
    expect(await db.review.findUniqueOrThrow({ where: { id } })).toMatchObject({
      isFlagged: true,
      flagReason: 'FAKE',
      moderationStatus: 'APPROVED',
    })
    expect(
      await db.notification.count({
        where: {
          type: 'REVIEW_REPORTED',
          AND: [
            { data: { path: ['reviewId'], equals: id } },
            { data: { path: ['category'], equals: 'FAKE' } },
          ],
        },
      })
    ).toBeGreaterThan(0)
    expect(only((await pitchReviews('newest')).reviews, [id])).toEqual([id])

    const again = await post(reader.ctx, `/reviews/${id}/report`, { category: 'SPAM' })
    expect(again.status).toBe(409)
    expect(again.error?.details).toEqual({ reason: 'ALREADY_REPORTED' })

    // The venue's manager can report it too.
    expect((await post(manager, `/reviews/${id}/report`, { category: 'OFFENSIVE' })).status).toBe(
      200
    )

    const own = await post(author.ctx, `/reviews/${id}/report`, { category: 'SPAM' })
    expect(own.error?.details).toEqual({ reason: 'OWN_REVIEW' })
  })

  test('a deleted review cannot be reported, and an account is needed', async ({ request }) => {
    const author = await newPlayer()
    const id = await review(author, { rating: 3 })
    await del(author.ctx, `/reviews/${id}`)
    const reader = await newPlayer()
    expect((await post(reader.ctx, `/reviews/${id}/report`, { category: 'SPAM' })).status).toBe(404)
    expect((await post(request, `/reviews/${id}/report`, { category: 'SPAM' })).status).toBe(401)
  })
})

test.describe("the manager's list (E07-05)", () => {
  const managed = (ctx: APIRequestContext, query = '') =>
    get<ManagerReviewPage>(ctx, `/companies/${companyId}/reviews?limit=50${query}`)

  test('filters by pitch, sorts, searches names but never anonymous ones', async () => {
    const p = await newPlayer('Zamfir Testescu')
    const low = await review(p, { rating: 1, text: 'Changing rooms were cold.' })
    const anon = await review(p, { rating: 5, isAnonymous: true })
    const elsewhere = await review(p, { rating: 4 }, otherPitchId)
    const ids = [low, anon, elsewhere]

    const all = (await managed(manager)).data!
    expect(all.items.length).toBeGreaterThanOrEqual(3)
    expect(only(all.items, ids)).toEqual([elsewhere, anon, low])

    const onePitch = (await managed(manager, `&pitchId=${otherPitchId}`)).data!
    expect(onePitch.items.every(r => r.pitch.id === otherPitchId)).toBe(true)
    expect(only(onePitch.items, ids)).toEqual([elsewhere])

    expect(only((await managed(manager, '&sort=lowest')).data!.items, ids)).toEqual([
      low,
      elsewhere,
      anon,
    ])

    await post(manager, `/reviews/${anon}/reply`, { reply: 'Glad you liked it!' })
    const unanswered = (await managed(manager, '&sort=unanswered')).data!.items
    expect(only(unanswered, ids)).toEqual([elsewhere, low, anon])
    expect(unanswered.find(r => r.id === anon)!.reply).toMatchObject({
      text: 'Glad you liked it!',
      isEditable: true,
    })

    const found = (await managed(manager, '&q=zamfir')).data!.items
    expect(found.map(r => r.id).sort()).toEqual([low, elsewhere].sort())
    expect(found.find(r => r.id === low)!.playerName).toBe('Zamfir T.')
    expect((await managed(manager)).data!.items.find(r => r.id === anon)!.playerName).toBe(
      'Anonymous player'
    )
  })

  test('shows how often a review was reported, and whether by this manager', async () => {
    const p = await newPlayer()
    const id = await review(p, { rating: 2 })
    const reader = await newPlayer()
    await post(reader.ctx, `/reviews/${id}/report`, { category: 'SPAM' })
    let item = (await managed(manager)).data!.items.find(r => r.id === id)!
    expect(item).toMatchObject({ reportCount: 1, reportedByMe: false })
    await post(manager, `/reviews/${id}/report`, { category: 'IRRELEVANT' })
    item = (await managed(manager)).data!.items.find(r => r.id === id)!
    expect(item).toMatchObject({ reportCount: 2, reportedByMe: true })
  })

  test("another company's manager gets 404, a player 403", async () => {
    expect((await managed(otherManager)).status).toBe(404)
    const p = await newPlayer()
    expect((await managed(p.ctx)).status).toBe(403)
  })
})
