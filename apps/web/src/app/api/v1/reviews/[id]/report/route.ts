/**
 * POST /api/v1/reviews/:id/report — E07-04. Any signed-in user, once per
 * review: { category: SPAM|OFFENSIVE|IRRELEVANT|FAKE, detail? }.
 * 200 · 400 OWN_REVIEW · 404 · 409 ALREADY_REPORTED. The review stays up.
 */
import type { NextRequest } from 'next/server'
import { ReportReviewSchema } from '@pitchup/shared'
import { ok, withErrorHandling } from '@/lib/api/response'
import { requireAuth } from '@/lib/api/middleware'
import { validateBody } from '@/lib/api/validate'
import { reportReview } from '@/lib/reviews/report'

export const dynamic = 'force-dynamic'

export const POST = withErrorHandling(
  requireAuth(async (request: NextRequest, session) => {
    const parsed = await validateBody(request, ReportReviewSchema)
    if (parsed.error) return parsed.error
    const id = request.nextUrl.pathname.split('/').at(-2) ?? ''
    await reportReview(id, session.user.id, parsed.data)
    return ok({ message: 'Report submitted' })
  })
)
