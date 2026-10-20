/**
 * POST /api/v1/profile/phone/verify { code } — #163. Confirms the signed-in
 * person's number with the code texted to it. Same answers as
 * /auth/verify-phone: 400 wrong code (with attempts left), 410 expired, 429
 * once the code is used up.
 */
import type { NextRequest } from 'next/server'
import { VerifyOtpSchema } from '@pitchup/shared'
import { ok, err, withErrorHandling } from '@/lib/api/response'
import { requireAuth } from '@/lib/api/middleware'
import { validateBody } from '@/lib/api/validate'
import { verifyPhoneCodeFor } from '@/lib/auth/service'

export const dynamic = 'force-dynamic'

export const POST = withErrorHandling(
  requireAuth(async (request: NextRequest, session) => {
    const parsed = await validateBody(request, VerifyOtpSchema)
    if (parsed.error) return parsed.error

    const result = await verifyPhoneCodeFor(session.user.id, parsed.data.code)
    if ('failure' in result) {
      const detail: Record<string, unknown> = { reason: result.failure }
      if (result.attemptsRemaining !== undefined)
        detail.attemptsRemaining = result.attemptsRemaining
      switch (result.failure) {
        case 'CODE_EXPIRED':
          return err('NOT_FOUND', 'api.codeExpiredSend', 410, detail)
        case 'TOO_MANY_ATTEMPTS':
          return err('RATE_LIMITED', 'api.tooManyWrongSend', 429, detail)
        default:
          return err('VALIDATION_ERROR', 'api.codeWrong', 400, detail)
      }
    }
    return ok({ verified: true })
  })
)
