/**
 * Paying at the venue with an online deposit — C-8. Shared by the API (which
 * enforces it), the web and the app (which show it).
 *
 * The venue chooses how it is paid (`VenuePaymentMode`) and a deposit of
 * 0–50%. Players with a trust score of 70 or more may then pay at the venue:
 * (a) the deposit is refunded once the manager confirms they came, and they
 * pay the full price there; or (b) the deposit counts, and they pay the rest
 * there. With a 0% deposit nothing is paid online.
 */
import { z } from 'zod'
import type { RefundPolicy } from './constants/cancellation'

const round2 = (n: number) => Math.round(n * 100) / 100

export const VENUE_PAYMENT_MODES = ['ONLINE', 'ONLINE_OR_VENUE', 'VENUE'] as const
export type VenuePaymentMode = (typeof VENUE_PAYMENT_MODES)[number]

export const BOOKING_PAYMENT_METHODS = [
  'ONLINE',
  'VENUE_REFUND_DEPOSIT',
  'VENUE_DEPOSIT_TOWARDS',
] as const
export type BookingPaymentMethod = (typeof BOOKING_PAYMENT_METHODS)[number]

export const VENUE_PAYMENT = {
  /** Excellent and Good players (constants/trust.ts). */
  MIN_TRUST_SCORE: 70,
  MIN_DEPOSIT_PERCENT: 0,
  MAX_DEPOSIT_PERCENT: 50,
  DEFAULT_DEPOSIT_PERCENT: 20,
} as const

/** What a player may choose at this venue. Empty: they cannot book here. */
export function paymentMethodsFor(
  mode: VenuePaymentMode,
  depositPercent: number,
  trustScore: number
): BookingPaymentMethod[] {
  const atVenue: BookingPaymentMethod[] =
    trustScore < VENUE_PAYMENT.MIN_TRUST_SCORE
      ? []
      : depositPercent > 0
        ? ['VENUE_DEPOSIT_TOWARDS', 'VENUE_REFUND_DEPOSIT']
        : // No deposit, nothing to refund: one way to pay at the venue.
          ['VENUE_DEPOSIT_TOWARDS']
  if (mode === 'ONLINE') return ['ONLINE']
  if (mode === 'VENUE') return atVenue
  return ['ONLINE', ...atVenue]
}

export interface PaymentSplit {
  method: BookingPaymentMethod
  /** Charged by card when booking: the full price, the deposit, or nothing. */
  payNow: number
  /** Null when paid online in full. */
  deposit: number | null
  /** Paid to the venue on the day. */
  dueAtVenue: number
  /** (a): the deposit goes back to the card once the manager confirms attendance. */
  depositRefunded: boolean
}

export function paymentSplit(
  total: number,
  method: BookingPaymentMethod,
  depositPercent: number
): PaymentSplit {
  if (method === 'ONLINE') {
    return { method, payNow: total, deposit: null, dueAtVenue: 0, depositRefunded: false }
  }
  const deposit = round2((total * depositPercent) / 100)
  if (method === 'VENUE_REFUND_DEPOSIT' && deposit > 0) {
    return { method, payNow: deposit, deposit, dueAtVenue: total, depositRefunded: true }
  }
  return {
    method: 'VENUE_DEPOSIT_TOWARDS',
    payNow: deposit,
    deposit,
    dueAtVenue: round2(total - deposit),
    depositRefunded: false,
  }
}

/** "Pay 54 RON deposit now · 216 RON at the venue", and the other cases. */
export function describePayment(s: PaymentSplit): string {
  if (s.method === 'ONLINE') return `Pay ${s.payNow} RON now`
  if (!s.payNow) return `Nothing to pay now · ${s.dueAtVenue} RON at the venue`
  if (s.depositRefunded) {
    return `${s.payNow} RON deposit now, refunded after the game · ${s.dueAtVenue} RON at the venue`
  }
  return `Pay ${s.payNow} RON deposit now · ${s.dueAtVenue} RON at the venue`
}

/** The choices' names, as the summary step lists them. */
export const PAYMENT_METHOD_LABELS: Record<BookingPaymentMethod, string> = {
  ONLINE: 'Pay online now',
  VENUE_DEPOSIT_TOWARDS: 'Pay at the venue, the deposit counts',
  VENUE_REFUND_DEPOSIT: 'Pay in full at the venue, deposit back after the game',
}

/** GET /api/v1/pitches/:id/payment-options — what this player may choose here. */
export interface PaymentOptions {
  mode: VenuePaymentMode
  depositPercent: number
  methods: BookingPaymentMethod[]
  /** True when the venue takes payment at the venue but this player's trust is too low. */
  trustTooLow: boolean
  /** C-10: the venue's refund policy, which the booking will keep. */
  refundPolicy: RefundPolicy
  /** C-13: false when the venue confirms each booking by hand. */
  autoApproveBookings: boolean
}

/** PUT /api/v1/manager/settings/payments */
export const VenuePaymentSettingsSchema = z.object({
  paymentMode: z.enum(VENUE_PAYMENT_MODES),
  depositPercent: z
    .number()
    .int()
    .min(VENUE_PAYMENT.MIN_DEPOSIT_PERCENT)
    .max(VENUE_PAYMENT.MAX_DEPOSIT_PERCENT, 'At most 50%'),
})
export type VenuePaymentSettings = z.infer<typeof VenuePaymentSettingsSchema>

/** POST /api/v1/manager/bookings/:id/no-show */
export const ReportNoShowSchema = z.object({
  reason: z.string().trim().max(300).optional(),
})

/**
 * What a booking's player has paid and still owes, in one line: the
 * confirmation, My Bookings and the booking detail all say it the same way.
 */
export function paymentStatusLine(b: {
  total: number
  paymentMethod: BookingPaymentMethod
  deposit: number | null
  dueAtVenue: number
  attendedAt?: string | null
}): string {
  if (b.paymentMethod === 'ONLINE') return `Total paid: ${b.total} RON`
  if (b.attendedAt) return `Paid at the venue: ${b.dueAtVenue} RON`
  if (!b.deposit) return `To pay at the venue: ${b.dueAtVenue} RON`
  const refund = b.paymentMethod === 'VENUE_REFUND_DEPOSIT' ? ' (refunded after the game)' : ''
  return `Deposit paid: ${b.deposit} RON${refund} · To pay at the venue: ${b.dueAtVenue} RON`
}
