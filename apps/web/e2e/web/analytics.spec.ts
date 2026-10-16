/**
 * The analytics dashboard in a real browser — E14-06 … E14-09: the cards,
 * the filters in the URL, the chart's legend and table, the heatmap, the
 * sortable pitch table and the CSV download, with axe scans. Screenshots go
 * to docs/test-evidence/web/analytics.
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { addDays, dayOfWeek, venueClock, venueTimeToUtc } from '@pitchup/shared'
import { createPlayer, createVenue, db, seedBooking, uniqueEmail } from '../support/db'
import { PHONE, resetRateLimits, signIn, snap } from '../support/helpers'

const AREA = 'analytics'
const HOUR = 3_600_000

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

/** A venue with two pitches and a few days of games behind it. */
async function setup() {
  const managerEmail = uniqueEmail('web-stats-mgr')
  const v = await createVenue(managerEmail, `Stats Park ${Date.now().toString(36)}`)
  const pitch = (name: string, hourlyRate: number) =>
    db.pitch.create({
      data: {
        companyId: v.companyId,
        name,
        surfaceType: 'FUTSAL',
        size: 'FIVE_A_SIDE',
        hourlyRate,
        isActive: true,
      },
    })
  const a = await pitch('Teren Mare', 150)
  const b = await pitch('Teren Mic', 100)
  const email = uniqueEmail('web-stats-p')
  await createPlayer(email)
  const player = await db.user.findUniqueOrThrow({ where: { email } })
  const today = venueClock(new Date()).date
  for (let i = 1; i <= 12; i++) {
    const day = addDays(today, -i)
    if (dayOfWeek(day) === 0) continue
    const hours = (venueTimeToUtc(day, (17 + (i % 4)) * 60).getTime() - Date.now()) / HOUR
    await seedBooking({
      pitchId: i % 3 ? a.id : b.id,
      playerId: player.id,
      startsIn: hours,
      status: i === 5 ? 'NO_SHOW' : 'COMPLETED',
      rate: i % 3 ? 150 : 100,
    })
  }
  return { managerEmail }
}

test.beforeEach(async ({ page }) => {
  await resetRateLimits(page.request)
})

test.afterAll(async () => {
  await db.booking.deleteMany({ where: { player: { email: { startsWith: 'web-stats-p-' } } } })
  await db.company.deleteMany({ where: { owner: { email: { startsWith: 'web-stats-mgr-' } } } })
})

test('the dashboard: cards, filters in the URL, chart, heatmap, table and export', async ({
  page,
}, info) => {
  const s = await setup()
  await signIn(page, s.managerEmail, 'Testing123')
  await page.goto('/manager/overview')
  await page
    .getByRole('navigation', { name: 'Manager' })
    .getByRole('link', { name: 'Analytics' })
    .click()
  await expect(page).toHaveURL(/\/manager\/analytics$/)
  await expect(page.getByRole('heading', { name: 'Analytics', level: 1 })).toBeVisible()
  const cards = page.getByRole('region', { name: 'Key figures' })
  await expect(cards.getByText('Revenue', { exact: true })).toBeVisible()
  await expect(cards.getByText('No-show rate')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Occupancy by time' })).toBeVisible()
  await snap(page, info, AREA, '01-dashboard', { fullPage: true })
  await audit(page)

  // The legend hides a line; the table shows the numbers.
  const gross = page
    .getByRole('group', { name: 'Show or hide a line' })
    .getByRole('button', { name: 'Revenue' })
  await expect(gross).toHaveAttribute('aria-pressed', 'true')
  await gross.click()
  await expect(gross).toHaveAttribute('aria-pressed', 'false')
  await page.getByText('Show as a table').click()
  await expect(page.getByRole('columnheader', { name: 'At the venue' })).toBeVisible()

  // The period goes into the URL.
  await page.getByRole('combobox', { name: 'Period' }).selectOption('7d')
  await expect(page).toHaveURL(/\?period=7d$/)
  // The page has re-rendered for 7 days before the next change.
  await expect(page.getByRole('combobox', { name: 'Period' })).toHaveValue('7d')
  await page.getByRole('combobox', { name: 'Pitch' }).selectOption({ label: 'Teren Mic' })
  await expect(page).toHaveURL(/period=7d&pitchId=/)

  // The table sorts by any column.
  await page.getByRole('combobox', { name: 'Pitch' }).selectOption({ label: 'All pitches' })
  const table = page.getByRole('region', { name: 'Pitch performance' })
  await expect(table.getByRole('rowheader').first()).toHaveText('Teren Mare')
  await table.getByRole('button', { name: 'Pitch' }).click()
  await expect(table.getByRole('rowheader').first()).toHaveText('Teren Mare')
  await table.getByRole('button', { name: 'Pitch' }).click()
  await expect(table.getByRole('rowheader').first()).toHaveText('Teren Mic')

  const download = page.waitForEvent('download')
  await table.getByRole('button', { name: 'Export CSV' }).click()
  expect((await download).suggestedFilename()).toMatch(
    /^pitchup-analytics-7d-\d{4}-\d{2}-\d{2}\.csv$/
  )
  await snap(page, info, AREA, '02-table', { fullPage: true })
})

test('a venue with nothing yet shows zeros, not errors', async ({ page }) => {
  const managerEmail = uniqueEmail('web-stats-mgr')
  await createVenue(managerEmail, `Empty Park ${Date.now().toString(36)}`)
  await signIn(page, managerEmail, 'Testing123')
  await page.goto('/manager/analytics')
  await expect(
    page.getByRole('region', { name: 'Key figures' }).getByText('0 RON', { exact: true })
  ).toBeVisible()
  await expect(page.getByText('No revenue in this period')).toBeVisible()
  await expect(page.getByText('No pitches yet.')).toBeVisible()
})

test.describe('at phone width', () => {
  test.use({ viewport: PHONE })

  test('the dashboard fits a phone', async ({ page }, info) => {
    const s = await setup()
    await signIn(page, s.managerEmail, 'Testing123')
    await page.goto('/manager/analytics')
    await expect(page.getByRole('heading', { name: 'Occupancy by time' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      PHONE.width
    )
    await snap(page, info, AREA, '03-phone', { fullPage: true })
  })
})
