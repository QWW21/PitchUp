/**
 * GET /api/v1/companies — E03-01. Public: browsing needs no account.
 *
 * Query: city (required), search, sort=distance|rating|price|newest, lat+lng,
 * surface*, size*, amenities* (* repeatable: surface=FUTSAL&surface=NATURAL_GRASS),
 * priceMin, priceMax, availableNow, openNow, cursor, limit (default 20, max 50).
 *
 * Returns { companies, nextCursor, total }. See CompanyListQuerySchema and
 * CompanyListItem in @pitchup/shared for the exact contract.
 */
import type { NextRequest } from 'next/server'
import { CompanyListQuerySchema } from '@pitchup/shared'
import { err, ok, withErrorHandling } from '@/lib/api/response'
import { listCompanies } from '@/lib/discover/companies'

export const dynamic = 'force-dynamic'

const REPEATABLE = ['surface', 'size', 'amenities'] as const

export const GET = withErrorHandling(async (request: NextRequest) => {
  const params = request.nextUrl.searchParams
  // validateQuery() keeps only the last value of a repeated key, so the
  // multi-value filters are collected here instead.
  const raw: Record<string, unknown> = Object.fromEntries(params.entries())
  for (const key of REPEATABLE) raw[key] = params.getAll(key)

  const parsed = CompanyListQuerySchema.safeParse(raw)
  if (!parsed.success) {
    // The first problem as the message ("City is required"), all of them in details.
    const message = parsed.error.issues[0]?.message ?? 'Invalid query parameters'
    return err('VALIDATION_ERROR', message, 400, parsed.error.flatten())
  }

  return ok(await listCompanies(parsed.data))
})
