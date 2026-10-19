/**
 * Provider-agnostic payments — E05. Booking code depends on this interface,
 * never on Stripe directly, the same way email and SMS work (E02-08).
 */
import 'server-only'
import type { PaymentProviderName } from '@pitchup/shared'

export interface PaymentRequest {
  bookingId: string
  userId: string
  /** What the player pays, in RON. */
  amountRon: number
  description: string
  /** The player's Stripe customer, so a card can be saved and reused. */
  customerId: string | null
  /** A saved card to charge. */
  paymentMethodId?: string | undefined
  /** Keep the card on the player's Stripe customer (Fair and Poor tiers must, E12-06). */
  saveCard?: boolean | undefined
}

export interface CreatedPayment {
  /** The provider's payment id, stored on the booking. */
  id: string
  /** For the client to confirm with Stripe; null in test mode. */
  clientSecret: string | null
}

export type PaymentState =
  | { status: 'succeeded'; amountRon: number }
  | { status: 'failed'; message: string }
  | { status: 'pending' }

export interface PaymentProvider {
  readonly name: PaymentProviderName
  createPayment(request: PaymentRequest): Promise<CreatedPayment>
  /** Where a payment stands now; lets the app catch up without waiting for a webhook. */
  paymentState(paymentId: string): Promise<PaymentState>
  /** Cancels a payment nobody will complete (a superseded checkout). Best effort. */
  cancelPayment(paymentId: string): Promise<void>
  refund(paymentId: string, amountRon?: number): Promise<{ refundId: string }>
  /** The card that paid, if the provider knows it. */
  cardDetails(paymentId: string): Promise<{ brand: string; last4: string } | null>
}
