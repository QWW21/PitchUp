/**
 * Stripe Billing for venue subscriptions — C-15. The venue is its own Stripe
 * customer (not its manager's player customer). One Product, created on
 * first use; each subscription has one item priced inline at what the venue
 * owes, since the price depends on its year and its active pitches.
 *
 * API version "basil" (stripe 18): periods are on the subscription's items,
 * and an invoice's payment is confirmed through its `confirmation_secret`.
 */
import 'server-only'
import type Stripe from 'stripe'
import type { BillingInterval } from '@pitchup/shared'
import { prisma } from '@/lib/prisma'
import { stripe, toBani } from '@/lib/payments/stripe'

const recurring = (interval: BillingInterval) =>
  ({ interval: interval === 'YEARLY' ? 'year' : 'month' }) as const

async function productId(): Promise<string> {
  const config = await prisma.platformConfig.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton' },
    update: {},
    select: { stripeBillingProductId: true },
  })
  if (config.stripeBillingProductId) return config.stripeBillingProductId
  const product = await stripe().products.create(
    { name: 'PitchUp subscription' },
    { idempotencyKey: 'pitchup-billing-product' }
  )
  await prisma.platformConfig.update({
    where: { id: 'singleton' },
    data: { stripeBillingProductId: product.id },
  })
  return product.id
}

async function customerId(companyId: string): Promise<string> {
  const c = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    select: { name: true, email: true, stripeCustomerId: true },
  })
  if (c.stripeCustomerId) return c.stripeCustomerId
  const customer = await stripe().customers.create(
    { name: c.name, ...(c.email ? { email: c.email } : {}), metadata: { companyId } },
    { idempotencyKey: `venue-customer-${companyId}` }
  )
  await prisma.company.update({
    where: { id: companyId },
    data: { stripeCustomerId: customer.id },
  })
  return customer.id
}

/**
 * Starts the subscription, waiting for the card: with a trial Stripe asks
 * for it through a SetupIntent, otherwise through the first invoice's
 * payment. Returns the subscription id and the secret the card form needs.
 */
export async function createStripeSubscription(opts: {
  companyId: string
  interval: BillingInterval
  amountRon: number
  trialDays: number | null
}): Promise<{ subscriptionId: string; clientSecret: string }> {
  const sub = await stripe().subscriptions.create({
    customer: await customerId(opts.companyId),
    items: [
      {
        price_data: {
          currency: 'ron',
          product: await productId(),
          unit_amount: toBani(opts.amountRon),
          recurring: recurring(opts.interval),
        },
      },
    ],
    ...(opts.trialDays ? { trial_period_days: opts.trialDays } : {}),
    payment_behavior: 'default_incomplete',
    payment_settings: {
      save_default_payment_method: 'on_subscription',
      payment_method_types: ['card'],
    },
    metadata: { companyId: opts.companyId },
    expand: ['pending_setup_intent', 'latest_invoice.confirmation_secret'],
  })
  const setup = sub.pending_setup_intent
  const invoice = sub.latest_invoice
  const clientSecret =
    (typeof setup === 'object' ? setup?.client_secret : null) ??
    (typeof invoice === 'object' ? invoice?.confirmation_secret?.client_secret : null)
  if (!clientSecret) throw new Error('Stripe returned no client secret')
  return { subscriptionId: sub.id, clientSecret }
}

export async function setCancelAtPeriodEnd(subscriptionId: string, cancel: boolean) {
  await stripe().subscriptions.update(subscriptionId, { cancel_at_period_end: cancel })
}

/** The next bill's amount and interval, without charging anything now. */
export async function repriceStripeSubscription(
  subscriptionId: string,
  interval: BillingInterval,
  amountRon: number
) {
  const sub = await stripe().subscriptions.retrieve(subscriptionId)
  const item = sub.items.data[0]
  if (!item) return
  await stripe().subscriptions.update(subscriptionId, {
    items: [
      {
        id: item.id,
        price_data: {
          currency: 'ron',
          product: await productId(),
          unit_amount: toBani(amountRon),
          recurring: recurring(interval),
        },
      },
    ],
    proration_behavior: 'none',
  })
}

/** When the subscription's current period ends ("basil": on its items). */
export const stripePeriodEnd = (sub: Stripe.Subscription): Date | null => {
  const end = sub.items.data[0]?.current_period_end
  return end ? new Date(end * 1000) : null
}
