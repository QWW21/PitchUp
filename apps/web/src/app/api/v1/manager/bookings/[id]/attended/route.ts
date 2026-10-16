/**
 * POST /api/v1/manager/bookings/:id/attended — C-8. The player came and paid
 * at the venue; a "deposit back" booking's deposit is refunded.
 */
import { ok } from '@/lib/api/response'
import { confirmAttended } from '@/lib/manager/bookings'
import { managerRoute } from '@/lib/manager/manager-route'

export const dynamic = 'force-dynamic'

export const POST = managerRoute(async (_request, company, { id }) =>
  ok(await confirmAttended(company.id, id!))
)
