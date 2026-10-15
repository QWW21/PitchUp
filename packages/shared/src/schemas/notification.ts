import { z } from 'zod'
import type { NotificationType } from '../types'

/** One notification in the in-app list — E08-09. */
export interface NotificationItem {
  id: string
  type: NotificationType
  title: string
  body: string
  /** What it is about: bookingId, reviewId, pitchId… as the sender stored them. */
  data: Record<string, string>
  isRead: boolean
  createdAt: string
}

/** GET /notifications?cursor= */
export interface NotificationPage {
  items: NotificationItem[]
  nextCursor: string | null
  hasMore: boolean
  /** Unread in total, for the badge. */
  unread: number
}

export const NotificationListQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .default(20)
    .transform(n => Math.min(n, 50)),
})

/** POST /notifications/device-token — E08-10. */
export const DeviceTokenSchema = z.object({
  token: z.string().min(20).max(4096),
  platform: z.enum(['ios', 'android']),
})

/**
 * Where tapping a notification goes, from the list and from a push (E08-09,
 * E08-10). One plain function, so the rule is the same everywhere and tested.
 */
export type NotificationTarget =
  | { screen: 'BookingDetail'; params: { id: string } }
  | { screen: 'MyReviews' }
  | { screen: 'MyBookings' }
  | null

const BOOKING_TYPES = new Set<string>([
  'BOOKING_CONFIRMED',
  'BOOKING_REMINDER_24H',
  'BOOKING_REMINDER_2H',
  'BOOKING_CANCELLED_PLAYER',
  'BOOKING_CANCELLED_MANAGER',
  'REFUND_PROCESSED',
  'NO_SHOW_REPORTED',
  'PENALTY_CHARGED',
  'DISPUTE_RESOLVED',
])

export function notificationTarget(
  type: string,
  data: Record<string, unknown> | null | undefined
): NotificationTarget {
  if (BOOKING_TYPES.has(type)) {
    const bookingId = typeof data?.bookingId === 'string' ? data.bookingId : null
    return bookingId
      ? { screen: 'BookingDetail', params: { id: bookingId } }
      : { screen: 'MyBookings' }
  }
  if (type === 'MANAGER_REPLIED') return { screen: 'MyReviews' }
  return null
}
