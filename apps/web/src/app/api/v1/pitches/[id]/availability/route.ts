/**
 * GET /api/v1/pitches/:id/availability?date=YYYY-MM-DD — E04-03. Public.
 * 30-minute slots in venue time: available, booked, or past (earlier today).
 *
 * PUT — E10-04: the pitch's own week, inside the venue's hours (400
 * OUTSIDE_VENUE_HOURS with the days that don't fit). The venue's manager only.
 */
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { err, ok, withErrorHandling } from '@/lib/api/response'
import { PitchHoursSchema } from '@pitchup/shared'
import { validateBody } from '@/lib/api/validate'
import { getAvailability } from '@/lib/venues/availability'
import { setHours } from '@/lib/manager/pitches'
import { pitchRoute } from '@/lib/manager/pitch-route'

export const dynamic = 'force-dynamic'

const DateSchema = z
  .string({ required_error: 'date is required' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD')
  // Rejects 2026-02-31, which the pattern alone lets through. Zod still runs
  // this after the regex fails, so it must not throw on garbage either.
  .refine(d => {
    const t = new Date(`${d}T00:00:00Z`)
    return !Number.isNaN(t.getTime()) && t.toISOString().startsWith(d)
  }, 'date is not a real date')

export const GET = withErrorHandling(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params
    const parsed = DateSchema.safeParse(request.nextUrl.searchParams.get('date') ?? undefined)
    if (!parsed.success) {
      return err('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid date', 400)
    }

    const response = ok(await getAvailability(id, parsed.data))
    // Short: a booking made elsewhere should show up within the minute.
    response.headers.set('Cache-Control', 'public, max-age=60')
    return response
  }
)

export const PUT = pitchRoute(async (request, company, { id }) => {
  const body = await validateBody(request, PitchHoursSchema)
  if (body.error) return body.error
  return ok(await setHours(company.id, id!, body.data))
})
