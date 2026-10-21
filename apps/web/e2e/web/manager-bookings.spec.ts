/**
 * A venue's bookings in a real browser — E11-06 … E11-08: the list with its
 * URL filters, paging and CSV export, the booking page and its actions, and
 * the week calendar, with axe scans. Each test makes its own approved venue.
 * Screenshots go to docs/test-evidence/web/manager-bookings.
 */
import { readFileSync } from 'node:fs'
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { addDays, dayOfWeek, venueClock, venueTimeToUtc } from '@pitchup/shared'
import { createPlayer, createVenue, db, uniqueEmail } from '../support/db'
import { PHONE, resetRateLimits, signIn, snap } from '../support/helpers'

const AREA = 'manager-bookings'
const HOUR = 3_600_000
const today = venueClock(new Date()).date

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

const at = (date: string, h: number) => venueTimeToUtc(date, h * 60)

async function venueWithBookings(page: Page, count = 3) {
  const email = uniqueEmail('web-mgrbk')
  const venue = await createVenue(email, `Arena ${Date.now().toString(36)}`)
  const pitches = await Promise.all(
    ['Pitch A', 'Pitch B'].map(name =>
      db.pitch.create({
        data: {
          companyId: venue.companyId,
          name,
          surfaceType: 'FUTSAL',
          size: 'FIVE_A_SIDE',
          hourlyRate: 100,
        },
      })
    )
  )
  const playerEmail = uniqueEmail('web-mgrbk-p')
  await createPlayer(playerEmail)
  const player = await db.user.update({
    where: { email: playerEmail },
    data: { name: 'Ana Ionescu' },
  })
  let day = addDays(today, 2)
  while (dayOfWeek(day) === 0) day = addDays(day, 1)
  const make = (i: number, extra: object = {}) =>
    db.booking.create({
      data: {
        pitchId: pitches[i % 2]!.id,
        playerId: player.id,
        startTime: at(addDays(day, Math.floor(i / 6)), 9 + (i % 6) * 2),
        endTime: at(addDays(day, Math.floor(i / 6)), 11 + (i % 6) * 2),
        teamCount: 2,
        status: 'CONFIRMED',
        pitchRateSnapshot: 100,
        totalAmount: 200,
        ...extra,
      },
    })
  const bookings = []
  for (let i = 0; i < count; i++) bookings.push(await make(i))
  await signIn(page, email, 'Testing123')
  return { venue, pitches, player, day, bookings, make }
}

test.beforeEach(async ({ page }) => {
  await resetRateLimits(page.request)
})

test.afterAll(async () => {
  const mine = { owner: { email: { startsWith: 'web-mgrbk-' } } }
  await db.booking.deleteMany({ where: { pitch: { company: mine } } })
  await db.company.deleteMany({ where: mine })
})

test('the list: filters in the URL, more pages, and a CSV of everything that matches', async ({
  page,
}, info) => {
  const { pitches } = await venueWithBookings(page, 23)
  await page.goto('/manager/overview')
  await page
    .getByRole('navigation', { name: 'Manager' })
    .getByRole('link', { name: 'Bookings' })
    .click()
  await expect(page).toHaveURL(/\/manager\/bookings$/)
  const rows = page.locator('tbody tr')
  await expect(rows).toHaveCount(20)
  await snap(page, info, AREA, '01-list', { fullPage: true })
  await audit(page)
  await page.getByRole('button', { name: 'Load more' }).click()
  await expect(rows).toHaveCount(23)
  await expect(page.getByRole('button', { name: 'Load more' })).toHaveCount(0)

  // CSV: every matching booking, not just the page.
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export CSV' }).click()
  const file = readFileSync((await (await download).path())!, 'utf8')
    .trim()
    .split('\n')
  expect(file[0]).toBe(
    'Date,Start,End,Player,Pitch,Status,Price (RON),Payment,Due at venue (RON),Reference'
  )
  expect(file).toHaveLength(24)

  // Filters live in the URL and survive a reload.
  await page.getByRole('combobox', { name: /^Pitch/ }).selectOption({ label: 'Pitch B' })
  await expect(page).toHaveURL(new RegExp(`pitchId=${pitches[1]!.id}`))
  await expect(rows).toHaveCount(11)
  await page.reload()
  await expect(page.getByRole('combobox', { name: /^Pitch/ })).toHaveValue(pitches[1]!.id)
  await page.getByRole('combobox', { name: /^Status/ }).selectOption('NO_SHOW')
  await expect(page.getByText('No bookings found')).toBeVisible()
  await page.getByRole('button', { name: 'Clear filters' }).click()
  await expect(page).toHaveURL(/\/manager\/bookings$/)
  await page.getByRole('searchbox', { name: /^Player/ }).fill('ana')
  await expect(page).toHaveURL(/search=ana/)
  await expect(rows).toHaveCount(20)
})

test('a booking: the details, and marking a finished game complete', async ({ page }, info) => {
  const { make } = await venueWithBookings(page, 1)
  // Started three hours ago, two hours long: finished, not yet settled.
  const ended = await make(1, {
    startTime: new Date(Date.now() - 3 * HOUR),
    endTime: new Date(Date.now() - HOUR),
    paymentMethod: 'VENUE_DEPOSIT_TOWARDS',
    depositAmount: 40,
    dueAtVenue: 160,
  })
  await page.goto(`/manager/bookings/${ended.id}`)
  await expect(
    page.getByRole('heading', { name: `Booking #${ended.id.slice(-6).toUpperCase()}` })
  ).toBeVisible()
  // C-15: no commission, so no "you receive" line.
  await expect(page.getByText('You receive')).toHaveCount(0)
  await expect(page.getByText(/With you: \d+ bookings?/)).toBeVisible()
  await expect(page.getByText('Deposit paid: 40 RON · To pay at the venue: 160 RON')).toBeVisible()
  await snap(page, info, AREA, '02-detail', { fullPage: true })
  await audit(page)
  await page.getByRole('button', { name: 'Mark as complete' }).click()
  await expect(page.getByText('Completed', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mark as complete' })).toHaveCount(0)
  // The history is rebuilt for a booking written without a timeline, then completed.
  const history = page.getByRole('region', { name: 'History' })
  await expect(history.getByText('Booked, awaiting payment')).toBeVisible()
  await expect(history.getByText('Played')).toBeVisible()
  expect((await db.booking.findUniqueOrThrow({ where: { id: ended.id } })).status).toBe('COMPLETED')

  // Back to the list from the page.
  await page.getByRole('link', { name: 'Back to bookings' }).click()
  await expect(page).toHaveURL(/\/manager\/bookings$/)
})

test('the week calendar: blocks by pitch colour, the legend hides a pitch, weeks move', async ({
  page,
}, info) => {
  const { day } = await venueWithBookings(page, 6)
  await page.goto(`/manager/bookings/calendar?week=${day}`)
  const blocks = page.getByRole('link', { name: /^Ana Ionescu, Pitch [AB], / })
  await expect(blocks).toHaveCount(6)
  await snap(page, info, AREA, '03-calendar', { fullPage: true })
  await audit(page)
  await page.getByRole('button', { name: 'Pitch B' }).click()
  await expect(page.getByRole('button', { name: 'Pitch B' })).toHaveAttribute(
    'aria-pressed',
    'false'
  )
  await expect(blocks).toHaveCount(3)
  await blocks.first().click()
  await expect(page).toHaveURL(/\/manager\/bookings\/[a-z0-9]+$/)
  await page.goBack()

  await page.getByRole('link', { name: 'Next week' }).click()
  await expect(page).toHaveURL(/week=\d{4}-\d{2}-\d{2}/)
  await expect(page.getByText('No bookings this week.')).toBeVisible()
})

test.describe('at phone width', () => {
  test.use({ viewport: PHONE })

  test('the list and the calendar fit a phone (the grid scrolls inside itself)', async ({
    page,
  }, info) => {
    const { day } = await venueWithBookings(page, 4)
    await page.goto('/manager/bookings')
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      PHONE.width
    )
    await page.goto(`/manager/bookings/calendar?week=${day}`)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      PHONE.width
    )
    await snap(page, info, AREA, '04-phone-calendar')
  })
})
