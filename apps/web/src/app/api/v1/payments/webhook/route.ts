/**
 * POST /api/v1/payments/webhook — E05-08. Stripe calls this; no session,
 * authenticated by the signature over the raw body instead.
 *
 * Deviation from the ticket: a handler error answers 500, not 200. Stripe
 * then retries with backoff, and since every handler is idempotent a retry
 * is safe, whereas a 200 would have lost the event for good. A duplicate
 * event (same id) is acknowledged without being handled again.
 */
import { NextResponse, type NextRequest } from 'next/server'
import type Stripe from 'stripe'
import { prisma } from '@/lib/prisma'
import { constructWebhookEvent, isStripeConfigured } from '@/lib/payments/stripe'
import { confirmPaid, markPaymentFailed, recordRefund } from '@/lib/bookings/payment-events'
import {
  stripeInvoiceFailed,
  stripeInvoicePaid,
  syncStripeSubscription,
} from '@/lib/billing/webhook'

export const dynamic = 'force-dynamic'

async function handle(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'payment_intent.succeeded': {
      const intent = event.data.object
      if (intent.metadata.bookingId) await confirmPaid(intent.metadata.bookingId, intent.id)
      return
    }
    case 'payment_intent.payment_failed': {
      const intent = event.data.object
      if (intent.metadata.bookingId) {
        await markPaymentFailed(
          intent.metadata.bookingId,
          intent.last_payment_error?.message ?? 'Payment failed'
        )
      }
      return
    }
    case 'charge.refunded': {
      const charge = event.data.object
      const intentId =
        typeof charge.payment_intent === 'string'
          ? charge.payment_intent
          : charge.payment_intent?.id
      if (intentId) {
        await recordRefund(
          intentId,
          charge.amount_refunded / 100,
          charge.refunds?.data[0]?.id ?? null
        )
      }
      return
    }
    case 'account.updated': {
      // Stripe Connect (E09): mirror whether the venue can take and pay out money.
      const account = event.data.object
      await prisma.company.updateMany({
        where: { stripeAccountId: account.id },
        data: {
          stripeChargesEnabled: account.charges_enabled,
          stripePayoutsEnabled: account.payouts_enabled,
        },
      })
      return
    }
    // C-15: venue subscriptions.
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await syncStripeSubscription(event.data.object)
      return
    case 'invoice.paid':
      await stripeInvoicePaid(event.data.object)
      return
    case 'invoice.payment_failed':
      await stripeInvoiceFailed(event.data.object)
      return
    default:
      return
  }
}

export async function POST(request: NextRequest) {
  if (!isStripeConfigured()) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const signature = request.headers.get('stripe-signature')
  // The raw text, exactly as sent: re-serialised JSON would not match the signature.
  const rawBody = await request.text()
  let event: Stripe.Event
  try {
    if (!signature) throw new Error('missing signature')
    event = constructWebhookEvent(rawBody, signature)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const seen = await prisma.stripeWebhookEvent.findUnique({ where: { id: event.id } })
  if (seen) return NextResponse.json({ received: true, duplicate: true })

  try {
    await handle(event)
  } catch (caught) {
    // The event id and type only: payloads can hold card and personal details.
    console.error(
      `[webhook] ${event.type} ${event.id} failed:`,
      caught instanceof Error ? caught.message : 'unknown error'
    )
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 })
  }

  await prisma.stripeWebhookEvent
    .create({ data: { id: event.id, type: event.type } })
    .catch(() => undefined) // a concurrent delivery recorded it first
  return NextResponse.json({ received: true })
}
