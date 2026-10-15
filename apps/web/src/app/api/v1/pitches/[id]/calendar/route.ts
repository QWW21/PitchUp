/**
 * GET /api/v1/pitches/:id/calendar?from=YYYY-MM-DD&days=N — E05-02. Public.
 * One status per day (available, full, closed) for the booking date step,
 * in one request instead of one per day.
 */
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { ok, withErrorHandling } from '@/lib/api/response'
import { validateQuery } from '@/lib/api/validate'
import { getCalendar } from '@/lib/venues/availability'

export const dynamic = 'force-dynamic'

const QuerySchema = z.object({
  from: z
    .string({ required_error: 'from is required' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'from must be YYYY-MM-DD')
    .refine(d => {
      const t = new Date(`${d}T00:00:00Z`)
      return !Number.isNaN(t.getTime()) && t.toISOString().startsWith(d)
    }, 'from is not a real date'),
  // Six weeks covers any month grid.
  days: z.coerce.number().int().min(1).max(42).default(42),
})

export const GET = withErrorHandling(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params
    const query = validateQuery(request, QuerySchema)
    if (query.error) return query.error
    const response = ok(await getCalendar(id, query.data.from, query.data.days))
    response.headers.set('Cache-Control', 'no-store')
    return response
  }
)
