/**
 * One booking as its player sees it — the E05 confirmation and the E06
 * booking detail (the detail is a superset of the confirmation).
 */
import 'server-only'
import type { BookingDetail } from '@pitchup/shared'
import { prisma } from '@/lib/prisma'
import { notFound } from '@/lib/api/errors'
import { providerFor } from '@/lib/payments'
import { confirmPaid, markPaymentFailed } from './payment-events'
import { detailSelect, settlePlayerBookings, toDetail } from './mine'

const findBooking = (id: string) =>
  prisma.booking.findUnique({ where: { id }, select: detailSelect })

/** For server-side use (emails): no viewer check, no settling. */
export async function loadConfirmation(id: string): Promise<BookingDetail | null> {
  const b = await findBooking(id)
  return b ? toDetail(b) : null
}

/**
 * The booking for its player (or an admin). Anyone else gets the same 404 as
 * a booking that does not exist, so ids cannot be probed (E06-02 asks for a
 * 403; a 404 reveals less).
 *
 * A booking still PENDING is checked against the payment provider first:
 * the player usually comes back from Stripe before the webhook does.
 */
export async function getBookingForViewer(
  id: string,
  viewer: { id: string; role: string }
): Promise<BookingDetail> {
  let b = await findBooking(id)
  if (!b || (b.playerId !== viewer.id && viewer.role !== 'ADMIN')) {
    throw notFound('Booking not found')
  }

  const provider = providerFor(b.paymentProvider)
  if (b.status === 'PENDING' && b.stripePaymentIntentId && provider) {
    const state = await provider.paymentState(b.stripePaymentIntentId)
    if (state.status === 'succeeded') await confirmPaid(b.id, b.stripePaymentIntentId)
    if (state.status === 'failed') await markPaymentFailed(b.id, state.message)
  }
  await settlePlayerBookings(b.playerId)
  b = (await findBooking(id))!
  return toDetail(b)
}
