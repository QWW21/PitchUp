/**
 * POST /api/v1/admin/companies/:id/reject { reason } — PENDING → DRAFT with
 * the reason, so the manager can fix and resubmit; they are told. Admins only.
 */
import type { NextRequest } from 'next/server'
import { RejectCompanySchema } from '@pitchup/shared'
import { ok, withErrorHandling } from '@/lib/api/response'
import { requireRole } from '@/lib/api/middleware'
import { validateBody } from '@/lib/api/validate'
import { rejectCompany } from '@/lib/admin/companies'

export const dynamic = 'force-dynamic'

export const POST = withErrorHandling(
  requireRole('ADMIN')(async (request: NextRequest) => {
    const parsed = await validateBody(request, RejectCompanySchema)
    if (parsed.error) return parsed.error
    await rejectCompany(request.nextUrl.pathname.split('/').at(-2) ?? '', parsed.data.reason)
    return ok({ status: 'DRAFT' })
  })
)
