/**
 * GET /api/v1/admin/disputes?status=open|resolved|all — E12-04, E15-04.
 * Open no-show disputes oldest first (the default); decided ones newest
 * first. Admins only.
 */
import type { NextRequest } from 'next/server'
import { AdminDisputeQuerySchema } from '@pitchup/shared'
import { ok, withErrorHandling } from '@/lib/api/response'
import { requireRole } from '@/lib/api/middleware'
import { validateQuery } from '@/lib/api/validate'
import { listDisputes } from '@/lib/admin/disputes'

export const dynamic = 'force-dynamic'

export const GET = withErrorHandling(
  requireRole('ADMIN')(async (request: NextRequest) => {
    const query = validateQuery(request, AdminDisputeQuerySchema)
    if (query.error) return query.error
    const response = ok(await listDisputes(query.data.status))
    response.headers.set('Cache-Control', 'no-store')
    return response
  })
)
