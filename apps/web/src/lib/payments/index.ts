/**
 * Which payment provider is in use — E05.
 *
 * Stripe when all three keys are set. Otherwise the built-in test payments,
 * but only in development or with ALLOW_TEST_HOOKS=1 (the E2E server): a
 * real deployment without Stripe keys takes no bookings rather than
 * "taking" free ones.
 */
import 'server-only'
import type { PaymentConfig } from '@pitchup/shared'
import { env } from '@/lib/env'
import { isStripeConfigured, stripeProvider } from './stripe'
import { testProvider } from './test-provider'
import type { PaymentProvider } from './types'

export function testPaymentsAllowed(): boolean {
  return env.NODE_ENV === 'development' || env.ALLOW_TEST_HOOKS === '1'
}

export function getPaymentProvider(): PaymentProvider | null {
  if (isStripeConfigured()) return stripeProvider
  return testPaymentsAllowed() ? testProvider : null
}

/** Provider by name, for a booking made under it. */
export function providerFor(name: string | null): PaymentProvider | null {
  if (name === 'stripe') return isStripeConfigured() ? stripeProvider : null
  if (name === 'test') return testProvider
  return null
}

export function paymentConfig(): PaymentConfig {
  const provider = getPaymentProvider()
  return {
    provider: provider?.name ?? null,
    publishableKey:
      provider?.name === 'stripe' ? (env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? null) : null,
  }
}

export type { PaymentProvider } from './types'
