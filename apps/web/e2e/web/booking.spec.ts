/**
 * The web booking flow in a real browser — E05-10. Five steps, test-mode
 * payments (no Stripe keys in CI). Screenshots go to
 * docs/test-evidence/web/booking.
 *
 * Bookings use Arena Gheorgheni Teren 1, 22+ days out (clear of the API
 * tests and the seeded fixtures), and are deleted afterwards.
 */
import { expect, test, type Page } from '@playwright/test'
import { addDays, venueClock, venueTimeToUtc } from '@pitchup/shared'
import { createPlayer, db, uniqueEmail, venue } from '../support/db'
import { PHONE, resetRateLimits, signIn, snap } from '../support/helpers'

const AREA = 'booking'
const started = new Date()
const today = venueClock(started).date
const day = (n: number) => addDays(today, n)

let pitchId: string
let pitchPath: string

test.beforeAll(async () => {
  const g = await venue('gheorgheni')
  pitchId = g.pitches[0]!.id
  pitchPath = `/discover/${g.id}/${pitchId}`
})

test.beforeEach(async ({ page }) => {
  await resetRateLimits(page.request)
  await signIn(page, 'player@demo.ro', 'Player1234!')
})

test.afterAll(async () => {
  await db.booking.deleteMany({ where: { createdAt: { gte: started }, pitchId } })
})

/** Steps 1–2: a date from the URL, then a range of slots. */
async function chooseTime(page: Page, date: string, from: string, to: string) {
  await page.goto(`/book/${pitchId}/date?date=${date}`)
  await page.getByRole('button', { name: /^Next: times on/ }).click()
  await expect(page).toHaveURL(/\/time$/)
  await page.getByRole('button', { name: `${from}, available` }).click()
  await page.getByRole('button', { name: `${to}, available` }).click()
}

test('a whole booking, from the date to the confirmation', async ({ page }, info) => {
  await page.goto(pitchPath)
  await page.getByRole('link', { name: 'Book Now' }).click()
  await expect(page).toHaveURL(new RegExp(`/book/${pitchId}/date`))
  await expect(page.getByText('Step 1 of 5')).toBeVisible()

  // Step 1, with the date the pitch page passed along.
  await page.goto(`/book/${pitchId}/date?date=${day(22)}`)
  await expect(page.locator(`[data-date="${day(22)}"]`)).toHaveClass(/bg-primary-600/)
  await snap(page, info, AREA, '01-date')
  await page.getByRole('button', { name: /^Next: times on/ }).click()

  // Step 2: 18:00 to 19:30 is 18:00–20:00, two hours.
  await expect(page.getByText('Step 2 of 5')).toBeVisible()
  await page.getByRole('button', { name: '18:00, available' }).click()
  await page.getByRole('button', { name: '19:30, available' }).click()
  await expect(page.getByText('18:00–20:00 · 2h 00min')).toBeVisible()
  await expect(page.getByText('2h 00min × 120 RON/h = 240 RON')).toBeVisible()
  await snap(page, info, AREA, '02-time', { fullPage: true })
  await page.getByRole('button', { name: 'Next' }).click()

  // Step 3: three teams, free shirts for two of them.
  await expect(page.getByText('Step 3 of 5')).toBeVisible()
  await page.locator('label', { hasText: '3 teams' }).click()
  await page.getByRole('switch', { name: 'Free shirts' }).click()
  await expect(page.getByText('Team C plays in its own kit.')).toBeVisible()
  await page
    .getByRole('group', { name: /Team A colour/ })
    .locator('label', { hasText: 'red' })
    .click()
  await page.getByLabel(/Note to the venue/).fill('We bring our own ball.')
  await snap(page, info, AREA, '03-teams', { fullPage: true })
  await page.getByRole('button', { name: 'Next' }).click()

  // Step 4: the summary, in test mode.
  await expect(page.getByText('Step 4 of 5')).toBeVisible()
  await expect(page.getByText('18:00–20:00 (2h 00min)')).toBeVisible()
  await expect(page.getByText('3 teams · 15 players')).toBeVisible()
  await expect(page.getByText('Free shirts: 2 sets')).toBeVisible()
  await expect(page.getByText('Test mode.')).toBeVisible()
  await expect(page.getByText(/Free cancellation until/)).toBeVisible()
  await snap(page, info, AREA, '04-summary', { fullPage: true })
  await page.getByRole('button', { name: 'Confirm & pay 240 RON' }).click()

  // Step 5.
  await expect(page.getByRole('heading', { name: 'Booking confirmed!' })).toBeVisible()
  await expect(page.getByText('Step 5 of 5')).toBeVisible()
  await expect(page.getByText('Total paid: 240 RON')).toBeVisible()
  await snap(page, info, AREA, '05-confirmation')

  const booking = await db.booking.findFirstOrThrow({
    where: { pitchId, startTime: venueTimeToUtc(day(22), 18 * 60) },
  })
  expect(booking).toMatchObject({
    status: 'CONFIRMED',
    teamCount: 3,
    shirtSets: 2,
    noteToManager: 'We bring our own ball.',
  })
  expect(booking.teamsData).toEqual([
    { playerCount: 5, colour: 'RED' },
    { playerCount: 5 },
    { playerCount: 5 },
  ])
  // The draft is gone: a new booking starts from scratch.
  expect(await page.evaluate(id => sessionStorage.getItem(`booking_${id}`), pitchId)).toBeNull()
})

test('a declined card keeps the player on the summary, and a retry works', async ({
  page,
}, info) => {
  await chooseTime(page, day(23), '10:00', '10:30')
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: 'Simulate a declined card' }).click()
  await expect(page.getByRole('region', { name: 'Payment' }).getByRole('alert')).toContainText(
    'Your card was declined'
  )
  await expect(page).toHaveURL(/\/summary$/)
  await snap(page, info, AREA, '06-declined')

  await page.getByRole('button', { name: 'Confirm & pay 120 RON' }).click()
  await expect(page.getByRole('heading', { name: 'Booking confirmed!' })).toBeVisible()
})

test('a time someone else books meanwhile is refused with a clear message', async ({
  page,
}, info) => {
  await chooseTime(page, day(24), '12:00', '12:30')
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: 'Next' }).click()

  // Another player pays for 12:00–13:00 while this one is on the summary.
  const otherEmail = uniqueEmail('rival')
  await createPlayer(otherEmail)
  const other = await db.user.findUniqueOrThrow({ where: { email: otherEmail } })
  await db.booking.create({
    data: {
      pitchId,
      playerId: other.id,
      startTime: venueTimeToUtc(day(24), 12 * 60),
      endTime: venueTimeToUtc(day(24), 13 * 60),
      teamCount: 2,
      status: 'CONFIRMED',
      pitchRateSnapshot: 120,
      platformFee: 9.6,
      totalAmount: 120,
    },
  })
  await page.getByRole('button', { name: 'Confirm & pay 120 RON' }).click()
  await expect(page.getByRole('region', { name: 'Payment' }).getByRole('alert')).toContainText(
    'Someone has just booked that time'
  )
  await snap(page, info, AREA, '07-slot-taken')
})

test('a signed-out player signs in and comes back to step 1', async ({ page }) => {
  await page.context().clearCookies()
  await page.goto(`/book/${pitchId}/time`)
  await expect(page).toHaveURL(/\/login\?callbackUrl=/)
  await page.locator('input[name="email"]').fill('player@demo.ro')
  await page.locator('input[name="password"]').fill('Player1234!')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(new RegExp(`/book/${pitchId}/date`))
})

test('a later step without the earlier ones goes back to step 1', async ({ page }) => {
  await page.goto(`/book/${pitchId}/date`)
  await page.evaluate(id => sessionStorage.removeItem(`booking_${id}`), pitchId)
  await page.goto(`/book/${pitchId}/summary`)
  await expect(page).toHaveURL(new RegExp(`/book/${pitchId}/date`))
})

test('Cancel asks first, and Discard goes back to the pitch', async ({ page }, info) => {
  await page.goto(`/book/${pitchId}/date?date=${day(25)}`)
  await page.getByRole('button', { name: /^Next: times on/ }).click()
  await page.getByRole('button', { name: 'Cancel' }).click()
  const dialog = page.getByRole('dialog', { name: 'Are you sure?' })
  await expect(dialog).toBeVisible()
  await snap(page, info, AREA, '08-cancel-dialog')
  await dialog.getByRole('button', { name: 'Keep editing' }).click()
  await expect(dialog).toBeHidden()
  await expect(page).toHaveURL(/\/time$/)

  await page.getByRole('button', { name: 'Cancel' }).click()
  await dialog.getByRole('button', { name: 'Discard' }).click()
  await expect(page).toHaveURL(new RegExp(`${pitchPath}$`))
})

test('the calendar works from the keyboard and explains a full day', async ({ page }) => {
  // Tomorrow pre-selected, so the right month is showing whatever today is.
  await page.goto(`/book/${pitchId}/date?date=${day(1)}`)
  await page.locator(`[data-date="${day(1)}"]`).focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.locator(`[data-date="${day(2)}"]`)).toBeFocused()
  // The day after tomorrow is fully booked (seed).
  await page.keyboard.press('Enter')
  await expect(page.getByRole('status')).toHaveText('No available slots on this day.')
  await page.keyboard.press('ArrowLeft')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: /^Next: times on/ })).toBeEnabled()
})

test('the summary fits a phone', async ({ page }, info) => {
  await page.setViewportSize(PHONE)
  await chooseTime(page, day(26), '17:00', '17:30')
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByRole('button', { name: 'Confirm & pay 120 RON' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    PHONE.width
  )
  await snap(page, info, AREA, '09-summary-phone', { fullPage: true })
})
