/**
 * Recreates and seeds the E2E database. Run by the Playwright web server
 * command before the app starts (playwright.config.ts), so every run begins
 * from the same fixtures — including the time-relative ones (tomorrow's
 * booking, the closure three days out).
 */
import { execSync } from 'node:child_process'
import { E2E_DATABASE_URL, assertTestDatabase } from './support/env'

assertTestDatabase(E2E_DATABASE_URL)

const env: NodeJS.ProcessEnv = {
  ...process.env,
  DATABASE_URL: E2E_DATABASE_URL,
  // The seed skips its dev fixtures in production; the E2E suite needs them.
  NODE_ENV: 'development',
}
const run = (cmd: string) => execSync(cmd, { stdio: 'inherit', env })

// Creates the database if it does not exist, and drops every table if it does.
run('pnpm exec prisma db push --force-reset --skip-generate --accept-data-loss')
run('pnpm exec tsx prisma/seed.ts')
