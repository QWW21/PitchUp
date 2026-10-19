import type { BookingStatus } from '@pitchup/shared'

const STYLES: Record<BookingStatus, [string, string]> = {
  PENDING: ['Awaiting payment', 'bg-warning-50 text-amber-800'],
  AWAITING_APPROVAL: ['Needs your answer', 'bg-warning-50 text-amber-800'],
  CONFIRMED: ['Confirmed', 'bg-success-50 text-primary-700'],
  CANCELLED: ['Cancelled', 'bg-neutral-100 text-neutral-700'],
  COMPLETED: ['Completed', 'bg-info-50 text-blue-800'],
  NO_SHOW: ['No-show', 'bg-error-50 text-error-600'],
}

/** A booking's status as a coloured pill (E11-06). */
export function BookingStatusBadge({
  status,
  attended,
}: {
  status: BookingStatus
  attended?: boolean
}) {
  const [label, className] =
    attended && status !== 'NO_SHOW'
      ? ['Attended', 'bg-success-50 text-primary-700']
      : STYLES[status]
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  )
}
