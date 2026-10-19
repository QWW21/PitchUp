/**
 * /api/v1/cron/trust-monthly — E12-05. On the 1st (vercel.json): the
 * monthly +1 recovery, then every score rebuilt from its history and
 * corrected if it drifted. Needs `Authorization: Bearer $CRON_SECRET`.
 */
import type { NextRequest } from 'next/server'
import { err, ok, withErrorHandling } from '@/lib/api/response'
import { cronAuthorised } from '@/lib/cron'
import { runMonthlyTrust } from '@/lib/trust/monthly'

export const dynamic = 'force-dynamic'

const run = withErrorHandling(async (request: NextRequest) => {
  if (!cronAuthorised(request)) return err('UNAUTHORIZED', 'Not authorised', 401)
  const result = await runMonthlyTrust()
  console.warn(
    `[trust-monthly] ${result.players} players: ${result.recovered} recovered, ${result.corrected} corrected, ${result.failed} failed`
  )
  return ok(result)
})

export const GET = run
export const POST = run
