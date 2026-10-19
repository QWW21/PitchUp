/**
 * POST /api/v1/manager/bookings/:id/complete — E11-05. A confirmed booking
 * that has ended becomes COMPLETED (the nightly job does it too).
 */
import { ok } from '@/lib/api/response'
import { completeBooking } from '@/lib/manager/bookings'
import { managerRoute } from '@/lib/manager/manager-route'

export const dynamic = 'force-dynamic'

export const POST = managerRoute(async (_request, company, { id }) =>
  ok(await completeBooking(company.id, id!))
)
