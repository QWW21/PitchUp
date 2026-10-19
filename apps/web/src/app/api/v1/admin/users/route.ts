/**
 * GET /api/v1/admin/users — E15-03. Search by name or email, filter by role,
 * trust tier and status (active, suspended, deleted), newest first, cursor
 * pages of 20. Admins only.
 */
import type { NextRequest } from 'next/server'
import { AdminUserQuerySchema } from '@pitchup/shared'
import { ok, withErrorHandling } from '@/lib/api/response'
import { requireRole } from '@/lib/api/middleware'
import { validateQuery } from '@/lib/api/validate'
import { listUsers } from '@/lib/admin/users'

export const dynamic = 'force-dynamic'

export const GET = withErrorHandling(
  requireRole('ADMIN')(async (request: NextRequest) => {
    const query = validateQuery(request, AdminUserQuerySchema)
    if (query.error) return query.error
    return ok(await listUsers(query.data))
  })
)
