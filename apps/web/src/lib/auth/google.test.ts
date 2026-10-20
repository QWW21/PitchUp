/**
 * Google sign-in without Google — E02-07. ID tokens are signed with a
 * throwaway RSA key and checked against it, so the real verification code
 * runs: signature, issuer, audience, expiry and the verified address.
 */
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTVerifyGetKey } from 'jose'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const WEB_CLIENT = 'web-123.apps.googleusercontent.com'

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
}))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

const service = vi.hoisted(() => ({
  issueTokens: vi.fn(async () => ({ accessToken: 'at', refreshToken: 'rt' })),
}))
vi.mock('./service', () => service)

let keys: JWTVerifyGetKey
let sign: (claims: Record<string, unknown>, aud?: string) => Promise<string>

beforeAll(async () => {
  const { privateKey, publicKey } = await generateKeyPair('RS256')
  const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256' }
  keys = createLocalJWKSet({ keys: [jwk] })
  sign = (claims, aud = WEB_CLIENT) =>
    new SignJWT(claims)
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setIssuer('https://accounts.google.com')
      .setAudience(aud)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey)
})

async function load(clientId = WEB_CLIENT) {
  vi.resetModules()
  vi.stubEnv('SKIP_ENV_VALIDATION', '')
  vi.stubEnv('DATABASE_URL', 'postgresql://u:p@localhost:5432/x')
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000')
  vi.stubEnv('GOOGLE_CLIENT_ID', clientId)
  return import('./google')
}

const ana = { email: 'Ana@Example.ro', email_verified: true, name: 'Ana Pop' }
const profile = { phone: '+40711111111', city: 'Cluj-Napoca', dateOfBirth: '1995-06-15' }

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.unstubAllEnvs())

describe('verifyGoogleIdToken', () => {
  it('accepts a token for our client and lower-cases the address', async () => {
    const { verifyGoogleIdToken } = await load()
    expect(await verifyGoogleIdToken(await sign(ana), keys)).toEqual({
      email: 'ana@example.ro',
      name: 'Ana Pop',
    })
  })

  it('refuses another app’s token, an unverified address and a forgery', async () => {
    const { verifyGoogleIdToken } = await load()
    expect(await verifyGoogleIdToken(await sign(ana, 'someone-else'), keys)).toBeNull()
    expect(
      await verifyGoogleIdToken(await sign({ ...ana, email_verified: false }), keys)
    ).toBeNull()
    const token = await sign(ana)
    const tampered = token.slice(0, -4) + (token.endsWith('AAAA') ? 'BBBB' : 'AAAA')
    expect(await verifyGoogleIdToken(tampered, keys)).toBeNull()
  })

  it('is off without a configured client', async () => {
    const { isGoogleSignInConfigured, verifyGoogleIdToken } = await load('')
    expect(isGoogleSignInConfigured()).toBe(false)
    expect(await verifyGoogleIdToken(await sign(ana), keys)).toBeNull()
  })
})

describe('signInWithGoogle', () => {
  it('signs a confirmed account in', async () => {
    const { signInWithGoogle } = await load()
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'u1',
      name: 'Ana',
      email: 'ana@example.ro',
      role: 'PLAYER',
      emailVerified: true,
    })
    const result = await signInWithGoogle({ idToken: await sign(ana) }, 'ua', keys)
    expect(result).toMatchObject({ status: 'SIGNED_IN', user: { id: 'u1' }, accessToken: 'at' })
    expect(service.issueTokens).toHaveBeenCalledWith('u1', 'PLAYER', 'ua')
  })

  it('turns a suspended account away', async () => {
    const { signInWithGoogle } = await load()
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'u1',
      emailVerified: true,
      suspendedAt: new Date(),
    })
    expect(await signInWithGoogle({ idToken: await sign(ana) }, undefined, keys)).toEqual({
      failure: 'ACCOUNT_SUSPENDED',
    })
  })

  it('asks a new address for the missing details, then makes a verified player', async () => {
    const { signInWithGoogle } = await load()
    prismaMock.user.findUnique.mockResolvedValue(null)
    const token = await sign(ana)

    expect(await signInWithGoogle({ idToken: token }, undefined, keys)).toEqual({
      status: 'PROFILE_NEEDED',
      email: 'ana@example.ro',
      name: 'Ana Pop',
    })
    expect(prismaMock.user.create).not.toHaveBeenCalled()

    prismaMock.user.create.mockResolvedValueOnce({
      id: 'u2',
      name: 'Ana Pop',
      email: 'ana@example.ro',
      phone: profile.phone,
      role: 'PLAYER',
    })
    const result = await signInWithGoogle({ idToken: token, profile }, undefined, keys)
    expect(result).toMatchObject({ status: 'SIGNED_IN', user: { id: 'u2' } })
    const data = prismaMock.user.create.mock.calls[0]![0].data
    expect(data).toMatchObject({
      email: 'ana@example.ro',
      phone: profile.phone,
      role: 'PLAYER',
      emailVerified: true,
    })
    expect(data.passwordHash).toMatch(/^\$2/)
  })

  it('will not take a confirmed account’s phone number', async () => {
    const { signInWithGoogle } = await load()
    prismaMock.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'other', emailVerified: true })
    expect(await signInWithGoogle({ idToken: await sign(ana), profile }, undefined, keys)).toEqual({
      failure: 'PHONE_TAKEN',
    })
    expect(prismaMock.user.create).not.toHaveBeenCalled()
  })

  it('rejects a bad token before touching the database', async () => {
    const { signInWithGoogle } = await load()
    expect(await signInWithGoogle({ idToken: 'x'.repeat(40) }, undefined, keys)).toEqual({
      failure: 'INVALID_TOKEN',
    })
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
  })
})
