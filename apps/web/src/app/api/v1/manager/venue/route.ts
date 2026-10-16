/**
 * GET /api/v1/manager/venue — C-13. Which of the venue's details wait for an
 * admin, since when, and why the last proposal was turned down.
 * DELETE withdraws everything waiting.
 */
import { ok } from '@/lib/api/response'
import { managerRoute } from '@/lib/manager/manager-route'
import { venueChangesStatus, withdrawVenueChanges } from '@/lib/manager/venue'

export const dynamic = 'force-dynamic'

export const GET = managerRoute(async (_request, company) => ok(venueChangesStatus(company)))

export const DELETE = managerRoute(async (_request, company) =>
  ok(await withdrawVenueChanges(company.id))
)
