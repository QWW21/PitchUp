/**
 * GET /api/v1/admin/companies — E15-01. Every venue, newest first: ?status=
 * (DRAFT, PENDING, ACTIVE, SUSPENDED), ?search= (a name or the manager's
 * email, 2+ characters), cursor pages of 20. Admins only.
 */
import type { NextRequest } from 'next/server'
import { AdminCompanyQuerySchema } from '@pitchup/shared'
import { ok, withErrorHandling } from '@/lib/api/response'
import { requireRole } from '@/lib/api/middleware'
import { validateQuery } from '@/lib/api/validate'
import { listCompanies } from '@/lib/admin/companies'

export const dynamic = 'force-dynamic'

export const GET = withErrorHandling(
  requireRole('ADMIN')(async (request: NextRequest) => {
    const query = validateQuery(request, AdminCompanyQuerySchema)
    if (query.error) return query.error
    return ok(await listCompanies(query.data))
  })
)
