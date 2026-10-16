/**
 * /api/v1/cron/notifications — E13-04. Hourly (vercel.json): the 24-hour
 * booking reminders, then any notification whose email, SMS or push hasn't
 * gone out yet (the outbox sweep). Needs `Authorization: Bearer $CRON_SECRET`.
 */
import type { NextRequest } from 'next/server'
import { err, ok, withErrorHandling } from '@/lib/api/response'
import { cronAuthorised } from '@/lib/cron'
import { deliverPending } from '@/lib/notifications/dispatch'
import { queueReminders } from '@/lib/notifications/reminders'

export const dynamic = 'force-dynamic'

const run = withErrorHandling(async (request: NextRequest) => {
  if (!cronAuthorised(request)) return err('UNAUTHORIZED', 'Not authorised', 401)
  const { reminded } = await queueReminders()
  const { delivered } = await deliverPending()
  console.warn(`[notifications] ${reminded} reminders queued, ${delivered} delivered`)
  return ok({ reminded, delivered })
})

export const GET = run
export const POST = run
