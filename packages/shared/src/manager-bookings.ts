/**
 * The manager's bookings — E11 (building on C-8's minimal page): the list
 * with its filters, the week calendar, one booking in full, and the rules
 * for what a manager may do to a booking and when.
 */
import { z } from 'zod'
import { bookingPrice, type BookingPrice } from './booking'
import { NO_SHOW_MARK_AFTER_MINUTES } from './constants/penalties'
import { fromMinutes, toMinutes } from './schedule'
import type { BookingPaymentMethod } from './payment'
import type { BookingStatus } from './types'

export const MANAGER_BOOKING_STATUSES = [
  'PENDING',
  'AWAITING_APPROVAL',
  'CONFIRMED',
  'CANCELLED',
  'COMPLETED',
  'NO_SHOW',
] as const

/**
 * A pitch's colour on the calendar, by its place among the venue's pitches.
 * The ticket's shades darkened until white text on them passes WCAG AA.
 */
export const PITCH_COLOURS = [
  '#4F46E5',
  '#C2410C',
  '#15803D',
  '#A16207',
  '#BE185D',
  '#0F766E',
  '#7C3AED',
  '#B91C1C',
] as const
export const pitchColour = (index: number): string => PITCH_COLOURS[index % PITCH_COLOURS.length]!

// ── When a manager may act ───────────────────────────────────────────────────

/** A no-show can be reported from 30 minutes after kick-off (PRD §9.3) until 4 hours after (E11-04). */
export const NO_SHOW_WINDOW = { FROM_MINUTES: NO_SHOW_MARK_AFTER_MINUTES, UNTIL_HOURS: 4 } as const

export function isWithinNoShowWindow(start: Date, now: Date = new Date()): boolean {
  const t = now.getTime() - start.getTime()
  return t >= NO_SHOW_WINDOW.FROM_MINUTES * 60_000 && t <= NO_SHOW_WINDOW.UNTIL_HOURS * 3_600_000
}

// ── Pricing and slots (E11-10, with C-2) ─────────────────────────────────────

/** C-2: hourly rate × the 30-minute slots ÷ 2. The same function as checkout. */
export const calcPrice = (hourlyRate: number, slots: number): BookingPrice =>
  bookingPrice(hourlyRate, slots * 30)

export interface TimeSlot {
  start: string
  end: string
  label: string
}

/**
 * Slots of `minutes` from opening to closing, no partial slot at the end. A
 * closing time at or before the opening time runs past midnight.
 */
export function generateSlots(openTime: string, closeTime: string, minutes: number): TimeSlot[] {
  const open = toMinutes(openTime)
  let close = toMinutes(closeTime)
  if (close <= open) close += 24 * 60
  const slots: TimeSlot[] = []
  for (let m = open; m + minutes <= close; m += minutes) {
    const start = fromMinutes(m)
    const end = m + minutes === 24 * 60 ? '24:00' : fromMinutes(m + minutes)
    slots.push({ start, end, label: `${start}–${end}` })
  }
  return slots
}

// ── The list (E11-01) ────────────────────────────────────────────────────────

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'v.useIsoDate')

export const ManagerBookingQuerySchema = z
  .object({
    pitchId: z.string().min(1).max(40).optional(),
    status: z.enum(MANAGER_BOOKING_STATUSES).optional(),
    dateFrom: date.optional(),
    dateTo: date.optional(),
    search: z.string().trim().min(2, 'v.type2letters').max(100).optional(),
    cursor: z.string().min(1).optional(),
    // Clamped rather than refused.
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .default(20)
      .transform(n => Math.min(n, 100)),
  })
  .refine(q => !q.dateFrom || !q.dateTo || q.dateFrom <= q.dateTo, {
    message: 'v.startAfterEnd',
    path: ['dateFrom'],
  })
export type ManagerBookingQuery = z.infer<typeof ManagerBookingQuerySchema>

/** One booking in the manager's list. */
export interface ManagerBooking {
  id: string
  reference: string
  status: BookingStatus
  /** Venue-local date and times. */
  date: string
  startTime: string
  endTime: string
  pitch: { id: string; name: string; color: string }
  /** No email or phone in the list; the detail has the phone. */
  player: { name: string }
  total: number
  paymentMethod: BookingPaymentMethod
  deposit: number | null
  dueAtVenue: number
  attendedAt: string | null
  canConfirmAttended: boolean
  canReportNoShow: boolean
  canComplete: boolean
  /** C-13: a request waiting for the manager, and until when. */
  canAccept: boolean
  approvalDeadline: string | null
  /** C-12: declining a request, or cancelling a booking before kick-off. */
  canCancel: boolean
}

/** GET /api/v1/manager/bookings */
export interface ManagerBookingPage {
  items: ManagerBooking[]
  nextCursor: string | null
}

// ── The week calendar (E11-02) ───────────────────────────────────────────────

export const ManagerCalendarQuerySchema = z.object({
  week: date,
  pitchId: z.string().min(1).max(40).optional(),
})

export interface CalendarEvent {
  id: string
  pitchId: string
  pitchName: string
  pitchColor: string
  /** Venue-local. */
  date: string
  startTime: string
  endTime: string
  status: BookingStatus
  /** The name only: no contact details on the calendar. */
  playerName: string
  total: number
}

/** GET /api/v1/manager/bookings/calendar */
export interface ManagerCalendar {
  /** The Monday the week starts on (any date is moved back to its Monday). */
  weekStart: string
  days: string[]
  pitches: { id: string; name: string; color: string }[]
  /** The hours to draw, in minutes: the venue's opening hours, widened to fit every booking. */
  from: number
  to: number
  events: CalendarEvent[]
}

// ── One booking (E11-03) ─────────────────────────────────────────────────────

export interface ManagerBookingDetail extends ManagerBooking {
  minutes: number
  createdAt: string
  /** PitchUp's commission and what the venue receives (E11-03). */
  platformFee: number
  venuePayout: number
  teams: { name: string; players: number | null; colour: string | null }[]
  shirtSets: number
  note: string | null
  refundAmount: number | null
  cancellationReason: string | null
  player: {
    name: string
    phone: string | null
    /**
     * What this player has done at this venue — facts, not the trust
     * score, which managers don't see (PRD §9.1).
     */
    history: { bookings: number; completed: number; noShows: number; lateCancels: number }
  }
  statusHistory: { status: BookingStatus; at: string }[]
  review: { rating: number; text: string | null; createdAt: string } | null
  noShow: { reason: string | null; disputeStatus: string } | null
}

/** GET /api/v1/manager/pitches/:id/availability-gaps — free stretches of a day. */
export interface AvailabilityGap {
  start: string
  end: string
  minutes: number
}
