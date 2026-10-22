/**
 * In-memory rate limiter — ticket E01-08.
 *
 * Counters live in the process, so they reset on restart and are not shared
 * between serverless instances. Accepted for v1.0; Redis in v1.1. This is a
 * throttle, not a security boundary — it will not stop a distributed attempt.
 */
import type { NextRequest } from 'next/server'
import { AUTH } from '@pitchup/shared'
import { env } from '@/lib/env'

export interface RateLimitRule {
  /** Requests allowed inside the window. */
  limit: number
  /** Window length in milliseconds. */
  windowMs: number
}

/** PRD §6.6: 5 login attempts per 15 minutes per IP. */
export const AUTH_RATE_LIMIT: RateLimitRule = { limit: 5, windowMs: 15 * 60 * 1000 }

export const GENERAL_RATE_LIMIT: RateLimitRule = { limit: 60, windowMs: 60 * 1000 }

/**
 * Ceiling on messages to one phone number, regardless of who asks.
 *
 * Per-IP limits alone do not bound this: an attacker rotating IPs can text
 * one victim indefinitely, which is both harassment and a bill, since every
 * SMS is billed. Keyed on the recipient, so the number itself is protected.
 * Ticket E02-10: 3 sends per phone per hour.
 */
export const SMS_PER_PHONE_RATE_LIMIT: RateLimitRule = {
  limit: 3,
  windowMs: 60 * 60 * 1000,
}

/** Ticket E02-11: 3 reset requests per email address per hour. */
export const PASSWORD_RESET_RATE_LIMIT: RateLimitRule = {
  limit: 3,
  windowMs: 60 * 60 * 1000,
}

/** Same reasoning for email: a mailbox should not be floodable. */
export const EMAIL_PER_ADDRESS_RATE_LIMIT: RateLimitRule = {
  limit: 5,
  windowMs: 60 * 60 * 1000,
}

/**
 * Ticket #188: failed sign-ins per email address, web and mobile together.
 * Every attempt is counted up front (checkRateLimit) and a successful sign-in
 * is refunded (refundRateLimit), so rotating IPs cannot buy more password
 * guesses for one account, and neither can sending them all at once.
 */
export const ACCOUNT_LOGIN_RATE_LIMIT: RateLimitRule = {
  limit: AUTH.ACCOUNT_LOGIN_FAILURE_LIMIT,
  windowMs: AUTH.ACCOUNT_LOGIN_WINDOW_MINUTES * 60 * 1000,
}

interface Counter {
  count: number
  resetAt: number
}

const counters = new Map<string, Counter>()

/** Bounds memory use: a long-running process would otherwise keep every IP seen. */
function evictExpired(now: number): void {
  for (const [key, counter] of counters) {
    if (counter.resetAt <= now) counters.delete(key)
  }
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
  /** Seconds until the window resets — for the Retry-After header. */
  retryAfterSeconds: number
}

export function checkRateLimit(
  key: string,
  rule: RateLimitRule = GENERAL_RATE_LIMIT
): RateLimitResult {
  const now = Date.now()
  if (counters.size > 10_000) evictExpired(now)

  const existing = counters.get(key)

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + rule.windowMs
    counters.set(key, { count: 1, resetAt })
    return {
      allowed: true,
      remaining: rule.limit - 1,
      resetAt,
      retryAfterSeconds: Math.ceil(rule.windowMs / 1000),
    }
  }

  existing.count += 1
  const allowed = existing.count <= rule.limit

  return {
    allowed,
    remaining: Math.max(0, rule.limit - existing.count),
    resetAt: existing.resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  }
}

/**
 * Gives back one request counted by checkRateLimit. A limit on failures only
 * reserves its slot up front, so concurrent attempts cannot all slip under it,
 * and refunds it when the attempt succeeds (#188).
 */
export function refundRateLimit(key: string): void {
  const existing = counters.get(key)
  if (existing && existing.resetAt > Date.now() && existing.count > 0) existing.count -= 1
}

/**
 * Best-effort client IP, ticket #188.
 *
 * Every X-Forwarded-For entry left of what our own proxies added is whatever
 * the client sent, so the IP is read TRUSTED_PROXY_HOPS entries from the
 * right (default 1: Vercel overwrites the header, nginx appends to it). A
 * header shorter than that gives its leftmost entry. A bare `next start`
 * with no proxy keeps a header the client sent, so there the per-IP limits
 * are spoofable; the per-account login limit is not.
 */
export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const entries = forwarded
      .split(',')
      .map(entry => entry.trim())
      .filter(Boolean)
    const ip = entries[Math.max(0, entries.length - env.TRUSTED_PROXY_HOPS)]
    if (ip) return ip
  }
  return request.headers.get('x-real-ip') ?? 'unknown'
}

/** Clears all counters. Test helper. */
export function resetRateLimits(): void {
  counters.clear()
}
