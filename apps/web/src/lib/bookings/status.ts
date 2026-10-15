/**
 * The booking timeline — E06-02. Every status change writes a row here, in
 * the same transaction as the change, so the history cannot disagree with
 * the booking.
 */
import 'server-only'
import type { BookingStatus, Prisma } from '@prisma/client'

type Db = Prisma.TransactionClient

export function recordStatus(db: Db, bookingIds: string | string[], status: BookingStatus) {
  const ids = Array.isArray(bookingIds) ? bookingIds : [bookingIds]
  return db.bookingStatusEvent.createMany({
    data: ids.map(bookingId => ({ bookingId, status })),
  })
}
