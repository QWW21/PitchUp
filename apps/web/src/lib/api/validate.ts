/**
 * Request validation — ticket E01-08.
 */
import type { NextRequest } from 'next/server'
import type { NextResponse } from 'next/server'
import type { ZodSchema } from 'zod'
import { err } from './response'

export type ValidationResult<T> = { data: T; error?: never } | { data?: never; error: NextResponse }

/** Parses and validates a JSON body. A malformed body is a validation error, not a crash. */
export async function validateBody<T>(
  request: NextRequest,
  schema: ZodSchema<T>
): Promise<ValidationResult<T>> {
  const body = await request.json().catch(() => null)
  const result = schema.safeParse(body)

  if (!result.success) {
    return {
      error: err('VALIDATION_ERROR', 'Invalid request body', 400, result.error.flatten()),
    }
  }
  return { data: result.data }
}

/** Same, for query string parameters. */
export function validateQuery<T>(request: NextRequest, schema: ZodSchema<T>): ValidationResult<T> {
  const params = Object.fromEntries(request.nextUrl.searchParams.entries())
  const result = schema.safeParse(params)

  if (!result.success) {
    return {
      error: err('VALIDATION_ERROR', 'Invalid query parameters', 400, result.error.flatten()),
    }
  }
  return { data: result.data }
}
