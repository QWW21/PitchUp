/**
 * Error monitoring — Sentry (pitchup-mobile). Crashes and unhandled errors
 * from release builds only: development errors are on screen already. Off
 * until SENTRY_DSN is filled in (config.ts). No personal data is sent.
 */
import * as Sentry from '@sentry/react-native'
import { SENTRY_DSN } from '../config'

export const monitoringEnabled = Boolean(SENTRY_DSN) && !__DEV__

export function startMonitoring(): void {
  if (!monitoringEnabled) return
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: 'production',
    sendDefaultPii: false,
    tracesSampleRate: 0,
  })
}

/** Wraps the root component so render crashes are reported too. */
export const withMonitoring = (App: React.ComponentType<Record<string, unknown>>) =>
  monitoringEnabled ? Sentry.wrap(App) : App
