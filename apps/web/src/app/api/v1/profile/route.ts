/**
 * The signed-in user's profile — E08-01, E08-03.
 *
 * GET    → Profile (never the password hash, Stripe id or tokens)
 * PUT    { name?, phone?, city?, avatarUrl? } → Profile · 400 · 409 PHONE_TAKEN
 *        Email and role cannot be changed here. A new phone must be verified again.
 * DELETE { password, reason? } → 200 · 400 WRONG_PASSWORD / NOT_A_PLAYER · 429
 *        Anonymises the account; upcoming bookings are cancelled and refunded in full.
 */
import type { NextRequest } from 'next/server'
import { DeleteAccountSchema, UpdateProfileSchema } from '@pitchup/shared'
import { ok, withErrorHandling } from '@/lib/api/response'
import { requireAuth } from '@/lib/api/middleware'
import { validateBody } from '@/lib/api/validate'
import { deleteAccount, getProfile, updateProfile } from '@/lib/profile/account'
import { passwordAttemptLimit } from '@/lib/profile/guard'

export const dynamic = 'force-dynamic'

export const GET = withErrorHandling(
  requireAuth(async (_request, session) => ok(await getProfile(session.user.id)))
)

export const PUT = withErrorHandling(
  requireAuth(async (request: NextRequest, session) => {
    const parsed = await validateBody(request, UpdateProfileSchema)
    if (parsed.error) return parsed.error
    return ok(await updateProfile(session.user.id, parsed.data))
  })
)

export const DELETE = withErrorHandling(
  requireAuth(async (request: NextRequest, session) => {
    const parsed = await validateBody(request, DeleteAccountSchema)
    if (parsed.error) return parsed.error
    const limited = passwordAttemptLimit(session.user.id)
    if (limited) return limited
    await deleteAccount(session.user, parsed.data)
    return ok({ message: 'Your account has been deleted.' })
  })
)
