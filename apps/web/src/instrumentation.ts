/**
 * Error monitoring on the server (Node and edge) — Sentry. Off until
 * NEXT_PUBLIC_SENTRY_DSN is set, so a fresh clone, CI and the tests send
 * nothing. No personal data: no IPs, cookies or bodies (sendDefaultPii off),
 * and no performance tracing, only errors.
 */
import * as Sentry from '@sentry/nextjs'

export async function register() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
  if (!dsn) return
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,
    sendDefaultPii: false,
    tracesSampleRate: 0,
  })
}

/** Errors thrown while rendering a page or running a route outside withErrorHandling. */
export const onRequestError = Sentry.captureRequestError
