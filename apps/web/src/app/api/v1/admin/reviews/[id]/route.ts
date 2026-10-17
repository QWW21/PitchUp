/**
 * DELETE /api/v1/admin/reviews/:id { reason } — E15-04. Deleted for good,
 * with its reports; the author is told why. Admins only.
 */
import type { NextRequest } from 'next/server'
import { AdminDeleteReviewSchema } from '@pitchup/shared'
import { ok, withErrorHandling } from '@/lib/api/response'
import { requireRole } from '@/lib/api/middleware'
import { validateBody } from '@/lib/api/validate'
import { deleteReview } from '@/lib/admin/reviews'

export const dynamic = 'force-dynamic'

export const DELETE = withErrorHandling(
  requireRole('ADMIN')(async (request: NextRequest) => {
    const body = await validateBody(request, AdminDeleteReviewSchema)
    if (body.error) return body.error
    await deleteReview(request.nextUrl.pathname.split('/').at(-1) ?? '', body.data.reason)
    return ok({ deleted: true })
  })
)
