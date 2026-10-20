/**
 * Standard response envelope — ticket E01-08.
 *
 * Every API route returns { data, error } so the client can check one field
 * rather than inferring success from the shape of the payload.
 */
import { NextResponse, type NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { ApiException, ERROR_CODES, type ErrorCode } from './errors'
import { webT, type WebKey, type WebT } from '@/i18n/catalog'
import { getLocale } from '@/i18n/server'

export interface ApiSuccess<T> {
  data: T
  error: null
  meta?: Record<string, unknown>
}

export interface ApiErrorBody {
  data: null
  error: {
    code: ErrorCode
    message: string
    details?: unknown
  }
}

export function ok<T>(
  data: T,
  meta?: Record<string, unknown>,
  status = 200
): NextResponse<ApiSuccess<T>> {
  const body: ApiSuccess<T> = meta ? { data, error: null, meta } : { data, error: null }
  return NextResponse.json(body, { status })
}

/** 201 for a route that created something. */
export function created<T>(data: T, meta?: Record<string, unknown>): NextResponse<ApiSuccess<T>> {
  return ok(data, meta, 201)
}

/**
 * An error response. `message` may be a catalog key, translated (with
 * `params`) by withErrorHandling into the request's language.
 */
export function err(
  code: ErrorCode,
  message: string,
  status?: number,
  details?: unknown,
  params?: Record<string, string | number>
): NextResponse<ApiErrorBody> {
  const error: ApiErrorBody['error'] & { params?: Record<string, string | number> } =
    details === undefined ? { code, message } : { code, message, details }
  if (params) error.params = params
  return NextResponse.json({ data: null, error }, { status: status ?? ERROR_CODES[code] })
}

/** Turns a thrown ApiException back into the standard envelope. */
export function errFromException(exception: ApiException): NextResponse<ApiErrorBody> {
  return err(
    exception.code,
    exception.message,
    exception.status,
    exception.details,
    exception.params
  )
}

/** A message that is a catalog key, in the language; anything else as it is. */
function translateMessage(t: WebT, message: unknown, params?: Record<string, string | number>) {
  return typeof message === 'string' && t.has(message) ? t(message as WebKey, params) : message
}

/**
 * Error responses leave in the request's language: the message, and the
 * per-field messages of a validation error, are translated when they are
 * catalog keys. Success responses pass untouched.
 */
async function localise(response: NextResponse): Promise<NextResponse> {
  if (response.status < 400 || !response.headers.get('content-type')?.includes('json')) {
    return response
  }
  const body = await response
    .clone()
    .json()
    .catch(() => null)
  const error = body?.error
  if (!error || typeof error.message !== 'string') return response
  const t = webT(await getLocale())
  const { params, ...rest } = error
  const details = rest.details
  if (details && typeof details === 'object') {
    if (Array.isArray(details.formErrors)) {
      details.formErrors = details.formErrors.map((m: unknown) => translateMessage(t, m))
    }
    if (details.fieldErrors && typeof details.fieldErrors === 'object') {
      for (const [field, messages] of Object.entries(details.fieldErrors)) {
        if (Array.isArray(messages)) {
          details.fieldErrors[field] = messages.map((m: unknown) => translateMessage(t, m))
        }
      }
    }
  }
  const localised = { ...rest, message: translateMessage(t, rest.message, params) }
  // A fresh body: the old length no longer applies.
  const headers = new Headers(response.headers)
  headers.delete('content-length')
  return NextResponse.json({ ...body, error: localised }, { status: response.status, headers })
}

/**
 * Maintenance mode's 503, or null. A failure to read the setting lets the
 * request through rather than taking the API down with it.
 */
async function maintenanceBlock(arg: unknown): Promise<NextResponse<ApiErrorBody> | null> {
  const request = arg as NextRequest | undefined
  if (!request?.nextUrl) return null
  try {
    const { maintenanceMessage, requestIsAdmin } = await import('@/lib/maintenance')
    const message = await maintenanceMessage(request.nextUrl.pathname, () =>
      requestIsAdmin(request)
    )
    return message ? err('SERVICE_UNAVAILABLE', message, 503, { reason: 'MAINTENANCE' }) : null
  } catch (caught) {
    console.error('[maintenance] Could not read the setting:', caught)
    return null
  }
}

/**
 * Wraps a route handler so an unexpected throw becomes a 500 in the standard
 * shape instead of Next's HTML error page. Internal messages are never
 * forwarded to the client — they go to the server log.
 */
export function withErrorHandling<TArgs extends unknown[]>(
  handler: (...args: TArgs) => Promise<NextResponse>
): (...args: TArgs) => Promise<NextResponse> {
  return async (...args: TArgs) => {
    try {
      // E15: maintenance mode answers 503 to everyone but admins.
      const blocked = await maintenanceBlock(args[0])
      if (blocked) return blocked
      return await localise(await handler(...args))
    } catch (caught) {
      if (caught instanceof ApiException) return localise(errFromException(caught))
      console.error('Unhandled API error:', caught)
      // Answered as a plain 500, so Next never sees it: report it here.
      Sentry.captureException(caught)
      return localise(err('INTERNAL_ERROR', 'api.internal'))
    }
  }
}
