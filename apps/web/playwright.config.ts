/**
 * API and browser E2E — T-01.
 *
 *   pnpm test:e2e                  everything
 *   pnpm test:e2e --project=api    API tests only
 *   E2E_SKIP_BUILD=1 pnpm test:e2e reuse the last `next build`
 *   EVIDENCE=1 pnpm test:e2e       also write screenshots to docs/test-evidence/web
 *
 * The web server is a production build (`next start`) on its own port and
 * database, recreated and seeded first by e2e/prepare-db.ts.
 */
import { defineConfig, devices } from '@playwright/test'
import { E2E_BASE_URL, E2E_DATABASE_URL, E2E_PORT } from './e2e/support/env'

const build = process.env.E2E_SKIP_BUILD ? '' : 'pnpm exec next build && '

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  // Tests share one seeded database and some change it (trust score,
  // bookings, passwords), so they run one at a time, in file order.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  timeout: 45_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: E2E_BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'en-GB',
    timezoneId: 'Europe/Bucharest',
  },

  projects: [
    { name: 'api', testDir: './e2e/api' },
    {
      name: 'web',
      testDir: './e2e/web',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
  ],

  webServer: {
    command: `pnpm exec tsx e2e/prepare-db.ts && ${build}pnpm exec next start --port ${E2E_PORT}`,
    url: `${E2E_BASE_URL}/api/v1/health`,
    timeout: 300_000,
    reuseExistingServer: false,
    stdout: 'pipe',
    env: {
      DATABASE_URL: E2E_DATABASE_URL,
      NEXTAUTH_URL: E2E_BASE_URL,
      NEXT_PUBLIC_APP_URL: E2E_BASE_URL,
      // Lets tests reset rate limits between cases (see the dev route).
      ALLOW_TEST_HOOKS: '1',
    },
  },
})
