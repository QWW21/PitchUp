/**
 * /api/v1/admin/users/:id — E15-03. Admins only.
 *
 * - GET: the user, their bookings and latest trust changes.
 * - PUT { suspended?, suspensionReason?, trustScoreAdjust?, trustAdjustReason? }:
 *   suspend (with a reason; never yourself) or reinstate, and/or adjust the
 *   trust score (−100…100, not 0, with a reason).
 * - DELETE { reason }: close a player's account (bookings refunded).
 */
import type { NextRequest } from 'next/server'
import { AdminDeleteUserSchema, AdminUserUpdateSchema } from '@pitchup/shared'
import { ok, withErrorHandling } from '@/lib/api/response'
import { requireRole } from '@/lib/api/middleware'
import { validateBody } from '@/lib/api/validate'
import { adminDeleteUser, updateUser, userDetail } from '@/lib/admin/users'

export const dynamic = 'force-dynamic'

const idOf = (request: NextRequest) => request.nextUrl.pathname.split('/').at(-1) ?? ''

export const GET = withErrorHandling(
  requireRole('ADMIN')(async (request: NextRequest) => ok(await userDetail(idOf(request))))
)

export const PUT = withErrorHandling(
  requireRole('ADMIN')(async (request: NextRequest, session) => {
    const body = await validateBody(request, AdminUserUpdateSchema)
    if (body.error) return body.error
    return ok(await updateUser(session.user.id, idOf(request), body.data))
  })
)

export const DELETE = withErrorHandling(
  requireRole('ADMIN')(async (request: NextRequest) => {
    const body = await validateBody(request, AdminDeleteUserSchema)
    if (body.error) return body.error
    await adminDeleteUser(idOf(request), body.data.reason)
    return ok({ deleted: true })
  })
)
