/**
 * POST /api/v1/profile/change-password { currentPassword, newPassword } — E08-03.
 * 200 and every session ends (sign in again) · 400 WRONG_PASSWORD or a weak
 * new password · 429 after 5 tries in 15 minutes.
 */
import type { NextRequest } from 'next/server'
import { ChangeOwnPasswordSchema } from '@pitchup/shared'
import { ok, withErrorHandling } from '@/lib/api/response'
import { requireAuth } from '@/lib/api/middleware'
import { validateBody } from '@/lib/api/validate'
import { changePassword } from '@/lib/profile/account'
import { passwordAttemptLimit } from '@/lib/profile/guard'

export const dynamic = 'force-dynamic'

export const POST = withErrorHandling(
  requireAuth(async (request: NextRequest, session) => {
    const parsed = await validateBody(request, ChangeOwnPasswordSchema)
    if (parsed.error) return parsed.error
    const limited = passwordAttemptLimit(session.user.id)
    if (limited) return limited
    await changePassword(session.user.id, parsed.data)
    return ok({ message: 'Password changed. Please sign in again.' })
  })
)
