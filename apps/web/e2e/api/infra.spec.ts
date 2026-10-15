/**
 * E01 infrastructure — the database, seed, admin account, API envelope, rate
 * limiter and client bundle checks ported from scripts/verify-e01.sh, run
 * against the E2E database and production build. Environment validation,
 * the Prisma singleton and Cloudinary signing are unit tests
 * (src/lib/infra.test.ts).
 */
import { execSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import bcrypt from 'bcryptjs'
import { get } from '../support/api'
import { db } from '../support/db'
import { E2E_DATABASE_URL } from '../support/env'
import { resetRateLimits } from '../support/helpers'

const WEB_ROOT = join(__dirname, '..', '..')
// The seed reads the same variable from the same environment.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin1234!'

test.beforeEach(async ({ request }) => {
  await resetRateLimits(request)
})

test.describe('database (E01-02, E01-03)', () => {
  test('matches schema.prisma: no drift, one table per model, every enum', async () => {
    const schema = readFileSync(join(WEB_ROOT, 'prisma', 'schema.prisma'), 'utf8')
    const models = schema.match(/^model \w+/gm)?.length
    const enums = schema.match(/^enum \w+/gm)?.length

    // Exit code 2 means the database and the schema differ.
    execSync(
      'pnpm exec prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code',
      { cwd: WEB_ROOT, env: { ...process.env, DATABASE_URL: E2E_DATABASE_URL }, stdio: 'pipe' }
    )

    const [tables] = await db.$queryRaw<[{ count: bigint }]>`
      SELECT count(*) FROM pg_tables WHERE schemaname = 'public'`
    const [types] = await db.$queryRaw<[{ count: bigint }]>`
      SELECT count(*) FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE t.typtype = 'e' AND n.nspname = 'public'`
    expect(Number(tables.count)).toBe(models)
    expect(Number(types.count)).toBe(enums)
  })

  test('the seed is idempotent: a second run changes no counts', async () => {
    const counts = () =>
      Promise.all([
        db.city.count(),
        db.user.count(),
        db.company.count(),
        db.pitch.count(),
        db.review.count(),
      ])
    const before = await counts()
    execSync('pnpm exec tsx prisma/seed.ts', {
      cwd: WEB_ROOT,
      env: { ...process.env, DATABASE_URL: E2E_DATABASE_URL, NODE_ENV: 'development' },
      stdio: 'pipe',
    })
    expect(await counts()).toEqual(before)
    expect(before[0]).toBe(10)
  })

  test('the admin password is bcrypt cost 12 (PRD §6.6)', async () => {
    const admin = await db.user.findUniqueOrThrow({ where: { email: 'admin@pitchup.ro' } })
    expect(admin.role).toBe('ADMIN')
    expect(bcrypt.getRounds(admin.passwordHash)).toBe(12)
    expect(await bcrypt.compare(ADMIN_PASSWORD, admin.passwordHash)).toBe(true)
    expect(await bcrypt.compare('wrong', admin.passwordHash)).toBe(false)
  })
})

test.describe('API layer (E01-08, E01-09)', () => {
  test('/health answers with the success envelope', async ({ request }) => {
    const res = await request.get('/api/v1/health')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body).toEqual({
      data: { status: 'ok', version: '1.0.0', timestamp: expect.any(String) },
      error: null,
    })
  })

  test('the rate limiter answers 429 past the window limit', async ({ request }) => {
    let last = 0
    for (let i = 0; i < 61 && last !== 429; i++) {
      last = (await get(request, '/health')).status
    }
    const limited = await get(request, '/health')
    expect(limited.status).toBe(429)
    expect(limited.error?.code).toBe('RATE_LIMITED')
    expect(limited.error?.details).toEqual({ retryAfterSeconds: expect.any(Number) })
  })

  test('the admin signs in on the web and /me returns the session user', async ({ request }) => {
    const { csrfToken } = await (await request.get('/api/auth/csrf')).json()
    await request.post('/api/auth/callback/credentials', {
      form: { csrfToken, email: 'admin@pitchup.ro', password: ADMIN_PASSWORD, callbackUrl: '/' },
    })
    const cookies = (await request.storageState()).cookies.map(c => c.name)
    expect(cookies).toContain('authjs.session-token')

    const me = await get<{ email: string; role: string }>(request, '/me')
    expect(me.status).toBe(200)
    expect(me.data).toMatchObject({ email: 'admin@pitchup.ro', role: 'ADMIN' })
  })
})

test.describe('client bundle', () => {
  /** Server-only values from apps/web/.env (local runs) and the process (CI). */
  function serverSecrets(): string[] {
    const keys = [
      'NEXTAUTH_SECRET',
      'DATABASE_URL',
      'CLOUDINARY_API_SECRET',
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'RESEND_API_KEY',
      'TWILIO_AUTH_TOKEN',
      'FCM_SERVER_KEY',
      'ADMIN_PASSWORD',
    ]
    const values = keys.map(k => process.env[k])
    const dotenv = join(WEB_ROOT, '.env')
    if (existsSync(dotenv)) {
      for (const line of readFileSync(dotenv, 'utf8').split(/\r?\n/)) {
        const m = line.match(/^([A-Z_]+)=(.*)$/)
        if (m && keys.includes(m[1] as string)) values.push(m[2]?.replace(/^"|"$/g, ''))
      }
    }
    return [...values, E2E_DATABASE_URL, 'pitchup_test', 'pitchup_dev'].filter(
      (v): v is string => !!v && v.length >= 8
    )
  }

  function files(dir: string): string[] {
    return readdirSync(dir).flatMap(name => {
      const path = join(dir, name)
      return statSync(path).isDirectory() ? files(path) : [path]
    })
  }

  test('carries no server secret (E01-05)', () => {
    const staticDir = join(WEB_ROOT, '.next', 'static')
    expect(existsSync(staticDir), 'run after `next build`').toBe(true)
    const secrets = serverSecrets()
    expect(secrets.length).toBeGreaterThan(2)

    const leaks: string[] = []
    for (const file of files(staticDir).filter(f => /\.(js|css|html|json)$/.test(f))) {
      const text = readFileSync(file, 'utf8')
      for (const secret of secrets) {
        if (text.includes(secret)) leaks.push(`${file.slice(staticDir.length)}`)
      }
    }
    expect(leaks).toEqual([])
  })
})
