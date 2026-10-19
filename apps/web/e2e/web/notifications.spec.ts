/**
 * Notifications in a real browser — E13-10: the bell in the player's header
 * (count, latest five, opening one, mark all read) and the settings page,
 * with axe scans. Screenshots go to docs/test-evidence/web/notifications.
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { createPlayer, db, seedBooking, uniqueEmail, venue } from '../support/db'
import { PHONE, resetRateLimits, signIn, snap } from '../support/helpers'

const AREA = 'notifications'

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

async function asPlayerWithNotices(page: Page) {
  const email = uniqueEmail('web-notif')
  await createPlayer(email)
  const u = await db.user.findUniqueOrThrow({ where: { email } })
  const g = await venue('gheorgheni')
  const b = await seedBooking({
    pitchId: g.pitches[0]!.id,
    playerId: u.id,
    startsIn: 30,
    status: 'CONFIRMED',
  })
  await db.notification.create({
    data: {
      userId: u.id,
      type: 'MANAGER_REPLIED',
      title: 'Arena Gheorgheni replied',
      body: 'The venue replied to your review of Teren 1.',
      data: {},
      isRead: true,
    },
  })
  await db.notification.create({
    data: {
      userId: u.id,
      type: 'BOOKING_CONFIRMED',
      title: 'Booking confirmed',
      body: 'Teren 1 at Arena Gheorgheni, tomorrow at 18:00.',
      data: { bookingId: b.id },
    },
  })
  await signIn(page, email, 'Testing123')
  return { userId: u.id, bookingId: b.id }
}

test.beforeEach(async ({ page }) => {
  await resetRateLimits(page.request)
})

test.afterAll(async () => {
  await db.booking.deleteMany({ where: { player: { email: { startsWith: 'web-notif-' } } } })
})

test('the bell: unread count, the latest, opening one marks it read', async ({ page }, info) => {
  const me = await asPlayerWithNotices(page)
  await page.goto('/discover?city=Cluj-Napoca')
  const bell = page.getByRole('button', { name: 'Notifications, 1 unread' })
  await expect(bell).toBeVisible()
  await bell.click()
  await expect(page.getByText('Arena Gheorgheni replied')).toBeVisible()
  await snap(page, info, AREA, '01-bell')
  await audit(page)
  await page.getByRole('button', { name: /Booking confirmed/ }).click()
  await expect(page).toHaveURL(new RegExp(`/my-bookings/${me.bookingId}$`))
  await expect(page.getByRole('button', { name: 'Notifications', exact: true })).toBeVisible()
  expect(await db.notification.count({ where: { userId: me.userId, isRead: false } })).toBe(0)
})

test('the settings page saves each switch at once and lists every notice', async ({
  page,
}, info) => {
  const me = await asPlayerWithNotices(page)
  await page.goto('/profile')
  await page
    .getByRole('navigation', { name: 'Profile' })
    .getByRole('link', { name: 'Notifications' })
    .click()
  await expect(page.getByRole('heading', { name: 'Notifications', level: 1 })).toBeVisible()
  await page.getByRole('switch', { name: 'Email' }).click()
  await page.getByRole('switch', { name: 'Booking reminders' }).click()
  await expect(page.getByRole('switch', { name: 'Booking reminders' })).toHaveAttribute(
    'aria-checked',
    'false'
  )
  await expect
    .poll(
      async () =>
        (await db.notificationPreference.findUnique({ where: { userId: me.userId } }))
          ?.disabledTypes
    )
    .toEqual(['BOOKING_REMINDER_24H', 'BOOKING_REMINDER_2H'])
  expect(
    (await db.notificationPreference.findUniqueOrThrow({ where: { userId: me.userId } }))
      .emailEnabled
  ).toBe(false)
  await expect(
    page.getByRole('region', { name: 'All notifications' }).getByText('Booking confirmed')
  ).toBeVisible()
  await snap(page, info, AREA, '02-settings', { fullPage: true })
  await audit(page)
  // Saved, not just shown.
  await page.reload()
  await expect(page.getByRole('switch', { name: 'Email' })).toHaveAttribute('aria-checked', 'false')
})

test.describe('at phone width', () => {
  test.use({ viewport: PHONE })

  test('the bell opens inside the screen', async ({ page }, info) => {
    await asPlayerWithNotices(page)
    await page.goto('/discover?city=Cluj-Napoca')
    await page.getByRole('button', { name: /^Notifications/ }).click()
    await expect(page.getByText('All notifications and settings')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      PHONE.width
    )
    await snap(page, info, AREA, '03-phone-bell')
  })
})
