/**
 * /api/v1/cron/auto-complete — E11-10. Run nightly (vercel.json): confirmed
 * bookings that have ended become COMPLETED, and checkouts abandoned past
 * their hold become CANCELLED — the same settling the pages already do
 * lazily, for everyone at once. Needs `Authorization: Bearer $CRON_SECRET`;
 * without CRON_SECRET set it refuses every call. GET is what Vercel Cron
 * sends; POST is accepted too.
 */
import type { NextRequest } from 'next/server'
import { err, ok, withErrorHandling } from '@/lib/api/response'
import { cronAuthorised } from '@/lib/cron'
import { settleBookings } from '@/lib/bookings/mine'

export const dynamic = 'force-dynamic'

const run = withErrorHandling(async (request: NextRequest) => {
  if (!cronAuthorised(request)) return err('UNAUTHORIZED', 'Not authorised', 401)
  const result = await settleBookings({})
  console.warn(`[auto-complete] completed ${result.completed}, cancelled ${result.cancelled}`)
  return ok(result)
})

export const GET = run
export const POST = run
