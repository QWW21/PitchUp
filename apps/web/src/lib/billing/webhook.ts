/**
 * Stripe's word on venue subscriptions — C-15, from the payments webhook.
 * Each handler is idempotent: Stripe retries and may repeat an event.
 */
import 'server-only'
import type Stripe from 'stripe'
import type { SubscriptionStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { recordFailed, recordPaid } from './index'
import { stripePeriodEnd } from './stripe-billing'

/** Stripe's status as ours; null leaves ours as it is (still waiting for the card). */
export function statusFromStripe(sub: Stripe.Subscription): SubscriptionStatus | null {
  if (sub.cancel_at_period_end && (sub.status === 'trialing' || sub.status === 'active')) {
    return 'CANCELLING'
  }
  switch (sub.status) {
    case 'trialing':
      return 'TRIALING'
    case 'active':
      return 'ACTIVE'
    case 'past_due':
    case 'unpaid':
      return 'PAST_DUE'
    case 'canceled':
    case 'paused':
      return 'PAUSED'
    default:
      return null
  }
}

const companyOf = (sub: { metadata: Stripe.Metadata; id: string }) =>
  prisma.company.findFirst({
    where: sub.metadata.companyId
      ? { id: sub.metadata.companyId }
      : { stripeSubscriptionId: sub.id },
  })

export async function syncStripeSubscription(sub: Stripe.Subscription) {
  const company = await companyOf(sub)
  if (!company) return
  const status = statusFromStripe(sub)
  // Payment failures go through invoice.payment_failed, which starts the grace.
  if (status === 'PAST_DUE') return
  await prisma.company.update({
    where: { id: company.id },
    data: {
      stripeSubscriptionId: sub.id,
      subscriptionPeriodEnd: stripePeriodEnd(sub),
      ...(status ? { subscriptionStatus: status } : {}),
    },
  })
}

const subscriptionIdOf = (invoice: Stripe.Invoice) => {
  const sub = invoice.parent?.subscription_details?.subscription
  return typeof sub === 'string' ? sub : (sub?.id ?? null)
}

export async function stripeInvoicePaid(invoice: Stripe.Invoice) {
  const subscriptionId = subscriptionIdOf(invoice)
  // A trial's opening invoice is for nothing.
  if (!subscriptionId || !invoice.id || invoice.amount_paid <= 0) return
  const company = await prisma.company.findUnique({
    where: { stripeSubscriptionId: subscriptionId },
  })
  if (!company) return
  const line = invoice.lines.data[0]
  const start = new Date((line?.period.start ?? invoice.period_start) * 1000)
  const end = new Date((line?.period.end ?? invoice.period_end) * 1000)
  await recordPaid(company.id, {
    interval: company.billingInterval ?? 'MONTHLY',
    amountRon: invoice.amount_paid / 100,
    periodStart: start,
    periodEnd: end,
    stripeInvoiceId: invoice.id,
  })
}

export async function stripeInvoiceFailed(invoice: Stripe.Invoice) {
  const subscriptionId = subscriptionIdOf(invoice)
  if (!subscriptionId) return
  const company = await prisma.company.findUnique({
    where: { stripeSubscriptionId: subscriptionId },
  })
  if (company) await recordFailed(company.id)
}
