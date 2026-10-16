/**
 * GET /api/v1/onboarding/stripe-connect/return — E09-04. Where Stripe sends
 * the manager back. A browser redirect, not JSON: details submitted → the
 * "under review" page; abandoned → the resume page.
 *
 * The company is the signed-in manager's own, never one named in the URL,
 * so nobody can complete another venue's onboarding.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@/auth'
import { finishConnect } from '@/lib/onboarding/connect'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const session = await auth()
  const to = (path: string) => NextResponse.redirect(new URL(path, request.url))
  if (!session?.user) return to(`/login?callbackUrl=${encodeURIComponent('/onboarding')}`)
  if (session.user.role !== 'MANAGER') return to('/discover')
  return to(await finishConnect(session.user.id))
}
