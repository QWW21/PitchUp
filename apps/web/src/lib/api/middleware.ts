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
import { err } from './response'

export type AuthedHandler = (request: NextRequest, session: Session) => Promise<NextResponse>

/** Wraps a handler so it only runs with a valid session. */
export function requireAuth(handler: AuthedHandler) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const session = await auth()
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
