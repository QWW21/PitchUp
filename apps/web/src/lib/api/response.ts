/**
 * Standard response envelope — ticket E01-08.
 *
 * Every API route returns { data, error } so the client can check one field
 * rather than inferring success from the shape of the payload.
 */
import { NextResponse } from 'next/server'
import { ApiException, ERROR_CODES, type ErrorCode } from './errors'

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

export function ok<T>(data: T, meta?: Record<string, unknown>): NextResponse<ApiSuccess<T>> {
  const body: ApiSuccess<T> = meta ? { data, error: null, meta } : { data, error: null }
  return NextResponse.json(body)
}

export function err(
  code: ErrorCode,
  message: string,
  status?: number,
  details?: unknown
): NextResponse<ApiErrorBody> {
  const error: ApiErrorBody['error'] =
    details === undefined ? { code, message } : { code, message, details }
  return NextResponse.json({ data: null, error }, { status: status ?? ERROR_CODES[code] })
}

/** Turns a thrown ApiException back into the standard envelope. */
export function errFromException(exception: ApiException): NextResponse<ApiErrorBody> {
  return err(exception.code, exception.message, exception.status, exception.details)
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
      return await handler(...args)
    } catch (caught) {
      if (caught instanceof ApiException) return errFromException(caught)
      console.error('Unhandled API error:', caught)
      return err('INTERNAL_ERROR', 'Something went wrong')
    }
  }
}
