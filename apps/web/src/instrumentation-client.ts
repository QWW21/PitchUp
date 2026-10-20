/**
 * Error monitoring in the browser — Sentry, the same switch as the server
 * (instrumentation.ts): nothing is sent without NEXT_PUBLIC_SENTRY_DSN.
 */
import * as Sentry from '@sentry/nextjs'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,
    sendDefaultPii: false,
    tracesSampleRate: 0,
  })
}
