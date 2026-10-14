/**
 * Route-level auth helpers — ticket E01-08.
 *
 * API routes return JSON 401/403 rather than redirecting: the mobile client
 * cannot follow a redirect to a login page.
 */
import type { NextRequest, NextResponse } from 'next/server'
import type { Role } from '@prisma/client'
import type { Session } from 'next-auth'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { ACCESS_TOKEN_TTL_SECONDS, bearerFromHeader, verifyAccessToken } from '@/lib/auth/tokens'
import { err } from './response'

export type AuthedHandler = (request: NextRequest, session: Session) => Promise<NextResponse>

/**
 * The mobile app's session: a Bearer access token (E02-08), turned into the
 * same Session shape the web cookie gives, so handlers serve both clients
 * without knowing which one called. The user is re-read so a deleted
 * account's still-unexpired token stops working at once.
 */
async function sessionFromBearer(request: NextRequest): Promise<Session | null> {
  const token = bearerFromHeader(request.headers.get('authorization'))
  if (!token) return null
  const claims = await verifyAccessToken(token)
  if (!claims) return null
  const user = await prisma.user.findUnique({
    where: { id: claims.userId },
    select: { id: true, email: true, name: true, role: true, deletedAt: true },
  })
  if (!user || user.deletedAt) return null
  return {
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    expires: new Date(Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000).toISOString(),
  }
}

/**
 * Wraps a handler so it only runs with a valid session: a Bearer token from
 * the mobile app, or the web's NextAuth cookie. Until E04 only the cookie was
 * checked, so every authenticated call from the app — /me included — was a 401.
 */
export function requireAuth(handler: AuthedHandler) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const hasBearer = !!request.headers.get('authorization')
    // A request that presents a token is judged on that token alone.
    const session = hasBearer ? await sessionFromBearer(request) : await auth()
    if (!session?.user) {
      return err('UNAUTHORIZED', 'Authentication required', 401)
    }
    return handler(request, session)
  }
}

/**
 * Wraps a handler so it only runs for the given roles. ADMIN passes every
 * check, and MANAGER satisfies a PLAYER requirement — PRD §6.4 says a manager
 * account also has player capabilities.
 */
export function requireRole(...roles: Role[]) {
  return (handler: AuthedHandler) =>
    requireAuth(async (request, session) => {
      const userRole = session.user.role

      const satisfied =
        userRole === 'ADMIN' ||
        roles.includes(userRole) ||
        (roles.includes('PLAYER') && userRole === 'MANAGER')

      if (!satisfied) {
        return err('FORBIDDEN', 'Insufficient permissions', 403)
      }
      return handler(request, session)
    })
}
