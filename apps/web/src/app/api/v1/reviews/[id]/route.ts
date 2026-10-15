/**
 * PUT /api/v1/reviews/:id — edit; DELETE /api/v1/reviews/:id — soft delete.
 * E06-05. The author, within 24 hours of posting (an admin at any time).
 */
import { NextResponse, type NextRequest } from 'next/server'
import { UpdateReviewSchema } from '@pitchup/shared'
import { ok, withErrorHandling } from '@/lib/api/response'
import { requireAuth } from '@/lib/api/middleware'
import { validateBody } from '@/lib/api/validate'
import { deleteReview, updateReview } from '@/lib/reviews/write'

export const dynamic = 'force-dynamic'

const idOf = (request: NextRequest) => request.nextUrl.pathname.split('/').pop() ?? ''

export const PUT = withErrorHandling(
  requireAuth(async (request: NextRequest, session) => {
    const parsed = await validateBody(request, UpdateReviewSchema)
    if (parsed.error) return parsed.error
    await updateReview(idOf(request), session.user, parsed.data)
    return ok({ updated: true })
  })
)

export const DELETE = withErrorHandling(
  requireAuth(async (request: NextRequest, session) => {
    await deleteReview(idOf(request), session.user)
    return new NextResponse(null, { status: 204 })
  })
)
