/**
 * Venue subscriptions — C-15. PitchUp takes no commission: a venue pays a
 * subscription, monthly or yearly (10 × monthly), cheaper in its first paid
 * year, with a fee for each active pitch beyond the ones included. A free
 * trial month comes first. Prices include VAT; the admin sets them.
 */
import { z } from 'zod'

export const BILLING_INTERVALS = ['MONTHLY', 'YEARLY'] as const
export type BillingInterval = (typeof BILLING_INTERVALS)[number]

export const SUBSCRIPTION_STATUSES = [
  'NONE',
  'TRIALING',
  'ACTIVE',
  'PAST_DUE',
  'PAUSED',
  'CANCELLING',
] as const
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number]

/** Days a failed payment leaves the venue live before it is paused. */
export const BILLING_GRACE_DAYS = 7

/**
 * Live in Discover and taking bookings (with an approved venue). PAST_DUE
 * still counts: the grace period; CANCELLING runs to its paid end.
 */
export const isSubscribed = (status: SubscriptionStatus): boolean =>
  status === 'TRIALING' || status === 'ACTIVE' || status === 'PAST_DUE' || status === 'CANCELLING'

/** The admin's prices, in lei with VAT. Names match PlatformConfig's columns. */
export interface SubscriptionPrices {
  subIntroMonthlyRon: number
  subIntroYearlyRon: number
  subMonthlyRon: number
  subYearlyRon: number
  subExtraPitchMonthlyRon: number
  subExtraPitchYearlyRon: number
  subIncludedPitches: number
  subTrialDays: number
}

/** The owner's prices (2026-10-21). */
export const DEFAULT_SUBSCRIPTION_PRICES: SubscriptionPrices = {
  subIntroMonthlyRon: 10,
  subIntroYearlyRon: 100,
  subMonthlyRon: 30,
  subYearlyRon: 300,
  subExtraPitchMonthlyRon: 5,
  subExtraPitchYearlyRon: 50,
  subIncludedPitches: 2,
  subTrialDays: 30,
}

export interface SubscriptionBill {
  /** The plan's own price for the interval. */
  base: number
  /** Active pitches beyond the included ones, and the fee for each. */
  extraPitches: number
  extraEach: number
  total: number
  /** The first paid year's price. */
  discounted: boolean
}

/** A year after a date, on the same day of the month (UTC). */
const yearAfter = (d: Date) => {
  const next = new Date(d)
  next.setUTCFullYear(next.getUTCFullYear() + 1)
  return next
}

/**
 * What one period costs. The discounted price applies until twelve months
 * after the first paid period began (`firstPaidAt`, the trial's end), and
 * to any period before it; pitches are those active when the bill is made.
 */
export function subscriptionPrice(
  bill: {
    interval: BillingInterval
    firstPaidAt: Date | null
    periodStart: Date
    activePitches: number
  },
  prices: SubscriptionPrices = DEFAULT_SUBSCRIPTION_PRICES
): SubscriptionBill {
  const yearly = bill.interval === 'YEARLY'
  const discounted = !bill.firstPaidAt || bill.periodStart < yearAfter(bill.firstPaidAt)
  const base = discounted
    ? yearly
      ? prices.subIntroYearlyRon
      : prices.subIntroMonthlyRon
    : yearly
      ? prices.subYearlyRon
      : prices.subMonthlyRon
  const extraPitches = Math.max(0, bill.activePitches - prices.subIncludedPitches)
  const extraEach = yearly ? prices.subExtraPitchYearlyRon : prices.subExtraPitchMonthlyRon
  return { base, extraPitches, extraEach, total: base + extraPitches * extraEach, discounted }
}

/** POST /manager/billing/subscribe, PUT /manager/billing/interval. */
export const BillingIntervalSchema = z.object({ interval: z.enum(BILLING_INTERVALS) })

/** POST /payments/test/subscription — test mode only. */
export const TestSubscriptionSchema = z.object({ outcome: z.enum(['paid', 'failed']) })

/** GET /manager/billing. */
export interface ManagerBilling {
  status: SubscriptionStatus
  interval: BillingInterval | null
  /** Set once the free month has been used (or is running). */
  trialEndsAt: string | null
  /** When the current period ends: the next bill, or the end of a cancelling one. */
  periodEnd: string | null
  /** When a failed payment pauses the venue. */
  pauseOn: string | null
  activePitches: number
  /** The next bill at the venue's interval; null with no subscription. */
  nextBill: SubscriptionBill | null
  /** What each interval would cost this venue now. */
  prices: Record<BillingInterval, SubscriptionBill>
  trialDays: number
  /** False once the venue has had its free month. */
  trialAvailable: boolean
  /** "stripe" needs the card form; "test" subscribes at once. Null: billing is off. */
  provider: 'stripe' | 'test' | null
  invoices: { id: string; amount: number; interval: BillingInterval; paidAt: string }[]
}
