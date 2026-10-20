'use client'

import type { BookingStatus } from '@pitchup/shared'
import { useT } from '@/i18n/client'

const STYLES: Record<BookingStatus, string> = {
  PENDING: 'bg-warning-50 text-amber-800',
  AWAITING_APPROVAL: 'bg-warning-50 text-amber-800',
  CONFIRMED: 'bg-success-50 text-primary-700',
  CANCELLED: 'bg-neutral-100 text-neutral-700',
  COMPLETED: 'bg-info-50 text-blue-800',
  NO_SHOW: 'bg-error-50 text-error-600',
}

/** A booking's status as a coloured pill (E11-06). */
export function BookingStatusBadge({
  status,
  attended,
}: {
  status: BookingStatus
  attended?: boolean
}) {
  const t = useT()
  const [label, className] =
    attended && status !== 'NO_SHOW'
      ? [t('mBookings.status.attended'), 'bg-success-50 text-primary-700']
      : [t(`mBookings.status.${status}`), STYLES[status]]
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  )
}
