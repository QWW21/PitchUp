/**
 * One booking as its player sees it — the confirmation step of E05. E06's
 * booking detail extends this.
 */
import 'server-only'
import {
  bookingReference,
  endLabel,
  fromMinutes,
  venueClock,
  type BookingConfirmation,
} from '@pitchup/shared'
import { prisma } from '@/lib/prisma'
import { notFound } from '@/lib/api/errors'
import { providerFor } from '@/lib/payments'
import { confirmPaid, markPaymentFailed } from './payment-events'

const select = {
  id: true,
  playerId: true,
  status: true,
  startTime: true,
  endTime: true,
  teamCount: true,
  shirtSets: true,
  totalAmount: true,
  paidAt: true,
  cancellationReason: true,
  paymentProvider: true,
  stripePaymentIntentId: true,
  pitch: {
    select: {
      id: true,
      name: true,
      company: { select: { id: true, name: true, addressLine1: true, city: true } },
    },
  },
} as const

type Row = NonNullable<Awaited<ReturnType<typeof findBooking>>>

const findBooking = (id: string) => prisma.booking.findUnique({ where: { id }, select })

export function toConfirmation(b: Row): BookingConfirmation {
  const start = venueClock(b.startTime)
  const end = venueClock(b.endTime)
  // A booking ending at midnight ends on the next calendar date.
  const endMinutes = end.date === start.date ? end.minutes : 24 * 60
  return {
    id: b.id,
    reference: bookingReference(b.id),
    status: b.status,
    date: start.date,
    startTime: fromMinutes(start.minutes),
    endTime: endLabel(endMinutes),
    minutes: Math.round((b.endTime.getTime() - b.startTime.getTime()) / 60_000),
    teamCount: b.teamCount,
    shirtSets: b.shirtSets,
    total: Number(b.totalAmount),
    paidAt: b.paidAt?.toISOString() ?? null,
    cancellationReason: b.cancellationReason,
    pitch: { id: b.pitch.id, name: b.pitch.name },
    company: {
      id: b.pitch.company.id,
      name: b.pitch.company.name,
      address: b.pitch.company.addressLine1,
      city: b.pitch.company.city,
    },
  }
}

export async function loadConfirmation(id: string): Promise<BookingConfirmation | null> {
  const b = await findBooking(id)
  return b ? toConfirmation(b) : null
}

/**
 * The booking for its player (or an admin). Anyone else gets the same 404 as
 * a booking that does not exist, so ids cannot be probed.
 *
 * A booking still PENDING is checked against the payment provider first:
 * the player usually comes back from Stripe before the webhook does.
 */
export async function getBookingForViewer(
  id: string,
  viewer: { id: string; role: string }
): Promise<BookingConfirmation> {
  let b = await findBooking(id)
  if (!b || (b.playerId !== viewer.id && viewer.role !== 'ADMIN'))
    throw notFound('Booking not found')

  const provider = providerFor(b.paymentProvider)
  if (b.status === 'PENDING' && b.stripePaymentIntentId && provider) {
    const state = await provider.paymentState(b.stripePaymentIntentId)
    if (state.status === 'succeeded') await confirmPaid(b.id, b.stripePaymentIntentId)
    if (state.status === 'failed') await markPaymentFailed(b.id, state.message)
    if (state.status !== 'pending') b = (await findBooking(id))!
  }
  return toConfirmation(b)
}
