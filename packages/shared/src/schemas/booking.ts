import { z } from 'zod'
import { BOOKING } from '../constants/booking'
import { REVIEW } from '../constants/review'
import { SHIRT_COLOURS } from '../constants/shirts'
import { BOOKING_PAYMENT_METHODS, type BookingPaymentMethod } from '../payment'
import { idSchema } from './common'
import type { BookingStatus } from '../types'

const shirtColourSchema = z.enum(SHIRT_COLOURS as unknown as [string, ...string[]])

const teamSchema = z.object({
  /** The shirt colour this team plays in, when it borrows a set. */
  colour: shirtColourSchema.optional(),
  playerCount: z.number().int().min(1).max(BOOKING.MAX_PLAYERS_PER_TEAM).optional(),
})

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD')
  .refine(d => {
    const t = new Date(`${d}T00:00:00Z`)
    return !Number.isNaN(t.getTime()) && t.toISOString().startsWith(d)
  }, 'date is not a real date')

/** HH:MM on the 30-minute grid; "24:00" means midnight at the end of the day. */
const slotTimeSchema = z
  .string()
  .regex(/^(([01]\d|2[0-3]):(00|30)|24:00)$/, 'Times are HH:MM on the half hour')

const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

/**
 * POST /api/v1/bookings — E05-07. Times are the venue's wall clock on
 * `date` (Europe/Bucharest); the server turns them into instants. Sending
 * local times rather than UTC keeps "same day" meaning the venue's day: the
 * old UTC check would have split a 01:00 booking across two dates.
 */
export const CreateBookingSchema = z
  .object({
    pitchId: idSchema,
    date: dateSchema,
    startTime: slotTimeSchema,
    endTime: slotTimeSchema,
    teamCount: z.number().int().min(BOOKING.MIN_TEAM_COUNT).max(BOOKING.MAX_TEAM_COUNT),
    teamsData: z.array(teamSchema).min(BOOKING.MIN_TEAM_COUNT).max(BOOKING.MAX_TEAM_COUNT),
    /** Free shirts: the booking gets shirtSetsFor(teamCount, true) sets. */
    wantsShirts: z.boolean().default(false),
    noteToManager: z.string().trim().max(BOOKING.MAX_NOTE_LENGTH).optional(),
    /** A saved Stripe card to charge; omitted for a new card or test payments. */
    paymentMethodId: z.string().min(1).max(100).optional(),
    /** How the player pays (C-8): online, or at the venue with a deposit. */
    paymentMethod: z.enum(BOOKING_PAYMENT_METHODS).default('ONLINE'),
  })
  .refine(data => minutesOf(data.endTime) > minutesOf(data.startTime), {
    message: 'End time must be after start time',
    path: ['endTime'],
  })
  .refine(
    data => {
      const hours = (minutesOf(data.endTime) - minutesOf(data.startTime)) / 60
      return hours >= BOOKING.MIN_DURATION_HOURS && hours <= BOOKING.MAX_DURATION_HOURS
    },
    {
      message: `Booking must be between ${BOOKING.MIN_DURATION_HOURS} and ${BOOKING.MAX_DURATION_HOURS} hours`,
      path: ['endTime'],
    }
  )
  .refine(data => data.teamsData.length === data.teamCount, {
    message: 'teamsData must contain exactly teamCount entries',
    path: ['teamsData'],
  })

export const CancelBookingSchema = z.object({
  reason: z.string().max(300).optional(),
})

export const NoShowSchema = z.object({
  reason: z.string().min(1).max(300),
})

export const DisputeSchema = z.object({
  disputeText: z.string().min(1).max(REVIEW.MAX_DISPUTE_TEXT_LENGTH),
  evidenceUrls: z.array(z.string().url()).max(REVIEW.MAX_PHOTOS).optional(),
})

export const ResolveDisputeSchema = z.object({
  resolution: z.enum(['RESOLVED_PLAYER', 'RESOLVED_MANAGER']),
  adminNote: z.string().max(500).optional(),
})

export type CreateBookingInput = z.infer<typeof CreateBookingSchema>
export type CancelBookingInput = z.infer<typeof CancelBookingSchema>
export type NoShowInput = z.infer<typeof NoShowSchema>
export type DisputeInput = z.infer<typeof DisputeSchema>
export type ResolveDisputeInput = z.infer<typeof ResolveDisputeSchema>
export type BookingTeam = z.infer<typeof teamSchema>

// ── Responses (E05) ─────────────────────────────────────────────────────────

/** "test" is the built-in payment mode used while Stripe keys are not set. */
export type PaymentProviderName = 'stripe' | 'test'

/** GET /api/v1/payments/config. A null provider means payments are off. */
export interface PaymentConfig {
  provider: PaymentProviderName | null
  /** Stripe's publishable key, for Stripe.js / the React Native SDK. */
  publishableKey: string | null
}

/** POST /api/v1/bookings. The booking is PENDING until the payment succeeds. */
export interface CreateBookingResult {
  bookingId: string
  reference: string
  total: number
  /** After this the unpaid booking stops holding the slot. */
  holdExpiresAt: string
  /** Charged now: the full price, the deposit (C-8), or nothing. */
  payNow: number
  dueAtVenue: number
  /** `none`: nothing to pay online (a 0% deposit); the booking is already confirmed. */
  payment:
    | { provider: 'stripe'; clientSecret: string; publishableKey: string }
    | { provider: 'test' }
    | { provider: 'none' }
}

/** POST /api/v1/payments/test/confirm — test mode only. */
export const TestPaymentSchema = z.object({
  bookingId: idSchema,
  outcome: z.enum(['succeed', 'decline']),
})

/** GET /api/v1/bookings/:id — what the confirmation step shows. E06 extends it. */
export interface BookingConfirmation {
  id: string
  reference: string
  status: BookingStatus
  /** Venue-local date and times. */
  date: string
  startTime: string
  endTime: string
  minutes: number
  teamCount: number
  shirtSets: number
  total: number
  paidAt: string | null
  cancellationReason: string | null
  /** C-8: how it is paid, the deposit charged online, and what is left for the venue. */
  paymentMethod: BookingPaymentMethod
  deposit: number | null
  dueAtVenue: number
  /** When the manager confirmed the player came (and was paid at the venue). */
  attendedAt: string | null
  pitch: { id: string; name: string }
  company: { id: string; name: string; address: string; city: string }
}

/** GET /api/v1/payments/methods. */
export interface SavedCard {
  id: string
  brand: string
  last4: string
  expMonth: number
  expYear: number
}

/** GET /api/v1/pitches/:id/calendar — one entry per day, for the date step. */
export interface CalendarDay {
  date: string
  status: 'available' | 'full' | 'closed'
}

// ── My Bookings (E06) ───────────────────────────────────────────────────────

export const BOOKING_TABS = ['upcoming', 'past', 'cancelled'] as const
export type BookingTab = (typeof BOOKING_TABS)[number]

/** GET /api/v1/bookings?tab=&cursor=&limit= */
export const BookingListQuerySchema = z.object({
  tab: z.enum(BOOKING_TABS).default('upcoming'),
  cursor: z.string().min(1).optional(),
  // Clamped rather than refused, as E06-01 asks.
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .default(20)
    .transform(n => Math.min(n, 50)),
})

/** One card in My Bookings. */
export interface BookingListItem {
  id: string
  reference: string
  status: BookingStatus
  date: string
  startTime: string
  endTime: string
  minutes: number
  /** The kick-off instant, for the countdown chip. */
  startsAt: string
  pitch: { id: string; name: string; surfaceType: SurfaceTypeName }
  company: { id: string; name: string; logoUrl: string | null }
  total: number
  refundAmount: number | null
  paymentMethod: BookingPaymentMethod
  /** Still to pay at the venue (C-8); 0 when paid online. */
  dueAtVenue: number
  cancelledBy: 'PLAYER' | 'MANAGER' | 'ADMIN' | 'SYSTEM' | null
  hasReview: boolean
  /** Completed, not reviewed, and within the review window. */
  canReview: boolean
}

type SurfaceTypeName = 'NATURAL_GRASS' | 'ARTIFICIAL_GRASS' | 'FUTSAL'

export interface BookingListPage {
  items: BookingListItem[]
  nextCursor: string | null
  hasMore: boolean
}

/** GET /api/v1/bookings/count — for a badge. */
export interface BookingCounts {
  upcoming: number
  unreviewed: number
}

/** GET /api/v1/bookings/:id — E06-02. A superset of the E05 confirmation. */
export interface BookingDetail extends BookingConfirmation {
  startsAt: string
  createdAt: string
  pitch: BookingConfirmation['pitch'] & { surfaceType: SurfaceTypeName; size: string }
  company: BookingConfirmation['company'] & { logoUrl: string | null; phone: string | null }
  teams: { name: string; players: number | null; colour: string | null }[]
  note: string | null
  payment: {
    provider: PaymentProviderName | null
    cardBrand: string | null
    cardLast4: string | null
    paidAt: string | null
    refundAmount: number | null
    refundedAt: string | null
  }
  cancelledBy: BookingListItem['cancelledBy']
  statusHistory: { status: BookingStatus; at: string }[]
  /** Null when the booking can no longer be cancelled (started, or already final). */
  cancellation: { refundPercent: number; refundAmount: number } | null
  review: {
    id: string
    rating: number
    text: string | null
    isAnonymous: boolean
    createdAt: string
    /** Editing and deleting stop 24 hours after posting. */
    editableUntil: string
  } | null
  canReview: boolean
  noShow: {
    reason: string | null
    disputeStatus: 'NONE' | 'OPEN' | 'RESOLVED_PLAYER' | 'RESOLVED_MANAGER'
    /** Null once the dispute window has closed or a dispute was filed. */
    disputeUntil: string | null
  } | null
}

/** POST /api/v1/bookings/:id/cancel */
export interface CancelBookingResult {
  refundAmount: number
  refundPercent: number
  booking: BookingDetail
}
