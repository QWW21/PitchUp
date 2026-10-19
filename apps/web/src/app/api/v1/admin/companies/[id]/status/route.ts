/**
 * PUT /api/v1/admin/companies/:id/status { status, reason? } — E15-02.
 * Waiting → live (approve) or back to draft (with a reason); live →
 * suspended (with a reason); suspended → live. Anything else is 409. The
 * manager is told. Admins only.
 */
import type { NextRequest } from 'next/server'
import { CompanyStatusUpdateSchema } from '@pitchup/shared'
import { ok, withErrorHandling } from '@/lib/api/response'
import { requireRole } from '@/lib/api/middleware'
import { validateBody } from '@/lib/api/validate'
import { setCompanyStatus } from '@/lib/admin/companies'

export const dynamic = 'force-dynamic'

export const PUT = withErrorHandling(
  requireRole('ADMIN')(async (request: NextRequest) => {
    const body = await validateBody(request, CompanyStatusUpdateSchema)
    if (body.error) return body.error
    return ok(await setCompanyStatus(request.nextUrl.pathname.split('/').at(-2) ?? '', body.data))
  })
)
