/**
 * In-memory rate limiter — ticket E01-08.
 *
 * Counters live in the process, so they reset on restart and are not shared
 * between serverless instances. Accepted for v1.0; Redis in v1.1. This is a
 * throttle, not a security boundary — it will not stop a distributed attempt.
 */
import type { NextRequest } from 'next/server'

export interface RateLimitRule {
  /** Requests allowed inside the window. */
  limit: number
  /** Window length in milliseconds. */
  windowMs: number
}

/** PRD §6.6: 5 login attempts per 15 minutes per IP. */
export const AUTH_RATE_LIMIT: RateLimitRule = { limit: 5, windowMs: 15 * 60 * 1000 }

export const GENERAL_RATE_LIMIT: RateLimitRule = { limit: 60, windowMs: 60 * 1000 }

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
 * Best-effort client IP.
 *
 * x-forwarded-for is client-controlled unless a trusted proxy overwrites it.
 * On Vercel it is trustworthy; behind another proxy, confirm before relying
 * on this for anything stricter than throttling.
 */
export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]
    if (first) return first.trim()
  }
  return request.headers.get('x-real-ip') ?? 'unknown'
}

/** Clears all counters. Test helper. */
export function resetRateLimits(): void {
  counters.clear()
}
