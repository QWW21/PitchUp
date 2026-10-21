/**
 * Venue subscriptions — C-15. PitchUp takes no commission; a venue pays a
 * subscription and is live (in Discover, bookable) only while it runs:
 *
 *   NONE ──subscribe──▶ TRIALING (first time: the free month) or ACTIVE
 *   TRIALING / ACTIVE ──bill paid──▶ ACTIVE        ──bill failed──▶ PAST_DUE
 *   PAST_DUE ──paid──▶ ACTIVE    ──7 days──▶ PAUSED ──subscribe/pay──▶ …
 *   any running ──cancel──▶ CANCELLING ──period end──▶ PAUSED
 *
 * Two providers, as for bookings. Stripe (all three keys set) charges the
 * card and tells us through the webhook. The test provider (development and
 * E2E) has no card: it bills itself when a period ends, and the
 * /payments/test/subscription hook makes the next bill pay or fail.
 *
 * `subscriptionPeriodEnd` is when the next bill is due (or a cancelling
 * subscription ends). A venue with no card yet (`billingInterval` null, the
 * venues given a free month when C-15 came in) is paused when it ends.
 */
import 'server-only'
import type { Company, Prisma } from '@prisma/client'
import {
  BILLING_GRACE_DAYS,
  isSubscribed,
  subscriptionPrice,
  type BillingInterval,
  type ManagerBilling,
  type SubscriptionBill,
  type SubscriptionPrices,
} from '@pitchup/shared'
import { prisma } from '@/lib/prisma'
import { ApiException, conflict, notFound } from '@/lib/api/errors'
import { platformConfig } from '@/lib/admin/config'
import { getPaymentProvider } from '@/lib/payments'
import { deliverSoon, notify } from '@/lib/notifications/dispatch'
import {
  createStripeSubscription,
  repriceStripeSubscription,
  setCancelAtPeriodEnd,
} from './stripe-billing'

const DAY = 86_400_000
const BILLING_LINK = '/manager/settings/billing'

type Db = Prisma.TransactionClient | typeof prisma

/** A month or a year after a moment, on the same day (UTC). */
export function addInterval(d: Date, interval: BillingInterval): Date {
  const next = new Date(d)
  if (interval === 'YEARLY') next.setUTCFullYear(next.getUTCFullYear() + 1)
  else next.setUTCMonth(next.getUTCMonth() + 1)
  return next
}

const activePitches = (companyId: string, db: Db = prisma) =>
  db.pitch.count({ where: { companyId, isActive: true, deletedAt: null } })

async function bill(
  company: Pick<Company, 'id' | 'firstPaidAt'>,
  interval: BillingInterval,
  periodStart: Date,
  prices?: SubscriptionPrices
): Promise<SubscriptionBill> {
  return subscriptionPrice(
    {
      interval,
      firstPaidAt: company.firstPaidAt,
      periodStart,
      activePitches: await activePitches(company.id),
    },
    prices ?? (await platformConfig())
  )
}

/** Tells the manager, in their language, and sends it after the change commits. */
async function tell(
  db: Db,
  company: Pick<Company, 'ownerId' | 'name'>,
  key: 'started' | 'trialEnding' | 'paid' | 'failed' | 'paused' | 'ended',
  params: Record<string, string | number> = {}
) {
  await notify(db, {
    userId: company.ownerId,
    type: 'SUBSCRIPTION_NOTICE',
    title: t => t(`notify.subscription.${key}.title`, { company: company.name, ...params }),
    body: t => t(`notify.subscription.${key}.body`, { company: company.name, ...params }),
    data: { link: BILLING_LINK },
  })
}

const day = (d: Date) => d.toISOString().slice(0, 10)

// ── What the manager sees ────────────────────────────────────────────────────

export async function getBilling(
  companyId: string,
  now: Date = new Date()
): Promise<ManagerBilling> {
  const [c, prices, pitches, invoices] = await Promise.all([
    prisma.company.findUniqueOrThrow({ where: { id: companyId } }),
    platformConfig(),
    activePitches(companyId),
    prisma.subscriptionInvoice.findMany({
      where: { companyId },
      orderBy: { paidAt: 'desc' },
      take: 24,
    }),
  ])
  const at =
    c.subscriptionPeriodEnd && c.subscriptionPeriodEnd > now ? c.subscriptionPeriodEnd : now
  const price = (interval: BillingInterval) =>
    subscriptionPrice(
      { interval, firstPaidAt: c.firstPaidAt, periodStart: at, activePitches: pitches },
      prices
    )
  const provider = getPaymentProvider()?.name ?? null
  return {
    status: c.subscriptionStatus,
    interval: c.billingInterval,
    trialEndsAt: c.trialEndsAt?.toISOString() ?? null,
    periodEnd: c.subscriptionPeriodEnd?.toISOString() ?? null,
    pauseOn:
      c.subscriptionStatus === 'PAST_DUE' && c.subscriptionPastDueSince
        ? new Date(c.subscriptionPastDueSince.getTime() + BILLING_GRACE_DAYS * DAY).toISOString()
        : null,
    activePitches: pitches,
    nextBill:
      c.billingInterval &&
      isSubscribed(c.subscriptionStatus) &&
      c.subscriptionStatus !== 'CANCELLING'
        ? price(c.billingInterval)
        : null,
    prices: { MONTHLY: price('MONTHLY'), YEARLY: price('YEARLY') },
    trialDays: prices.subTrialDays,
    trialAvailable: !c.trialEndsAt,
    provider,
    invoices: invoices.map(i => ({
      id: i.id,
      amount: Number(i.amountRon),
      interval: i.interval,
      paidAt: i.paidAt.toISOString(),
    })),
  }
}

// ── Paying a period (both providers) ────────────────────────────────────────

/**
 * A paid bill: the invoice row, ACTIVE, the next period. `firstPaidAt` is set
 * by the first one; a Stripe invoice already recorded is ignored.
 */
export async function recordPaid(
  companyId: string,
  p: {
    interval: BillingInterval
    amountRon: number
    periodStart: Date
    periodEnd: Date
    stripeInvoiceId?: string
  },
  now: Date = new Date()
) {
  const ownerId = await prisma.$transaction(async tx => {
    if (p.stripeInvoiceId) {
      const seen = await tx.subscriptionInvoice.findUnique({
        where: { stripeInvoiceId: p.stripeInvoiceId },
      })
      if (seen) return null
    }
    const c = await tx.company.findUniqueOrThrow({ where: { id: companyId } })
    await tx.subscriptionInvoice.create({
      data: {
        companyId,
        amountRon: p.amountRon,
        interval: p.interval,
        periodStart: p.periodStart,
        periodEnd: p.periodEnd,
        paidAt: now,
        ...(p.stripeInvoiceId ? { stripeInvoiceId: p.stripeInvoiceId } : {}),
      },
    })
    await tx.company.update({
      where: { id: companyId },
      data: {
        subscriptionStatus: c.subscriptionStatus === 'CANCELLING' ? 'CANCELLING' : 'ACTIVE',
        billingInterval: p.interval,
        firstPaidAt: c.firstPaidAt ?? p.periodStart,
        subscriptionPeriodEnd: p.periodEnd,
        subscriptionPastDueSince: null,
      },
    })
    // Only worth saying when it brings the venue back.
    if (c.subscriptionStatus === 'PAST_DUE' || c.subscriptionStatus === 'PAUSED') {
      await tell(tx, c, 'paid', { amount: p.amountRon })
    }
    return c.ownerId
  })
  deliverSoon([ownerId])
}

/** A failed bill: PAST_DUE, from the first failure (the grace runs from there). */
export async function recordFailed(companyId: string, now: Date = new Date()) {
  const ownerId = await prisma.$transaction(async tx => {
    const c = await tx.company.findUniqueOrThrow({ where: { id: companyId } })
    if (c.subscriptionStatus === 'PAST_DUE') return null
    const since = now
    await tx.company.update({
      where: { id: companyId },
      data: { subscriptionStatus: 'PAST_DUE', subscriptionPastDueSince: since },
    })
    await tell(tx, c, 'failed', {
      date: day(new Date(since.getTime() + BILLING_GRACE_DAYS * DAY)),
    })
    return c.ownerId
  })
  deliverSoon([ownerId])
}

/** Test provider: pays the bill due now (or the overdue one). */
async function payTestBill(c: Company, now: Date) {
  const interval = c.billingInterval!
  const periodStart =
    c.subscriptionPeriodEnd && c.subscriptionPeriodEnd <= now ? c.subscriptionPeriodEnd : now
  const price = await bill(c, interval, periodStart)
  await recordPaid(
    c.id,
    {
      interval,
      amountRon: price.total,
      periodStart,
      periodEnd: addInterval(periodStart, interval),
    },
    now
  )
}

// ── The manager's actions ────────────────────────────────────────────────────

/**
 * Starts the subscription. The first time, the free month comes first; a
 * venue that had it pays its first period now. A venue given a free month
 * without a card (C-15's change) adds one here and keeps its month.
 */
export async function subscribe(
  companyId: string,
  interval: BillingInterval,
  now: Date = new Date()
): Promise<{ clientSecret: string | null }> {
  const provider = getPaymentProvider()?.name
  if (!provider) throw new ApiException('SERVICE_UNAVAILABLE', 'api.paymentsNotSetUp')
  const c = await prisma.company.findUniqueOrThrow({ where: { id: companyId } })
  const addingCard = c.subscriptionStatus === 'TRIALING' && !c.billingInterval
  if (isSubscribed(c.subscriptionStatus) && !addingCard) {
    throw conflict('api.alreadySubscribed', { reason: 'ALREADY_SUBSCRIBED' })
  }
  const prices = await platformConfig()
  const trialEnd = addingCard
    ? c.trialEndsAt!
    : !c.trialEndsAt && prices.subTrialDays > 0
      ? new Date(now.getTime() + prices.subTrialDays * DAY)
      : null

  if (provider === 'stripe') {
    const price = await bill(c, interval, trialEnd ?? now, prices)
    const { subscriptionId, clientSecret } = await createStripeSubscription({
      companyId,
      interval,
      amountRon: price.total,
      trialDays: trialEnd
        ? Math.max(1, Math.ceil((trialEnd.getTime() - now.getTime()) / DAY))
        : null,
    })
    // The webhook sets the status once Stripe has the card.
    await prisma.company.update({
      where: { id: companyId },
      data: {
        stripeSubscriptionId: subscriptionId,
        billingInterval: interval,
        ...(trialEnd ? { trialEndsAt: trialEnd } : {}),
      },
    })
    return { clientSecret }
  }

  if (trialEnd) {
    await prisma.$transaction(async tx => {
      await tx.company.update({
        where: { id: companyId },
        data: {
          subscriptionStatus: 'TRIALING',
          billingInterval: interval,
          trialEndsAt: trialEnd,
          subscriptionPeriodEnd: trialEnd,
          subscriptionPastDueSince: null,
        },
      })
      if (!addingCard) await tell(tx, c, 'started', { date: day(trialEnd) })
    })
    deliverSoon([c.ownerId])
  } else {
    await prisma.company.update({
      where: { id: companyId },
      data: { billingInterval: interval, subscriptionPeriodEnd: now },
    })
    await payTestBill({ ...c, billingInterval: interval, subscriptionPeriodEnd: now }, now)
  }
  return { clientSecret: null }
}

/** Runs to the end of the period paid for (or the free month), then pauses. */
export async function cancel(companyId: string) {
  const c = await prisma.company.findUniqueOrThrow({ where: { id: companyId } })
  if (!['TRIALING', 'ACTIVE', 'PAST_DUE'].includes(c.subscriptionStatus)) {
    throw conflict('api.notSubscribed', { reason: 'NOT_SUBSCRIBED' })
  }
  if (c.stripeSubscriptionId) await setCancelAtPeriodEnd(c.stripeSubscriptionId, true)
  await prisma.company.update({
    where: { id: companyId },
    data: { subscriptionStatus: 'CANCELLING' },
  })
}

/** Undoes a cancel before the period ends. */
export async function resume(companyId: string, now: Date = new Date()) {
  const c = await prisma.company.findUniqueOrThrow({ where: { id: companyId } })
  if (c.subscriptionStatus !== 'CANCELLING') {
    throw conflict('api.notCancelling', { reason: 'NOT_CANCELLING' })
  }
  if (c.stripeSubscriptionId) await setCancelAtPeriodEnd(c.stripeSubscriptionId, false)
  await prisma.company.update({
    where: { id: companyId },
    data: {
      subscriptionStatus:
        c.trialEndsAt && c.trialEndsAt > now && !c.firstPaidAt ? 'TRIALING' : 'ACTIVE',
    },
  })
}

/** Monthly or yearly from the next bill on. */
export async function changeInterval(companyId: string, interval: BillingInterval) {
  const c = await prisma.company.findUniqueOrThrow({ where: { id: companyId } })
  if (!isSubscribed(c.subscriptionStatus)) {
    throw conflict('api.notSubscribed', { reason: 'NOT_SUBSCRIBED' })
  }
  await prisma.company.update({ where: { id: companyId }, data: { billingInterval: interval } })
}

/** POST /payments/test/subscription: the next bill pays, or fails. Test provider only. */
export async function testBillOutcome(
  companyId: string,
  outcome: 'paid' | 'failed',
  now: Date = new Date()
) {
  const c = await prisma.company.findUniqueOrThrow({ where: { id: companyId } })
  if (c.stripeSubscriptionId || !c.billingInterval) throw notFound('api.notSubscribed')
  if (outcome === 'failed') await recordFailed(companyId, now)
  else await payTestBill(c, now)
}

// ── The daily job ────────────────────────────────────────────────────────────

/**
 * /api/v1/cron/billing, daily. Test subscriptions bill themselves when due;
 * a free month without a card, a cancelled subscription at its end, and a
 * failed payment after the grace period pause the venue; Stripe
 * subscriptions are repriced a day before they renew (their year and active
 * pitches may have changed); a free month ending in three days is announced.
 */
export async function runBilling(now: Date = new Date()) {
  const result = { billed: 0, paused: 0, repriced: 0, reminded: 0 }

  const due = await prisma.company.findMany({
    where: {
      stripeSubscriptionId: null,
      subscriptionStatus: { in: ['TRIALING', 'ACTIVE'] },
      subscriptionPeriodEnd: { lte: now },
    },
  })
  for (const c of due) {
    if (c.billingInterval) {
      await payTestBill(c, now)
      result.billed++
    } else {
      await pause(c, 'paused')
      result.paused++
    }
  }

  const ended = await prisma.company.findMany({
    where: { subscriptionStatus: 'CANCELLING', subscriptionPeriodEnd: { lte: now } },
  })
  for (const c of ended) {
    await pause(c, 'ended')
    result.paused++
  }

  const lapsed = await prisma.company.findMany({
    where: {
      subscriptionStatus: 'PAST_DUE',
      subscriptionPastDueSince: { lte: new Date(now.getTime() - BILLING_GRACE_DAYS * DAY) },
    },
  })
  for (const c of lapsed) {
    await pause(c, 'paused')
    result.paused++
  }

  const renewing = await prisma.company.findMany({
    where: {
      stripeSubscriptionId: { not: null },
      subscriptionStatus: { in: ['TRIALING', 'ACTIVE'] },
      subscriptionPeriodEnd: { gt: now, lte: new Date(now.getTime() + DAY) },
    },
  })
  for (const c of renewing) {
    const interval = c.billingInterval ?? 'MONTHLY'
    const price = await bill(c, interval, c.subscriptionPeriodEnd!)
    await repriceStripeSubscription(c.stripeSubscriptionId!, interval, price.total)
    result.repriced++
  }

  const trialsEnding = await prisma.company.findMany({
    where: {
      subscriptionStatus: 'TRIALING',
      trialEndsAt: {
        gt: new Date(now.getTime() + 2 * DAY),
        lte: new Date(now.getTime() + 3 * DAY),
      },
    },
  })
  for (const c of trialsEnding) {
    await tell(prisma, c, 'trialEnding', { date: day(c.trialEndsAt!) })
    result.reminded++
  }
  if (trialsEnding.length) deliverSoon(trialsEnding.map(c => c.ownerId))

  return result
}

async function pause(c: Company, why: 'paused' | 'ended') {
  await prisma.$transaction(async tx => {
    await tx.company.update({
      where: { id: c.id },
      data: { subscriptionStatus: 'PAUSED', subscriptionPastDueSince: null },
    })
    await tell(tx, c, why)
  })
  deliverSoon([c.ownerId])
}
