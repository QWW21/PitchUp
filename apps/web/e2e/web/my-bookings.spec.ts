/**
 * My Bookings in a real browser — E06-10: the tabs, the detail, cancelling,
 * reviewing and disputing a no-show. Each test signs in a fresh player whose
 * bookings are written to the test database. Screenshots go to
 * docs/test-evidence/web/my-bookings.
 */
import { expect, test, type Page } from '@playwright/test'
import { createPlayer, db, seedBooking, uniqueEmail, venue } from '../support/db'
import { PHONE, resetRateLimits, signIn, snap } from '../support/helpers'

const AREA = 'my-bookings'
const HOUR = 3_600_000

let pitchId: string
let playerId: string

async function asNewPlayer(page: Page) {
  const email = uniqueEmail('web-mine')
  await createPlayer(email)
  playerId = (await db.user.findUniqueOrThrow({ where: { email } })).id
  await signIn(page, email, 'Testing123')
}

const seed = (startsIn: number, status: Parameters<typeof seedBooking>[0]['status'], extra = {}) =>
  seedBooking({ pitchId, playerId, startsIn, status, ...extra })

test.beforeAll(async () => {
  pitchId = (await venue('gheorgheni')).pitches[1]!.id
})

test.beforeEach(async ({ page }) => {
  await resetRateLimits(page.request)
  await asNewPlayer(page)
})

test.afterAll(async () => {
  await db.booking.deleteMany({ where: { player: { email: { startsWith: 'web-mine-' } } } })
})

test('the three tabs, from the account menu', async ({ page }, info) => {
  await seed(5, 'CONFIRMED')
  await seed(72, 'CONFIRMED')
  await seed(-26, 'CONFIRMED') // finished: becomes Completed
  await seed(-80, 'NO_SHOW')
  await seed(48, 'CANCELLED')

  await page.goto('/discover?city=Cluj-Napoca')
  await page.getByRole('button', { name: /Account menu/ }).click()
  await page.getByRole('menuitem', { name: 'My Bookings' }).click()
  await expect(page).toHaveURL(/\/my-bookings$/)

  const cards = page.getByRole('tabpanel').getByRole('article')
  await expect(cards).toHaveCount(2)
  await expect(cards.first()).toContainText('Teren 2')
  await expect(cards.first()).toContainText('Confirmed')
  await expect(cards.first().getByText(/^Starts in \d+h/)).toBeVisible()
  await expect(cards.nth(1).getByText(/^Starts in/)).toHaveCount(0)
  await snap(page, info, AREA, '01-upcoming')

  await page.getByRole('tab', { name: 'Past' }).click()
  await expect(page).toHaveURL(/tab=past/)
  await expect(cards).toHaveCount(2)
  await expect(cards.first()).toContainText('Completed')
  await expect(cards.first().getByRole('link', { name: 'Leave a review' })).toBeVisible()
  await expect(cards.nth(1)).toContainText('No-show')
  await snap(page, info, AREA, '02-past')

  await page.getByRole('tab', { name: 'Cancelled' }).click()
  await expect(cards).toHaveCount(1)
  await expect(cards.first()).toContainText('Cancelled by you · Refund: 360 RON')
  await snap(page, info, AREA, '03-cancelled')

  // Back returns to the previous tab.
  await page.goBack()
  await expect(page.getByRole('tab', { name: 'Past' })).toHaveAttribute('aria-selected', 'true')
})

test('an empty list offers a way to find a pitch', async ({ page }, info) => {
  await page.goto('/my-bookings')
  await expect(page.getByText('No upcoming bookings')).toBeVisible()
  await page.getByRole('link', { name: 'Find a pitch' }).click()
  await expect(page).toHaveURL(/\/discover/)
  await page.goto('/my-bookings')
  await snap(page, info, AREA, '04-empty')
})

test('the detail, and cancelling with a 75% refund (C-10)', async ({ page }, info) => {
  const b = await seed(5, 'CONFIRMED')
  await page.goto('/my-bookings')
  await page.getByRole('link', { name: 'Teren 2' }).click()
  await expect(page).toHaveURL(new RegExp(`/my-bookings/${b.id}$`))
  await expect(page).toHaveTitle(/^Booking #[A-Z0-9]{6} \| PitchUp$/)

  await expect(page.getByRole('heading', { name: 'Booking details' })).toBeVisible()
  await expect(page.getByText('Confirmed').first()).toBeVisible()
  await expect(page.getByText('Arena Gheorgheni')).toBeVisible()
  await expect(page.getByText('2 teams · 13 players')).toBeVisible()
  await expect(page.getByText('Team A: red shirts')).toHaveCount(0) // no shirts on this booking
  await expect(page.getByText('Total paid')).toBeVisible()
  await expect(page.getByText('Test payment')).toBeVisible()
  await snap(page, info, AREA, '05-detail', { fullPage: true })

  await page.getByRole('button', { name: 'Cancel booking' }).click()
  const dialog = page.getByRole('dialog', { name: 'Cancel this booking?' })
  await expect(dialog).toContainText('270 RON back · 75% refund')
  await snap(page, info, AREA, '06-cancel-dialog')
  await dialog.getByRole('button', { name: 'Keep my booking' }).click()
  await expect(dialog).toBeHidden()

  await page.getByRole('button', { name: 'Cancel booking' }).click()
  await dialog.getByRole('button', { name: 'Cancel — get 270 RON back' }).click()
  await expect(page.getByRole('status')).toContainText('270 RON will be refunded')
  await expect(page.getByText('Cancelled').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cancel booking' })).toHaveCount(0)
  await snap(page, info, AREA, '07-cancelled-detail', { fullPage: true })

  const row = await db.booking.findUniqueOrThrow({ where: { id: b.id } })
  expect(Number(row.refundAmount)).toBe(270)
})

test('reviewing a finished game, then editing and deleting the review', async ({ page }, info) => {
  const b = await seed(-26, 'CONFIRMED')
  await page.goto('/my-bookings?tab=past')
  await page.getByRole('link', { name: 'Leave a review' }).click()
  await expect(page).toHaveURL(new RegExp(`/my-bookings/${b.id}/review$`))

  await page.getByRole('button', { name: 'Submit review' }).click()
  await expect(page.getByText('Choose a rating from 1 to 5 stars.')).toBeVisible()
  await page.getByLabel('4 stars, Good').check({ force: true })
  await expect(page.getByText('Good', { exact: true })).toBeVisible()
  await page.getByLabel(/Your review/).fill('Too short')
  await expect(page.getByText('Write at least 10 characters, or leave it empty')).toBeVisible()
  await page.getByLabel(/Your review/).fill('Good surface, friendly staff, lights on time.')
  await page.getByRole('switch', { name: /Post anonymously/ }).check()
  await snap(page, info, AREA, '08-review-form')
  await page.getByRole('button', { name: 'Submit review' }).click()

  await expect(page).toHaveURL(new RegExp(`/my-bookings/${b.id}\\?reviewed=1`))
  await expect(page.getByRole('status')).toContainText('Your review is published')
  const review = page.getByRole('region', { name: 'Your review' })
  await expect(review).toContainText('Good surface, friendly staff')
  await expect(review).toContainText('Posted anonymously')
  await snap(page, info, AREA, '09-reviewed', { fullPage: true })

  await review.getByRole('link', { name: 'Edit review' }).click()
  await expect(page.getByRole('heading', { name: 'Edit your review' })).toBeVisible()
  await page.getByLabel('5 stars, Excellent!').check({ force: true })
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(
    page.getByRole('region', { name: 'Your review' }).getByRole('img', { name: '5.0 out of 5' })
  ).toBeVisible()

  page.once('dialog', d => d.accept())
  await page.getByRole('button', { name: 'Delete review' }).click()
  await expect(page.getByRole('region', { name: 'Your review' })).toHaveCount(0)
  // Reviewed once is enough: no new review is offered.
  await expect(page.getByRole('link', { name: 'Rate this pitch' })).toHaveCount(0)
})

test('disputing a no-show', async ({ page }, info) => {
  const b = await seed(-6, 'NO_SHOW')
  const manager = await db.user.findUniqueOrThrow({ where: { email: 'manager@demo.ro' } })
  await db.noShow.create({
    data: {
      bookingId: b.id,
      reportedByManagerId: manager.id,
      reason: 'Nobody came',
      penaltyAmount: 82,
      createdAt: new Date(Date.now() - 2 * HOUR),
    },
  })
  await page.goto(`/my-bookings/${b.id}`)
  await expect(page.getByText('No-show').first()).toBeVisible()
  await expect(page.getByText(/marked this booking as a no-show: “Nobody came”/)).toBeVisible()
  await page.getByLabel('What happened').fill('We played the full two hours; ask the referee.')
  await snap(page, info, AREA, '10-dispute')
  await page.getByRole('button', { name: 'Dispute no-show' }).click()
  await expect(page.getByText('Dispute submitted. An admin will review it.')).toBeVisible()
})

test('the booking confirmation links to the booking', async ({ page }) => {
  const b = await seed(30, 'CONFIRMED')
  const g = await venue('gheorgheni')
  await page.goto(`/book/${g.pitches[1]!.id}/confirmation?booking=${b.id}`)
  await page.getByRole('link', { name: 'View my booking' }).click()
  await expect(page).toHaveURL(new RegExp(`/my-bookings/${b.id}$`))
})

test("someone else's booking is a 404, and signed-out visitors sign in first", async ({ page }) => {
  const b = await seed(30, 'CONFIRMED')
  await asNewPlayer(page)
  const res = await page.goto(`/my-bookings/${b.id}`)
  expect(res?.status()).toBe(404)

  await page.context().clearCookies()
  await page.goto('/my-bookings')
  await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fmy-bookings/)
})

test('fits a phone', async ({ page }, info) => {
  await page.setViewportSize(PHONE)
  await seed(5, 'CONFIRMED')
  await page.goto('/my-bookings')
  await expect(page.getByRole('tabpanel').getByRole('article')).toHaveCount(1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    PHONE.width
  )
  await snap(page, info, AREA, '11-phone')
})
