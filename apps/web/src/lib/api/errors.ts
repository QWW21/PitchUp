/**
 * Typed API errors — ticket E01-08.
 *
 * Every error the API returns carries one of these codes, so the mobile
 * client can branch on a stable string rather than on a status code alone.
 */

export const ERROR_CODES = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 400,
  CONFLICT: 409,
  PAYMENT_REQUIRED: 402,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
} as const

export type ErrorCode = keyof typeof ERROR_CODES

export class ApiException extends Error {
  readonly code: ErrorCode
  readonly status: number
  readonly details: unknown

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiException'
    this.code = code
    this.status = ERROR_CODES[code]
    this.details = details
  }
}

export const unauthorized = (message = 'Authentication required') =>
  new ApiException('UNAUTHORIZED', message)

export const forbidden = (message = 'Insufficient permissions') =>
  new ApiException('FORBIDDEN', message)

export const notFound = (message = 'Resource not found') => new ApiException('NOT_FOUND', message)

export const conflict = (message: string, details?: unknown) =>
  new ApiException('CONFLICT', message, details)

export const validationError = (message = 'Invalid request body', details?: unknown) =>
  new ApiException('VALIDATION_ERROR', message, details)

export const rateLimited = (message = 'Too many requests') =>
  new ApiException('RATE_LIMITED', message)

export const internalError = (message = 'Something went wrong') =>
  new ApiException('INTERNAL_ERROR', message)
