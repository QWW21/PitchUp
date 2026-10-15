/**
 * E01 infrastructure rules — ported from scripts/verify-e01.sh: environment
 * validation (E01-05), the Prisma singleton and Cloudinary upload signing
 * (E01-10). The database and server checks from that script live in
 * e2e/api/infra.spec.ts.
 */
import { createHash } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const VALID = {
  DATABASE_URL: 'postgresql://postgres:password@localhost:5432/pitchup_dev?schema=public',
  NEXTAUTH_SECRET: 'x'.repeat(32),
  NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
}

/** Imports a fresh copy of env.ts with exactly these variables set. */
async function loadEnv(vars: Record<string, string | undefined>) {
  vi.resetModules()
  vi.stubEnv('SKIP_ENV_VALIDATION', '')
  for (const key of [
    ...Object.keys(VALID),
    'STRIPE_SECRET_KEY',
    'TWILIO_PHONE_NUMBER',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
    'NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME',
  ]) {
    vi.stubEnv(key, vars[key] ?? '')
  }
  return import('./env')
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('environment validation (E01-05)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('accepts a valid environment', async () => {
    const { env } = await loadEnv(VALID)
    expect(env.DATABASE_URL).toBe(VALID.DATABASE_URL)
  })

  it.each([
    ['a missing DATABASE_URL', { DATABASE_URL: undefined }],
    ['a malformed DATABASE_URL', { DATABASE_URL: 'nope' }],
    ['a short NEXTAUTH_SECRET', { NEXTAUTH_SECRET: 'short' }],
    ['an empty NEXTAUTH_SECRET', { NEXTAUTH_SECRET: '' }],
    ['a Stripe key with the wrong prefix', { STRIPE_SECRET_KEY: 'pk_x' }],
    ['a Twilio number that is not E.164', { TWILIO_PHONE_NUMBER: '07123' }],
  ])('rejects %s', async (_label, patch) => {
    await expect(loadEnv({ ...VALID, ...patch })).rejects.toThrow(/Invalid environment variables/)
  })
})

describe('Prisma client', () => {
  it('is one instance across module reloads, so hot reload does not leak connections', async () => {
    vi.resetModules()
    const a = (await import('./prisma')).prisma
    vi.resetModules()
    const b = (await import('./prisma')).prisma
    expect(b).toBe(a)
    expect((globalThis as { prisma?: unknown }).prisma).toBe(a)
  })
})

// The first import of the Cloudinary SDK is slow on a busy machine.
describe('Cloudinary signing (E01-10)', { timeout: 20_000 }, () => {
  const SECRET = 'test_secret_value'
  const cloudinary = async () => {
    await loadEnv({
      ...VALID,
      CLOUDINARY_API_KEY: '1',
      CLOUDINARY_API_SECRET: SECRET,
      NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: 'demo',
    })
    return import('./cloudinary')
  }

  it("signs with Cloudinary's sha1 scheme and never returns the secret", async () => {
    const { createUploadSignature } = await cloudinary()
    const folder = 'pitchup/pitches/abc'
    const sig = createUploadSignature(folder)
    const want = createHash('sha1')
      .update(`folder=${folder}&timestamp=${sig.timestamp}${SECRET}`)
      .digest('hex')
    expect(sig).toEqual({
      signature: want,
      timestamp: sig.timestamp,
      apiKey: '1',
      cloudName: 'demo',
      folder,
    })
    expect(JSON.stringify(sig)).not.toContain(SECRET)
  })

  it('builds folders from fixed prefixes and refuses path tricks', async () => {
    const { buildFolder } = await cloudinary()
    expect(buildFolder('PITCH', 'abc_123')).toBe('pitchup/pitches/abc_123')
    expect(() => buildFolder('PITCH', '../users/x')).toThrow()
  })

  it('refuses to sign when it is not configured', async () => {
    await loadEnv(VALID)
    const { createUploadSignature, isCloudinaryConfigured } = await import('./cloudinary')
    expect(isCloudinaryConfigured()).toBe(false)
    expect(() => createUploadSignature('pitchup/pitches/abc')).toThrow(/not configured/)
  })
})
