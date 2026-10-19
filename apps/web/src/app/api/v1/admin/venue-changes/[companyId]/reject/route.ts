/**
 * POST /api/v1/admin/venue-changes/:companyId/reject { reason } — C-13. The
 * proposal is dropped and the manager is told why; the page keeps its
 * current details. Admins only.
 */
import type { NextRequest } from 'next/server'
import { RejectCompanySchema } from '@pitchup/shared'
import { ok, withErrorHandling } from '@/lib/api/response'
import { requireRole } from '@/lib/api/middleware'
import { validateBody } from '@/lib/api/validate'
import { rejectVenueChanges } from '@/lib/manager/venue'

export const dynamic = 'force-dynamic'

export const POST = withErrorHandling(
  requireRole('ADMIN')(async (request: NextRequest) => {
    const parsed = await validateBody(request, RejectCompanySchema)
    if (parsed.error) return parsed.error
    await rejectVenueChanges(request.nextUrl.pathname.split('/').at(-2) ?? '', parsed.data.reason)
    return ok({ approved: false })
  })
)
