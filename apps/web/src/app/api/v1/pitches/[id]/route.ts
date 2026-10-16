/**
 * GET /api/v1/pitches/:id — E04-02. Public.
 * PUT (basic info, partial) and DELETE (soft) — E10-01, E10-05: the venue's
 * manager only.
 * 404 when the pitch's company is not approved. An inactive pitch is still
 * returned (direct links) with `isBookable: false`.
 */
import type { NextRequest } from 'next/server'
import { err, ok, withErrorHandling } from '@/lib/api/response'
import { UpdatePitchBasicInfoSchema } from '@pitchup/shared'
import { validateBody } from '@/lib/api/validate'
import { getPitchDetail } from '@/lib/venues/pitch'
import { deletePitch, updateBasicInfo } from '@/lib/manager/pitches'
import { pitchRoute } from '@/lib/manager/pitch-route'

export const dynamic = 'force-dynamic'

export const GET = withErrorHandling(
  async (_request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params
    const pitch = await getPitchDetail(id)
    if (!pitch) return err('NOT_FOUND', 'Pitch not found', 404)
    return ok(pitch)
  }
)

export const PUT = pitchRoute(async (request, company, { id }) => {
  const body = await validateBody(request, UpdatePitchBasicInfoSchema)
  if (body.error) return body.error
  return ok(await updateBasicInfo(company.id, id!, body.data))
})

/** 409 HAS_BOOKINGS while bookings are still to be played. */
export const DELETE = pitchRoute(async (_request, company, { id }) => {
  await deletePitch(company.id, id!)
  return ok({ deleted: true })
})
