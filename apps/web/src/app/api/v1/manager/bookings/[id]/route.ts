/**
 * GET /api/v1/manager/bookings/:id — E11-03. One booking in full: payment
 * and payout, teams and shirts, the player's history at this venue (not
 * their trust score), the timeline and any review. 404 for another venue's.
 */
import { ok } from '@/lib/api/response'
import { managerBookingDetail } from '@/lib/manager/bookings'
import { managerRoute } from '@/lib/manager/manager-route'

export const dynamic = 'force-dynamic'

export const GET = managerRoute(async (_request, company, { id }) => {
  const response = ok(await managerBookingDetail(company.id, id!))
  response.headers.set('Cache-Control', 'no-store')
  return response
})
