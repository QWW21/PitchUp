/**
 * GET /api/v1/admin/reviews — E15-04. Reviews with their report counts, most
 * reported first: ?minReports= (0–3, default 1), ?rating=, ?search= (text,
 * pitch or venue), pages of 20. Admins only.
 */
import type { NextRequest } from 'next/server'
import { AdminReviewQuerySchema } from '@pitchup/shared'
import { ok, withErrorHandling } from '@/lib/api/response'
import { requireRole } from '@/lib/api/middleware'
import { validateQuery } from '@/lib/api/validate'
import { listReviews } from '@/lib/admin/reviews'

export const dynamic = 'force-dynamic'

export const GET = withErrorHandling(
  requireRole('ADMIN')(async (request: NextRequest) => {
    const query = validateQuery(request, AdminReviewQuerySchema)
    if (query.error) return query.error
    return ok(await listReviews(query.data))
  })
)
