/**
 * /api/v1/cron/billing — C-15. Daily (vercel.json): test subscriptions bill
 * themselves, ended and unpaid ones pause their venue, Stripe ones are
 * repriced before they renew, and free months ending soon are announced.
 * Needs `Authorization: Bearer $CRON_SECRET`.
 */
import type { NextRequest } from 'next/server'
import { err, ok, withErrorHandling } from '@/lib/api/response'
import { cronAuthorised } from '@/lib/cron'
import { runBilling } from '@/lib/billing'

export const dynamic = 'force-dynamic'

const run = withErrorHandling(async (request: NextRequest) => {
  if (!cronAuthorised(request)) return err('UNAUTHORIZED', 'api.notAuthorised', 401)
  const result = await runBilling()
  console.warn(
    `[billing] ${result.billed} billed, ${result.paused} paused, ${result.repriced} repriced, ${result.reminded} reminded`
  )
  return ok(result)
})

export const GET = run
export const POST = run
