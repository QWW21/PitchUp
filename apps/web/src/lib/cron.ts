/**
 * Scheduled jobs (E11-10, E12-05) are plain endpoints that Vercel Cron calls
 * with `Authorization: Bearer $CRON_SECRET`. Compared in constant time; with
 * no CRON_SECRET set, every call is refused.
 */
import 'server-only'
import type { NextRequest } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { env } from '@/lib/env'

export function cronAuthorised(request: NextRequest): boolean {
  const secret = env.CRON_SECRET
  if (!secret) return false
  const given = Buffer.from(request.headers.get('authorization') ?? '')
  const expected = Buffer.from(`Bearer ${secret}`)
  return given.length === expected.length && timingSafeEqual(given, expected)
}
