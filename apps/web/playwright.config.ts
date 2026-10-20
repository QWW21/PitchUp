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
import {
  E2E_BASE_URL,
  E2E_CRON_SECRET,
  E2E_DATABASE_URL,
  E2E_DIST_DIR,
  E2E_PORT,
} from './e2e/support/env'

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
      // Its own build folder: a build here must never overwrite the `.next`
      // that a running `pnpm dev` serves from (it did, and broke it).
      NEXT_DIST_DIR: E2E_DIST_DIR,
      // The tests use the built-in fakes (test payments, emails and SMS in the
      // log, no uploads), whatever real keys a developer has in .env. Next
      // keeps variables that are already set, so blanks here win over .env.
      STRIPE_SECRET_KEY: '',
      STRIPE_WEBHOOK_SECRET: '',
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: '',
      RESEND_API_KEY: '',
      TWILIO_ACCOUNT_SID: '',
      TWILIO_AUTH_TOKEN: '',
      TWILIO_PHONE_NUMBER: '',
      TWILIO_VERIFY_SERVICE_SID: '',
      NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: '',
      CLOUDINARY_API_KEY: '',
      CLOUDINARY_API_SECRET: '',
      // No pushes leave the test run; Google sign-in has a fake Web client so
      // its button and checks are present, but no token will ever match it.
      FIREBASE_PROJECT_ID: '',
      FIREBASE_CLIENT_EMAIL: '',
      FIREBASE_PRIVATE_KEY: '',
      GOOGLE_CLIENT_ID: 'e2e-web.apps.googleusercontent.com',
      GOOGLE_CLIENT_SECRET: 'e2e-not-a-secret',
      GOOGLE_IOS_CLIENT_ID: '',
      // The nightly auto-complete job's token (E11-10), known to the tests.
      CRON_SECRET: E2E_CRON_SECRET,
    },
  },
})
