/**
 * Maintenance mode — E15-05. While an admin has it on, everyone but admins
 * gets the maintenance message: pages show it (the root layout), the API
 * answers 503 MAINTENANCE (withErrorHandling). Signing in, the admin area,
 * health checks, cron jobs and Stripe's webhook keep working, so admins can
 * get in and payments in flight still settle.
 */
import 'server-only'
import type { NextRequest } from 'next/server'

const OPEN_PREFIXES = [
  '/login',
  '/admin',
  '/api/auth',
  '/api/v1/auth',
  '/api/v1/admin',
  '/api/v1/health',
  '/api/v1/cron',
  '/api/v1/payments/webhook',
  '/api/v1/dev',
]

/** Paths that stay open during maintenance. */
export const openDuringMaintenance = (pathname: string): boolean =>
  OPEN_PREFIXES.some(p => pathname === p || pathname.startsWith(`${p}/`))

/** The message to show, or null when this request may go ahead. */
export async function maintenanceMessage(
  pathname: string,
  isAdmin: () => Promise<boolean>
): Promise<string | null> {
  if (openDuringMaintenance(pathname)) return null
  // Imported here so code that never meets a request (unit tests) doesn't load the cache.
  const { platformConfig } = await import('@/lib/admin/config')
  const config = await platformConfig()
  if (!config.maintenanceMode) return null
  return (await isAdmin()) ? null : config.maintenanceMessage
}

/** For the API: whether the caller (cookie or Bearer) is an admin. */
export async function requestIsAdmin(request: NextRequest): Promise<boolean> {
  const { sessionFor } = await import('@/lib/api/middleware')
  return (await sessionFor(request))?.user.role === 'ADMIN'
}
