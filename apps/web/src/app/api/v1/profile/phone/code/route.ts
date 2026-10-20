/**
 * POST /api/v1/profile/phone/code — #163. Texts a verification code to the
 * signed-in person's own number.
 * 200 sent · 409 ALREADY_VERIFIED · 429 when the number has had its texts.
 */
import { ok, err, withErrorHandling } from '@/lib/api/response'
import { requireAuth } from '@/lib/api/middleware'
import { RecipientThrottledError, sendOwnPhoneCode } from '@/lib/auth/service'

export const dynamic = 'force-dynamic'

export const POST = withErrorHandling(
  requireAuth(async (_request, session) => {
    try {
      const outcome = await sendOwnPhoneCode(session.user.id)
      if (outcome === 'ALREADY_VERIFIED') {
        return err('CONFLICT', 'api.phoneVerified', 409, {
          reason: 'ALREADY_VERIFIED',
        })
      }
    } catch (caught) {
      if (caught instanceof RecipientThrottledError) {
        return err('RATE_LIMITED', 'api.tooManyCodes', 429, {
          retryAfterSeconds: caught.retryAfterSeconds,
        })
      }
      // The person knows it's their own number, so a failed send is said
      // plainly rather than hidden as on the public resend route.
      console.error('[profile] Could not text a phone code:', caught)
      return err('SERVICE_UNAVAILABLE', 'api.smsFailed', 503)
    }
    return ok({ sent: true })
  })
)
