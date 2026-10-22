/**
 * Client IP for the per-IP limits — ticket #188. X-Forwarded-For is read
 * TRUSTED_PROXY_HOPS entries from the right, since everything to the left of
 * what our own proxy appended is whatever the client sent.
 */
import type { NextRequest } from 'next/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

const VALID = {
  DATABASE_URL: 'postgresql://postgres:password@localhost:5432/pitchup_dev?schema=public',
  NEXTAUTH_SECRET: 'x'.repeat(32),
  NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
}

/** A fresh copy of rate-limit.ts, with TRUSTED_PROXY_HOPS as given ('' = unset). */
async function load(hops: string) {
  vi.resetModules()
  vi.stubEnv('SKIP_ENV_VALIDATION', '')
  for (const [key, value] of Object.entries(VALID)) vi.stubEnv(key, value)
  vi.stubEnv('TRUSTED_PROXY_HOPS', hops)
  return import('./rate-limit')
}

const req = (headers: Record<string, string>) =>
  ({ headers: new Headers(headers) }) as unknown as NextRequest

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('getClientIp (#188)', () => {
  it('AC1: with TRUSTED_PROXY_HOPS unset, the last X-Forwarded-For entry, trimmed', async () => {
    const { getClientIp } = await load('')
    expect(getClientIp(req({ 'x-forwarded-for': '203.0.113.9, 198.51.100.7' }))).toBe(
      '198.51.100.7'
    )
    expect(getClientIp(req({ 'x-forwarded-for': '203.0.113.9,  198.51.100.7  ' }))).toBe(
      '198.51.100.7'
    )
  })

  it('AC2: with TRUSTED_PROXY_HOPS=2, the second entry from the right', async () => {
    const { getClientIp } = await load('2')
    expect(getClientIp(req({ 'x-forwarded-for': '1.1.1.1, 203.0.113.9, 198.51.100.7' }))).toBe(
      '203.0.113.9'
    )
  })

  it('AC3: fewer entries than hops gives the leftmost; then x-real-ip; then unknown', async () => {
    const { getClientIp } = await load('2')
    expect(getClientIp(req({ 'x-forwarded-for': '203.0.113.9' }))).toBe('203.0.113.9')
    expect(getClientIp(req({ 'x-real-ip': '198.51.100.20' }))).toBe('198.51.100.20')
    expect(getClientIp(req({}))).toBe('unknown')
  })
})
