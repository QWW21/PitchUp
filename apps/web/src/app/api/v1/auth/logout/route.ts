import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { ok, withErrorHandling } from '@/lib/api/response'
import { validateBody } from '@/lib/api/validate'
import { revokeRefreshToken } from '@/lib/auth/service'

export const dynamic = 'force-dynamic'

const LogoutSchema = z.object({ refreshToken: z.string().min(1) })

/**
 * No auth required, deliberately. A client whose access token has already
 * expired still needs to be able to revoke its refresh token, and presenting
 * the token is itself the proof of possession.
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const parsed = await validateBody(request, LogoutSchema)
  if (parsed.error) return parsed.error

  await revokeRefreshToken(parsed.data.refreshToken)

  // Always the same answer, whether or not the token existed, so logout
  // cannot be used to test tokens.
  return ok({ message: 'Logged out' })
})
