/**
 * GET /api/v1/reviews?pitchId=|companyId=&page=&limit= — E04-07. Public.
 * Approved reviews, newest first, with the star distribution for the header.
 */
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { err, ok, withErrorHandling } from '@/lib/api/response'
import { listReviews } from '@/lib/venues/reviews'

export const dynamic = 'force-dynamic'

const ReviewQuerySchema = z
  .object({
    pitchId: z.string().min(1).optional(),
    companyId: z.string().min(1).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
  })
  .refine(q => q.pitchId || q.companyId, { message: 'pitchId or companyId is required' })

export const GET = withErrorHandling(async (request: NextRequest) => {
  const parsed = ReviewQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) {
    return err('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid query', 400)
  }
  const page = await listReviews(parsed.data)
  if (!page) return err('NOT_FOUND', 'Pitch or company not found', 404)
  return ok(page)
})
