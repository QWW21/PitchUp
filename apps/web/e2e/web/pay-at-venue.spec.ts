/**
 * Paying at the venue in a real browser — C-8: the player's choice and what
 * they see afterwards, the manager's Bookings page (Confirm attended, Report
 * no-show) and the payment setting. Mănăștur Football Park (Main, 90 RON/h),
 * 44+ days out; its settings are put back afterwards. Screenshots go to
 * docs/test-evidence/web/pay-at-venue.
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { addDays, venueClock } from '@pitchup/shared'
import { createPlayer, db, seedBooking, uniqueEmail, venue } from '../support/db'
import { PHONE, resetRateLimits, signIn, snap } from '../support/helpers'

const AREA = 'pay-at-venue'
const day = (n: number) => addDays(venueClock(new Date()).date, n)

let companyId: string
let pitchId: string
let player: { id: string; email: string }

async function audit(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined)
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(
    violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`),
    `axe violations on ${page.url()}`
  ).toEqual([])
}

/** A booking that started `hoursAgo` ago, paid at the venue with an 18 RON deposit. */
async function startedBooking(
  hoursAgo: number,
  method: 'VENUE_REFUND_DEPOSIT' | 'VENUE_DEPOSIT_TOWARDS'
) {
  const b = await seedBooking({
    pitchId,
    playerId: player.id,
    startsIn: -hoursAgo,
    status: 'CONFIRMED',
    rate: 45,
  })
  return db.booking.update({
    where: { id: b.id },
    data: {
      paymentMethod: method,
      depositAmount: 18,
      dueAtVenue: method === 'VENUE_REFUND_DEPOSIT' ? 90 : 72,
    },
  })
}

test.beforeAll(async () => {
  const m = await venue('manastur')
  companyId = m.id
  pitchId = m.pitches[0]!.id
  const email = uniqueEmail('web-venuepay')
  await createPlayer(email)
  const u = await db.user.update({ where: { email }, data: { name: 'Andrei Pop' } })
  player = { id: u.id, email }
})

test.beforeEach(async ({ page }) => {
  await resetRateLimits(page.request)
  await db.company.update({
    where: { id: companyId },
    data: { paymentMode: 'ONLINE_OR_VENUE', depositPercent: 20 },
  })
})

test.afterAll(async () => {
  await db.company.update({
    where: { id: companyId },
    data: { paymentMode: 'ONLINE', depositPercent: 20 },
  })
  await db.booking.deleteMany({ where: { playerId: player.id } })
})

test('the player chooses to pay at the venue and sees what is left to pay', async ({
  page,
}, info) => {
  await signIn(page, player.email, 'Testing123')
  await page.goto(`/book/${pitchId}/date?date=${day(44)}`)
  await page.getByRole('button', { name: /^Next: times on/ }).click()
  await page.getByRole('button', { name: '18:00, available' }).click()
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: 'Next' }).click()

  const choice = page.getByRole('group', { name: 'How do you want to pay?' })
  await expect(choice.getByRole('radio')).toHaveCount(3)
  await expect(page.getByRole('button', { name: 'Confirm & pay 90 RON' })).toBeVisible()
  await choice.getByText('Pay at the venue, the deposit counts').click()
  await expect(choice.getByText('Pay 18 RON deposit now · 72 RON at the venue')).toBeVisible()
  await choice.getByText('Pay in full at the venue, deposit back after the game').click()
  await expect(
    choice.getByText('18 RON deposit now, refunded after the game · 90 RON at the venue')
  ).toBeVisible()
  await snap(page, info, AREA, '01-choice', { fullPage: true })
  await audit(page)

  await page.getByRole('button', { name: 'Confirm & pay 18 RON deposit' }).click()
  await expect(page.getByRole('heading', { name: 'Booking confirmed!' })).toBeVisible()
  await expect(
    page.getByText('Deposit paid: 18 RON (refunded after the game) · To pay at the venue: 90 RON')
  ).toBeVisible()
  await snap(page, info, AREA, '02-confirmation')

  await page.goto('/my-bookings')
  await expect(page.getByText('To pay at the venue: 90 RON')).toBeVisible()
  const b = await db.booking.findFirstOrThrow({
    where: { playerId: player.id, paymentMethod: 'VENUE_REFUND_DEPOSIT' },
    orderBy: { createdAt: 'desc' },
  })
  await page.goto(`/my-bookings/${b.id}`)
  await expect(page.getByText('Deposit paid online, refunded after the game')).toBeVisible()
  await expect(page.getByText('To pay at the venue', { exact: true })).toBeVisible()
  await snap(page, info, AREA, '03-booking-detail', { fullPage: true })
})

test('a player below 70 trust at a venue-only venue is told why they cannot book', async ({
  page,
}) => {
  await db.company.update({ where: { id: companyId }, data: { paymentMode: 'VENUE' } })
  await db.user.update({ where: { id: player.id }, data: { trustScore: 60 } })
  try {
    await signIn(page, player.email, 'Testing123')
    await page.goto(`/book/${pitchId}/date?date=${day(45)}`)
    await page.getByRole('button', { name: /^Next: times on/ }).click()
    await page.getByRole('button', { name: '18:00, available' }).click()
    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByRole('button', { name: 'Next' }).click()
    await expect(page.getByText(/trust score of 70 or more/)).toBeVisible()
    await expect(page.getByRole('button', { name: /Confirm/ })).toHaveCount(0)
  } finally {
    await db.user.update({ where: { id: player.id }, data: { trustScore: 100 } })
  }
})

test('the manager confirms attendance and reports a no-show', async ({ page }, info) => {
  const came = await startedBooking(1, 'VENUE_REFUND_DEPOSIT')
  const absent = await startedBooking(2, 'VENUE_DEPOSIT_TOWARDS')
  await signIn(page, 'venue-manastur@demo.ro', 'Player1234!')
  await page.goto('/manager/overview')
  await page
    .getByRole('navigation', { name: 'Manager' })
    .getByRole('link', { name: 'Bookings' })
    .click()
  await expect(page).toHaveURL(/\/manager\/bookings$/)

  const row = (id: string) =>
    page.getByRole('article').filter({ hasText: `#${id.slice(-6).toUpperCase()}` })
  await expect(row(came.id).getByText('Due at the venue: 90 RON')).toBeVisible()
  await snap(page, info, AREA, '04-manager-bookings', { fullPage: true })
  await audit(page)

  await row(came.id).getByRole('button', { name: 'Confirm attended' }).click()
  await expect(row(came.id).getByText('Attended', { exact: true })).toBeVisible()
  await expect(row(came.id).getByText('90 RON paid at the venue')).toBeVisible()
  expect(
    Number((await db.booking.findUniqueOrThrow({ where: { id: came.id } })).refundAmount)
  ).toBe(18)

  await row(absent.id).getByRole('button', { name: 'Report no-show' }).click()
  const dialog = page.getByRole('dialog', { name: /Report Andrei Pop as a no-show/ })
  await expect(dialog.getByText(/You keep the 18 RON deposit/)).toBeVisible()
  await snap(page, info, AREA, '05-no-show-dialog')
  await audit(page)
  await dialog.getByRole('button', { name: 'Report no-show' }).click()
  await expect(row(absent.id).getByText('No-show', { exact: true })).toBeVisible()
  expect((await db.booking.findUniqueOrThrow({ where: { id: absent.id } })).status).toBe('NO_SHOW')
  await db.user.update({ where: { id: player.id }, data: { trustScore: 100 } })
})

test('the manager sets how the venue is paid', async ({ page }, info) => {
  await signIn(page, 'venue-manastur@demo.ro', 'Player1234!')
  await page.goto('/manager/settings')
  await expect(page.getByRole('radio', { name: /Online or at the venue/ })).toBeChecked()
  await page.getByRole('radio', { name: /At the venue only/ }).check()
  await page.getByLabel('Deposit paid online').selectOption('0')
  await expect(page.getByText(/you take the risk that players don’t come/)).toBeVisible()
  await snap(page, info, AREA, '06-settings', { fullPage: true })
  await audit(page)
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('status')).toHaveText('Saved.')
  expect(await db.company.findUniqueOrThrow({ where: { id: companyId } })).toMatchObject({
    paymentMode: 'VENUE',
    depositPercent: 0,
  })
})

test.describe('at phone width', () => {
  test.use({ viewport: PHONE })

  test('the Bookings page fits a phone', async ({ page }, info) => {
    await startedBooking(1, 'VENUE_DEPOSIT_TOWARDS')
    await signIn(page, 'venue-manastur@demo.ro', 'Player1234!')
    await page.goto('/manager/bookings')
    await expect(page.getByRole('button', { name: 'Confirm attended' }).first()).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      PHONE.width
    )
    await snap(page, info, AREA, '07-phone-bookings', { fullPage: true })
  })
})
