/**
 * Reviews in a real browser — E07-08 (My reviews), E07-09 (the manager's
 * reviews page) and E07-10 (sorting, replies, reports and rating data on
 * the public pages). Reviews are written straight to the test database on
 * Arena Gheorgheni, whose manager is venue-gheorgheni@demo.ro. Screenshots
 * go to docs/test-evidence/web/reviews.
 */
import { expect, test, type Page } from '@playwright/test'
import { createPlayer, db, seedBooking, uniqueEmail, venue } from '../support/db'
import { PHONE, resetRateLimits, signIn, snap } from '../support/helpers'

const AREA = 'reviews'
const HOUR = 3_600_000

let companyId: string
let pitchId: string

/** A fresh player, optionally signed in on this page. */
async function newPlayer(page: Page | null, name = 'Web Reviewer') {
  const email = uniqueEmail('web-rev')
  await createPlayer(email)
  const user = await db.user.update({ where: { email }, data: { name } })
  if (page) await signIn(page, email, 'Testing123')
  return user.id
}

/** A finished game and its review, written directly. */
async function seedReview(
  playerId: string,
  data: { rating: number; text?: string; isAnonymous?: boolean; ageHours?: number }
) {
  const b = await seedBooking({ pitchId, playerId, startsIn: -26, status: 'COMPLETED' })
  return db.review.create({
    data: {
      bookingId: b.id,
      pitchId,
      playerId,
      rating: data.rating,
      text: data.text ?? null,
      isAnonymous: data.isAnonymous ?? false,
      createdAt: new Date(Date.now() - (data.ageHours ?? 1) * HOUR),
    },
  })
}

test.beforeAll(async () => {
  const g = await venue('gheorgheni')
  companyId = g.id
  pitchId = g.pitches[1]!.id
})

test.beforeEach(async ({ page }) => {
  await resetRateLimits(page.request)
})

test.afterAll(async () => {
  await db.booking.deleteMany({ where: { player: { email: { startsWith: 'web-rev-' } } } })
})

test.describe('My reviews (E07-08)', () => {
  test('from the account menu: the list, the reply, editing and deleting', async ({
    page,
  }, info) => {
    const me = await newPlayer(page)
    const fresh = await seedReview(me, {
      rating: 3,
      text: 'Decent surface. The changing rooms could be cleaner, and the lights flickered twice during the second half, which was a little distracting for everyone playing. Parking was easy though, and the staff were friendly when we asked for a pump.',
    })
    const old = await seedReview(me, { rating: 2, text: 'Nets were torn.', ageHours: 30 })
    await db.review.update({
      where: { id: old.id },
      data: { managerReply: 'New nets are up, thanks!', managerRepliedAt: new Date() },
    })

    await page.goto('/discover?city=Cluj-Napoca')
    await page.getByRole('button', { name: /Account menu/ }).click()
    await page.getByRole('menuitem', { name: 'My Reviews' }).click()
    await expect(page).toHaveURL(/\/my-reviews$/)

    const cards = page.getByRole('article')
    await expect(cards).toHaveCount(2)
    const first = cards.first()
    await expect(first).toContainText('Teren 2')
    await expect(first).toContainText('Arena Gheorgheni')
    await first.getByRole('button', { name: 'Show more' }).click()
    await expect(first.getByRole('button', { name: 'Show less' })).toBeVisible()
    // Past 24 hours: no Edit, but Delete stays.
    const second = cards.nth(1)
    await expect(second).toContainText('Response from the venue')
    await expect(second).toContainText('New nets are up, thanks!')
    await expect(second.getByRole('link', { name: 'Edit' })).toHaveCount(0)
    await expect(second.getByRole('button', { name: 'Delete' })).toBeVisible()
    await snap(page, info, AREA, '01-my-reviews', { fullPage: true })

    await first.getByRole('link', { name: 'Edit' }).click()
    await expect(page.getByRole('heading', { name: 'Edit your review' })).toBeVisible()
    await expect(page.getByText(/^You can edit this until/)).toBeVisible()
    await page.getByLabel('4 stars, Good').check({ force: true })
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page).toHaveURL(/\/my-reviews\?updated=1$/)
    await expect(page.getByRole('status')).toContainText('Your review is updated')
    expect((await db.review.findUniqueOrThrow({ where: { id: fresh.id } })).rating).toBe(4)

    page.once('dialog', d => d.accept())
    await second.getByRole('button', { name: 'Delete' }).click()
    await expect(page).toHaveURL(/\/my-reviews\?deleted=1$/)
    await expect(page.getByRole('status')).toContainText('Review deleted')
    await expect(cards).toHaveCount(1)
    expect((await db.review.findUniqueOrThrow({ where: { id: old.id } })).deletedAt).not.toBeNull()
  })

  test('empty, and signed-out visitors sign in first', async ({ page }, info) => {
    await page.goto('/my-reviews')
    await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fmy-reviews$/)
    await newPlayer(page)
    await page.goto('/my-reviews')
    await expect(page.getByText('No reviews yet')).toBeVisible()
    await snap(page, info, AREA, '02-empty')
    await page.getByRole('link', { name: 'Find a pitch' }).click()
    await expect(page).toHaveURL(/\/discover/)
  })
})

test.describe('the public reviews (E07-10)', () => {
  test('sorting is kept in the URL; replies show under the review', async ({ page }, info) => {
    const author = await newPlayer(null, 'Sorin Lowstar')
    await seedReview(author, { rating: 1, text: 'Cold showers and no ball pump.' })
    const answered = await seedReview(author, { rating: 5, text: 'Best pitch in Cluj by far.' })
    await db.review.update({
      where: { id: answered.id },
      data: { managerReply: 'Thank you, Sorin!', managerRepliedAt: new Date() },
    })

    await page.goto(`/discover/${companyId}?tab=reviews`)
    const sort = page.getByRole('group', { name: 'Sort reviews' })
    await expect(sort.getByRole('button', { name: 'Newest' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    const best = page.getByRole('article').filter({ hasText: 'Best pitch in Cluj by far.' })
    await expect(best).toContainText('Response from the venue')
    await expect(best).toContainText('Thank you, Sorin!')

    await sort.getByRole('button', { name: 'Lowest' }).click()
    await expect(page).toHaveURL(/sort=lowest/)
    await expect(page.getByRole('article').first()).toContainText('Cold showers and no ball pump.')
    await snap(page, info, AREA, '03-sorted-lowest', { fullPage: true })

    // The order survives a reload.
    await page.reload()
    await expect(sort.getByRole('button', { name: 'Lowest' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })

  test('a signed-in player reports a review once', async ({ page }, info) => {
    const author = await newPlayer(null)
    const r = await seedReview(author, { rating: 1, text: 'Total scam, avoid this venue.' })

    await page.goto(`/discover/${companyId}?tab=reviews`)
    const card = page.getByRole('article').filter({ hasText: 'Total scam, avoid this venue.' })
    // Signed out: nothing to report with.
    await expect(card.getByRole('button', { name: 'Report' })).toHaveCount(0)

    await newPlayer(page)
    await page.reload()
    await card.getByRole('button', { name: 'Report' }).click()
    const dialog = page.getByRole('dialog', { name: 'Report this review' })
    await dialog.getByRole('button', { name: 'Send report' }).click()
    await expect(dialog.getByText('Choose a reason.')).toBeVisible()
    await dialog.getByLabel('Fake review').check()
    await dialog.getByLabel(/Anything to add/).fill('The author never played here.')
    await snap(page, info, AREA, '04-report-dialog')
    await dialog.getByRole('button', { name: 'Send report' }).click()
    await expect(card.getByRole('status')).toContainText('Reported')
    await expect(dialog).toBeHidden()

    const reports = await db.reviewReport.findMany({ where: { reviewId: r.id } })
    expect(reports).toMatchObject([{ category: 'FAKE', detail: 'The author never played here.' }])
  })

  test('the pitch page carries rating data for search engines once it is rated', async ({
    page,
  }) => {
    const author = await newPlayer(null)
    for (const rating of [4, 5, 4]) await seedReview(author, { rating })
    await page.goto(`/discover/${companyId}/${pitchId}`)
    const json = await page.locator('script[type="application/ld+json"]').textContent()
    const data = JSON.parse(json!)
    expect(data).toMatchObject({
      '@type': 'SportsActivityLocation',
      name: 'Teren 2 — Arena Gheorgheni',
      aggregateRating: { '@type': 'AggregateRating', bestRating: '5', worstRating: '1' },
    })
    expect(Number(data.aggregateRating.reviewCount)).toBeGreaterThanOrEqual(3)
  })
})

test.describe("the manager's reviews page (E07-09)", () => {
  test('filters, replies inline, edits and deletes the reply, reports', async ({ page }, info) => {
    const author = await newPlayer(null, 'Mihai Replytest')
    await seedReview(author, { rating: 2, text: 'Goals were wobbly all evening.' })

    await signIn(page, 'venue-gheorgheni@demo.ro', 'Player1234!')
    await page.goto('/dashboard')
    await expect(page.getByText(/waiting for a reply|Every review has a reply/)).toBeVisible()
    await page
      .getByRole('navigation', { name: 'Dashboard' })
      .getByRole('link', { name: 'Reviews' })
      .click()
    await expect(page).toHaveURL(/\/dashboard\/reviews$/)

    await page.getByRole('searchbox', { name: 'Search by player name' }).fill('replytest')
    await expect(page).toHaveURL(/q=replytest/)
    const card = page.getByRole('article').filter({ hasText: 'Goals were wobbly all evening.' })
    await expect(page.getByRole('article')).toHaveCount(1)
    await expect(card).toContainText('Mihai R.')
    await expect(card).toContainText('Teren 2')

    await card.getByRole('button', { name: 'Reply to this review' }).click()
    await card.getByLabel('Your reply').fill('Sorry! The goals are fixed now.')
    await expect(card.getByText('31 / 300')).toBeVisible()
    await snap(page, info, AREA, '05-manager-reply-form')
    await card.getByRole('button', { name: 'Post reply' }).click()
    await expect(card).toContainText('Your reply')
    await expect(card).toContainText('Sorry! The goals are fixed now.')

    await card.getByRole('button', { name: 'Edit reply' }).click()
    await card.getByLabel('Your reply').fill('Sorry! New goals are in.')
    await card.getByRole('button', { name: 'Save reply' }).click()
    await expect(card).toContainText('Sorry! New goals are in.')
    await snap(page, info, AREA, '06-manager-replied', { fullPage: true })

    // The player sees it on the public page.
    const pub = await page.context().newPage()
    await pub.goto(`/discover/${companyId}?tab=reviews`)
    await expect(
      pub.getByRole('article').filter({ hasText: 'Goals were wobbly all evening.' })
    ).toContainText('Sorry! New goals are in.')
    await pub.close()

    page.once('dialog', d => d.accept())
    await card.getByRole('button', { name: 'Delete reply' }).click()
    await expect(card.getByRole('button', { name: 'Reply to this review' })).toBeVisible()

    await card.getByRole('button', { name: 'Report' }).click()
    const dialog = page.getByRole('dialog', { name: 'Report this review' })
    await dialog.getByLabel('Not about this pitch').check()
    await dialog.getByRole('button', { name: 'Send report' }).click()
    await expect(card.getByRole('status')).toContainText('Reported')
  })

  test('sorting and the pitch filter come from the URL', async ({ page }) => {
    const author = await newPlayer(null)
    await seedReview(author, { rating: 1, text: 'Lowest of the low for this test.' })
    await signIn(page, 'venue-gheorgheni@demo.ro', 'Player1234!')
    await page.goto('/dashboard/reviews')
    await page
      .getByRole('group', { name: 'Sort' })
      .getByRole('button', { name: 'Lowest rated' })
      .click()
    await expect(page).toHaveURL(/sort=lowest/)
    await expect(
      page
        .getByRole('article')
        .first()
        .getByRole('img', { name: /^1\.0 out of 5/ })
    ).toBeVisible()

    await page.getByRole('combobox').selectOption({ label: 'Teren 2' })
    await expect(page).toHaveURL(new RegExp(`pitch=${pitchId}`))
    const chips = page
      .getByRole('article')
      .locator('header span')
      .filter({ hasText: /^Teren/ })
    await expect(chips.first()).toHaveText('Teren 2')
  })

  test('players are sent to Discover; phones fit', async ({ page }, info) => {
    await newPlayer(page)
    await page.goto('/dashboard/reviews')
    await expect(page).toHaveURL(/\/discover/)

    await signIn(page, 'venue-gheorgheni@demo.ro', 'Player1234!')
    await page.setViewportSize(PHONE)
    await page.goto('/dashboard/reviews')
    await expect(page.getByRole('heading', { name: 'Reviews' })).toBeVisible()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    )
    expect(overflow).toBe(false)
    await snap(page, info, AREA, '07-manager-phone')
  })
})
