import { describe, expect, it } from 'vitest'
import { SignJWT } from 'jose'
import { safeCallbackPath } from './callback'
import { toE164 } from './phone'
import { bearerFromHeader, signAccessToken, verifyAccessToken } from './tokens'

const ORIGIN = 'https://pitchup.ro'

describe('safeCallbackPath (#172 open redirect)', () => {
  it.each([
    ['/discover?city=Iași', '/discover?city=Ia%C8%99i'],
    ['/booking/new?pitchId=abc#top', '/booking/new?pitchId=abc#top'],
    [`${ORIGIN}/dashboard`, '/dashboard'],
  ])('keeps a same-site target: %s', (input, expected) => {
    expect(safeCallbackPath(input, ORIGIN)).toBe(expected)
  })

  it.each([
    '//evil.example',
    '/\\evil.example',
    'https://evil.example/login',
    'javascript:alert(1)',
  ])('refuses %s', input => {
    expect(safeCallbackPath(input, ORIGIN)).toBe('/dashboard')
  })

  it('defaults to the dashboard', () => {
    expect(safeCallbackPath(null, ORIGIN)).toBe('/dashboard')
  })
})

describe('toE164 (#174 doubled country code)', () => {
  it.each([
    ['+40', '712 345 678', '+40712345678'],
    ['+40', '0712 345 678', '+40712345678'],
    ['+40', '+40 712 345 678', '+40712345678'],
    ['+40', '0040712345678', '+40712345678'],
    ['+44', '7911 123456', '+447911123456'],
    ['+40', '+44 7911 123456', '+447911123456'],
  ])('%s + "%s" → %s', (dial, typed, expected) => {
    expect(toE164(dial, typed)).toBe(expected)
  })
})

describe('mobile access tokens', () => {
  it('round-trips the claims', async () => {
    const token = await signAccessToken({ userId: 'user-1', role: 'PLAYER' })
    expect(await verifyAccessToken(token)).toEqual({ userId: 'user-1', role: 'PLAYER' })
  })

  it('rejects a tampered token', async () => {
    const token = await signAccessToken({ userId: 'user-1', role: 'PLAYER' })
    const [h, p, s] = token.split('.')
    const forged = Buffer.from(JSON.stringify({ sub: 'user-1', role: 'ADMIN' })).toString(
      'base64url'
    )
    expect(await verifyAccessToken(`${h}.${forged}.${s}`)).toBeNull()
    expect(p).toBeTruthy()
  })

  it('rejects a token signed with another secret or for another audience', async () => {
    const other = await new SignJWT({ role: 'PLAYER' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('user-1')
      .setIssuer('pitchup')
      .setAudience('pitchup-mobile')
      .setExpirationTime('5m')
      .sign(new TextEncoder().encode('a-completely-different-secret-value!!'))
    expect(await verifyAccessToken(other)).toBeNull()

    const wrongAudience = await new SignJWT({ role: 'PLAYER' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('user-1')
      .setIssuer('pitchup')
      .setAudience('somewhere-else')
      .setExpirationTime('5m')
      .sign(new TextEncoder().encode(process.env.NEXTAUTH_SECRET!))
    expect(await verifyAccessToken(wrongAudience)).toBeNull()
  })

  it('rejects an expired token', async () => {
    const expired = await new SignJWT({ role: 'PLAYER' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('user-1')
      .setIssuer('pitchup')
      .setAudience('pitchup-mobile')
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode(process.env.NEXTAUTH_SECRET!))
    expect(await verifyAccessToken(expired)).toBeNull()
  })

  it('reads only Bearer authorization headers', () => {
    expect(bearerFromHeader('Bearer abc.def')).toBe('abc.def')
    expect(bearerFromHeader('bearer abc')).toBe('abc')
    expect(bearerFromHeader('Basic abc')).toBeNull()
    expect(bearerFromHeader('Bearer')).toBeNull()
    expect(bearerFromHeader(null)).toBeNull()
  })
})
