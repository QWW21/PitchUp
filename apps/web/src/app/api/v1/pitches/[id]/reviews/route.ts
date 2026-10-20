/**
 * GET /api/v1/pitches/:id/reviews?sort=newest|highest|lowest|unanswered&page=&limit=
 * E07-01. Public. One pitch's approved reviews with the rating, the count per
 * star and the venue's replies. Anonymous reviews show "Anonymous player".
 * Same data as GET /reviews?pitchId=, under the pitch.
 */
import type { NextRequest } from 'next/server'
import { ReviewListQuerySchema } from '@pitchup/shared'
import { err, ok, withErrorHandling } from '@/lib/api/response'
import { validateQuery } from '@/lib/api/validate'
import { listReviews } from '@/lib/venues/reviews'

export const dynamic = 'force-dynamic'

export const GET = withErrorHandling(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const query = validateQuery(request, ReviewListQuerySchema)
    if (query.error) return query.error
    const page = await listReviews({ pitchId: (await params).id, ...query.data })
    if (!page) return err('NOT_FOUND', 'api.pitchNotFound', 404)
    return ok(page)
  }
)
