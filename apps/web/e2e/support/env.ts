/**
 * Where the E2E suite runs. Its own port and its own database, so a run can
 * never touch development data.
 */
export const E2E_PORT = Number(process.env.E2E_PORT ?? 3100)
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`
/** The E2E build's own folder, never the `.next` that `pnpm dev` serves. */
export const E2E_DIST_DIR = '.next-e2e'
export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ??
  'postgresql://postgres:password@localhost:5432/pitchup_test?schema=public'

/** Refuses to run destructive setup against anything that is not a test database. */
export function assertTestDatabase(url: string): void {
  const name = new URL(url).pathname.replace(/^\//, '')
  if (!/test/i.test(name)) {
    throw new Error(`E2E refuses to reset "${name}": the database name must contain "test".`)
  }
}
