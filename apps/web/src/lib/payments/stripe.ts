/**
 * Stripe — E05-07, E05-08, E05-09. Server-only: the secret key must never
 * reach a client bundle (checked by e2e/api/infra.spec.ts).
 *
 * Amounts: Stripe counts in the currency's minor unit (bani for RON), so
 * 240 RON is 24000. Every conversion goes through toBani.
 */
import 'server-only'
import Stripe from 'stripe'
import type { SavedCard } from '@pitchup/shared'
import { env } from '@/lib/env'
import { prisma } from '@/lib/prisma'
import type { PaymentProvider } from './types'

/** All three keys, or Stripe is treated as not set up. */
export function isStripeConfigured(): boolean {
  return Boolean(
    env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET && env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  )
}

let client: Stripe | null = null

/** The SDK, created on first use with the key from the environment. */
export function stripe(): Stripe {
  if (!env.STRIPE_SECRET_KEY) throw new Error('Stripe is not configured')
  client ??= new Stripe(env.STRIPE_SECRET_KEY)
  return client
}

/** Test hook: lets unit tests hand in a fake SDK. */
export function setStripeClientForTests(fake: Stripe | null): void {
  client = fake
}

export const toBani = (ron: number): number => Math.round(ron * 100)

export const stripeProvider: PaymentProvider = {
  name: 'stripe',

  async createPayment({ bookingId, userId, amountRon, description, customerId, paymentMethodId }) {
    const intent = await stripe().paymentIntents.create(
      {
        amount: toBani(amountRon),
        currency: 'ron',
        payment_method_types: ['card'],
        description,
        // The webhook finds the booking from this.
        metadata: { bookingId, userId },
        ...(customerId ? { customer: customerId } : {}),
        ...(paymentMethodId ? { payment_method: paymentMethodId } : {}),
      },
      // A retried request for the same booking never makes a second charge.
      { idempotencyKey: `booking-${bookingId}` }
    )
    if (!intent.client_secret) throw new Error('Stripe returned no client secret')
    return { id: intent.id, clientSecret: intent.client_secret }
  },

  async paymentState(paymentId) {
    const intent = await stripe().paymentIntents.retrieve(paymentId)
    if (intent.status === 'succeeded')
      return { status: 'succeeded', amountRon: intent.amount / 100 }
    if (intent.status === 'canceled') return { status: 'failed', message: 'Payment cancelled' }
    if (intent.status === 'requires_payment_method' && intent.last_payment_error) {
      return { status: 'failed', message: intent.last_payment_error.message ?? 'Payment failed' }
    }
    return { status: 'pending' }
  },

  async cancelPayment(paymentId) {
    await stripe()
      .paymentIntents.cancel(paymentId)
      .catch(() => undefined)
  },

  async cardDetails(paymentId) {
    const intent = await stripe().paymentIntents.retrieve(paymentId, {
      expand: ['latest_charge'],
    })
    const charge = intent.latest_charge
    const card = typeof charge === 'object' ? charge?.payment_method_details?.card : null
    return card ? { brand: card.brand ?? 'card', last4: card.last4 ?? '' } : null
  },

  async refund(paymentId, amountRon) {
    const refund = await stripe().refunds.create({
      payment_intent: paymentId,
      ...(amountRon !== undefined ? { amount: toBani(amountRon) } : {}),
    })
    return { refundId: refund.id }
  },
}

/**
 * The player's Stripe customer, created the first time it is needed. The
 * idempotency key makes two concurrent first bookings create one customer.
 */
export async function getOrCreateCustomer(userId: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true, name: true, stripeCustomerId: true },
  })
  if (user.stripeCustomerId) return user.stripeCustomerId

  const customer = await stripe().customers.create(
    { email: user.email, name: user.name, metadata: { userId } },
    { idempotencyKey: `customer-${userId}` }
  )
  await prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: customer.id } })
  return customer.id
}

export async function listCards(customerId: string): Promise<SavedCard[]> {
  const methods = await stripe().paymentMethods.list({ customer: customerId, type: 'card' })
  return methods.data.flatMap(pm =>
    pm.card
      ? [
          {
            id: pm.id,
            brand: pm.card.brand,
            last4: pm.card.last4,
            expMonth: pm.card.exp_month,
            expYear: pm.card.exp_year,
          },
        ]
      : []
  )
}

export async function createSetupIntent(customerId: string): Promise<string> {
  const intent = await stripe().setupIntents.create({
    customer: customerId,
    usage: 'off_session',
    payment_method_types: ['card'],
  })
  if (!intent.client_secret) throw new Error('Stripe returned no client secret')
  return intent.client_secret
}

/**
 * Detaches a card, but only one that belongs to this customer: card ids are
 * guessable enough that trusting the id alone would let one player remove
 * another's card. Returns false when it is not theirs.
 */
export async function detachCard(customerId: string, paymentMethodId: string): Promise<boolean> {
  const cards = await listCards(customerId)
  if (!cards.some(c => c.id === paymentMethodId)) return false
  await stripe().paymentMethods.detach(paymentMethodId)
  return true
}

/** Verifies a webhook's signature against the raw body. Throws when it does not match. */
export function constructWebhookEvent(rawBody: string, signature: string): Stripe.Event {
  if (!env.STRIPE_WEBHOOK_SECRET) throw new Error('Stripe webhooks are not configured')
  return stripe().webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET)
}
