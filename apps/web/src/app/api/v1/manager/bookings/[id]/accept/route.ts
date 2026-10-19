/**
 * POST /api/v1/manager/bookings/:id/accept — C-13. A booking waiting for the
 * venue is confirmed, and the player is told.
 */
import { ok } from '@/lib/api/response'
import { acceptRequest } from '@/lib/manager/bookings'
import { managerRoute } from '@/lib/manager/manager-route'

export const dynamic = 'force-dynamic'

export const POST = managerRoute(async (_request, company, { id }) =>
  ok(await acceptRequest(company.id, id!))
)
