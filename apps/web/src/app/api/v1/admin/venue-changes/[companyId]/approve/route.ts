/**
 * POST /api/v1/admin/venue-changes/:companyId/approve — C-13. The venue's
 * new details go live; the manager is told. Admins only.
 */
import type { NextRequest } from 'next/server'
import { ok, withErrorHandling } from '@/lib/api/response'
import { requireRole } from '@/lib/api/middleware'
import { approveVenueChanges } from '@/lib/manager/venue'

export const dynamic = 'force-dynamic'

export const POST = withErrorHandling(
  requireRole('ADMIN')(async (request: NextRequest) => {
    await approveVenueChanges(request.nextUrl.pathname.split('/').at(-2) ?? '')
    return ok({ approved: true })
  })
)
