/**
 * The venue's rules in a real browser — C-10 … C-13: the Settings tabs
 * (confirming bookings by hand, the refund policy, venue details sent for
 * approval), accepting and declining a booking, what the player sees, and
 * the admin's comparison. Each test makes its own venue. Screenshots go to
 * docs/test-evidence/web/venue-rules.
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { createPlayer, createVenue, db, seedBooking, uniqueEmail } from '../support/db'
import { PHONE, resetRateLimits, signIn, snap } from '../support/helpers'

const AREA = 'venue-rules'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin1234!'

async function audit(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined)
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    // The map's Google canvas is left out, as everywhere.
    .exclude('.gm-style')
    .analyze()
  expect(
    violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`),
    `axe violations on ${page.url()}`
  ).toEqual([])
}

async function setup() {
  const managerEmail = uniqueEmail('web-rules-mgr')
  const v = await createVenue(managerEmail, `Rules Park ${Date.now().toString(36)}`)
  const pitch = await db.pitch.create({
    data: {
      companyId: v.companyId,
      name: 'Teren Verde',
      surfaceType: 'FUTSAL',
      size: 'FIVE_A_SIDE',
      hourlyRate: 100,
      isActive: true,
    },
  })
  const email = uniqueEmail('web-rules-p')
  await createPlayer(email)
  const player = await db.user.update({ where: { email }, data: { name: 'Ioana Pop' } })
  return { ...v, managerEmail, pitchId: pitch.id, player }
}

test.beforeEach(async ({ page }) => {
  await resetRateLimits(page.request)
})

test.afterAll(async () => {
  await db.booking.deleteMany({ where: { player: { email: { startsWith: 'web-rules-p-' } } } })
  await db.company.deleteMany({ where: { owner: { email: { startsWith: 'web-rules-mgr-' } } } })
})

test('the manager confirms each booking by hand and sets a refund policy', async ({
  page,
}, info) => {
  const s = await setup()
  await signIn(page, s.managerEmail, 'Testing123')
  await page.goto('/manager/settings')
  const form = page.getByRole('form', { name: 'Bookings and refunds' })
  await expect(
    form.getByRole('radio', { name: /Confirm every booking automatically/ })
  ).toBeChecked()
  await form.getByRole('radio', { name: /I confirm each booking/ }).check()
  await form.getByLabel('Full refund up to (hours before)').fill('24')
  await form.getByLabel('Then refund').selectOption('50')
  await expect(
    form.getByText(
      'Players see: Free cancellation up to 24 hours before kick-off; 50% back up to 2 hours before; nothing after.'
    )
  ).toBeVisible()
  // A partial window longer than the full one is caught before saving.
  await form.getByLabel('Up to (hours before)', { exact: true }).fill('30')
  await expect(form.getByRole('button', { name: 'Save' })).toBeDisabled()
  await form.getByLabel('Up to (hours before)', { exact: true }).fill('2')
  await snap(page, info, AREA, '01-settings', { fullPage: true })
  await audit(page)
  await form.getByRole('button', { name: 'Save' }).click()
  await expect(form.getByRole('status')).toHaveText('Saved.')
  expect(await db.company.findUniqueOrThrow({ where: { id: s.companyId } })).toMatchObject({
    autoApproveBookings: false,
    refundFullHours: 24,
    refundPartialHours: 2,
    refundPartialPercent: 50,
  })

  // Players see it on the pitch.
  await signIn(page, s.player.email, 'Testing123')
  await page.goto(`/discover/${s.companyId}/${s.pitchId}`)
  await expect(page.getByText('This venue confirms each booking.', { exact: false })).toBeVisible()
  await expect(
    page.getByText(
      'Free cancellation up to 24 hours before kick-off; 50% back up to 2 hours before; nothing after.'
    )
  ).toBeVisible()
})

test('a booking waiting for the venue: accepted, or declined with a reason', async ({
  page,
}, info) => {
  const s = await setup()
  const waiting = () =>
    seedBooking({
      pitchId: s.pitchId,
      playerId: s.player.id,
      startsIn: 40,
      status: 'AWAITING_APPROVAL',
      approvalDeadline: new Date(Date.now() + 20 * 3_600_000),
    })
  const first = await waiting()

  // The player is told it waits.
  await signIn(page, s.player.email, 'Testing123')
  await page.goto(`/my-bookings/${first.id}`)
  await expect(page.getByText('Waiting for the venue')).toBeVisible()
  await expect(page.getByText(/confirms each booking/)).toBeVisible()
  await snap(page, info, AREA, '02-player-waiting', { fullPage: true })
  await audit(page)

  await signIn(page, s.managerEmail, 'Testing123')
  await page.goto(`/manager/bookings/${first.id}`)
  await expect(page.getByText('Needs your answer').first()).toBeVisible()
  await snap(page, info, AREA, '03-manager-request', { fullPage: true })
  await audit(page)
  await page.getByRole('button', { name: 'Accept booking' }).click()
  await expect
    .poll(async () => (await db.booking.findUniqueOrThrow({ where: { id: first.id } })).status)
    .toBe('CONFIRMED')
  await expect(page.getByRole('button', { name: 'Accept booking' })).toBeHidden()

  // Cancelling a confirmed one asks why.
  await page.getByRole('button', { name: 'Cancel booking' }).click()
  const dialog = page.getByRole('dialog', { name: /Cancel Ioana Pop's booking/ })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Cancel and refund' })).toBeDisabled()
  await audit(page)
  await dialog.getByRole('button', { name: 'Keep it' }).click()

  const second = await waiting()
  await page.goto(`/manager/bookings/${second.id}`)
  await page.getByRole('button', { name: 'Decline' }).click()
  const decline = page.getByRole('dialog', { name: /Decline Ioana Pop's booking/ })
  await decline.getByLabel('Reason for the player').fill('We have a tournament that evening')
  await snap(page, info, AREA, '04-decline', { fullPage: true })
  await decline.getByRole('button', { name: 'Decline and refund' }).click()
  await expect
    .poll(async () => (await db.booking.findUniqueOrThrow({ where: { id: second.id } })).status)
    .toBe('CANCELLED')
  expect(await db.booking.findUniqueOrThrow({ where: { id: second.id } })).toMatchObject({
    status: 'CANCELLED',
    cancelledBy: 'MANAGER',
    cancellationReason: 'We have a tournament that evening',
  })
})

test('venue details wait for an admin, who compares and approves them', async ({ page }, info) => {
  const s = await setup()
  await signIn(page, s.managerEmail, 'Testing123')
  await page.goto('/manager/settings')
  await page
    .getByRole('navigation', { name: 'Settings' })
    .getByRole('link', { name: 'Venue details' })
    .click()
  await expect(page).toHaveURL(/\/manager\/settings\/venue$/)
  const info1 = page.getByRole('region', { name: 'Name and description' })
  await info1.getByLabel(/Description/).fill('Floodlit futsal in the city centre.')
  await info1.getByRole('button', { name: 'Send for approval' }).click()
  await expect(info1.getByText('Sent to PitchUp for approval.', { exact: false })).toBeVisible()
  await expect(page.getByText(/Waiting for approval: your new name and description/)).toBeVisible()
  await snap(page, info, AREA, '05-venue-pending', { fullPage: true })
  await audit(page)
  expect(
    (await db.company.findUniqueOrThrow({ where: { id: s.companyId } })).description
  ).toBeNull()

  await signIn(page, 'admin@pitchup.ro', ADMIN_PASSWORD)
  await page.goto('/admin/companies')
  const card = page.getByRole('article', { name: new RegExp(`^Rules Park`) }).last()
  await expect(card.getByRole('row', { name: /Description/ })).toContainText(
    'Floodlit futsal in the city centre.'
  )
  await snap(page, info, AREA, '06-admin-changes', { fullPage: true })
  await audit(page)
  await card.getByRole('button', { name: 'Approve changes' }).click()
  await expect(card).toBeHidden()
  expect((await db.company.findUniqueOrThrow({ where: { id: s.companyId } })).description).toBe(
    'Floodlit futsal in the city centre.'
  )
})

test('your account links to the manager’s own details', async ({ page }) => {
  const s = await setup()
  await signIn(page, s.managerEmail, 'Testing123')
  await page.goto('/manager/settings/account')
  await expect(page.getByRole('link', { name: 'Edit your name, phone and email' })).toBeVisible()
  await audit(page)
})

test.describe('at phone width', () => {
  test.use({ viewport: PHONE })

  test('the Settings tabs fit a phone', async ({ page }, info) => {
    const s = await setup()
    await signIn(page, s.managerEmail, 'Testing123')
    await page.goto('/manager/settings')
    await expect(page.getByRole('form', { name: 'Bookings and refunds' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      PHONE.width
    )
    await snap(page, info, AREA, '07-phone-settings', { fullPage: true })
  })
})
