/**
 * Edge middleware — ticket E01-09.
 *
 * Only guards page routes. API routes authenticate per-route via
 * requireAuth/requireRole in lib/api/middleware.ts, so they can return a JSON
 * 401 instead of a redirect the mobile client cannot follow.
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PROTECTED_PREFIXES = ['/dashboard', '/admin', '/bookings', '/profile']

/**
 * Presence check only — the cookie is not verified here. Middleware runs on
 * the Edge runtime, where the Prisma adapter cannot load. The page itself
 * calls auth() and is the real gate; this just avoids a flash of a protected
 * page for an obviously-signed-out visitor.
 */
function hasSessionCookie(request: NextRequest): boolean {
  return (
    request.cookies.has('authjs.session-token') ||
    request.cookies.has('__Secure-authjs.session-token')
  )
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl

  const isProtected = PROTECTED_PREFIXES.some(
    prefix => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )

  if (isProtected && !hasSessionCookie(request)) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*', '/bookings/:path*', '/profile/:path*'],
}
