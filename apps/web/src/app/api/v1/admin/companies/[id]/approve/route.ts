/** POST /api/v1/admin/companies/:id/approve — PENDING → ACTIVE; the manager is told. Admins only. */
import type { NextRequest } from 'next/server'
import { ok, withErrorHandling } from '@/lib/api/response'
import { requireRole } from '@/lib/api/middleware'
import { approveCompany } from '@/lib/admin/companies'

export const dynamic = 'force-dynamic'

export const POST = withErrorHandling(
  requireRole('ADMIN')(async (request: NextRequest) => {
    await approveCompany(request.nextUrl.pathname.split('/').at(-2) ?? '')
    return ok({ status: 'ACTIVE' })
  })
)
