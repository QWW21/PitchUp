import type { Metadata } from 'next'
import { formatDateLong, type ManagerBooking } from '@pitchup/shared'
import { requireActiveManager } from '@/lib/manager/access'
import { listManagerBookings } from '@/lib/manager/bookings'
import { BookingRowActions } from '@/components/manager/BookingRowActions'

export const metadata: Metadata = { title: 'Bookings | PitchUp' }

/**
 * The minimal Bookings page agreed for C-8: upcoming and last week's
 * bookings, how each is paid and what is still due at the venue, with
 * Confirm attended and Report no-show. E10/E11 build the full schedule.
 */
export default async function BookingsPage() {
  const { company } = await requireActiveManager()
  const { upcoming, recent } = await listManagerBookings(company.id)

  return (
    <>
      <h1 className="sr-only">Bookings</h1>
      <List
        id="recent"
        title="Started in the last 7 days"
        empty="No games in the last week."
        items={recent}
      />
      <List id="upcoming" title="Upcoming" empty="No upcoming bookings." items={upcoming} />
    </>
  )
}

function List({
  id,
  title,
  empty,
  items,
}: {
  id: string
  title: string
  empty: string
  items: ManagerBooking[]
}) {
  return (
    <section aria-labelledby={`${id}-heading`} className="mb-8">
      <h2 id={`${id}-heading`} className="text-lg font-semibold text-neutral-900">
        {title}
      </h2>
      {items.length === 0 ? (
        <p className="mt-3 rounded-xl bg-white p-6 text-center text-sm text-neutral-500 shadow-sm">
          {empty}
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {items.map(b => (
            <li key={b.id}>
              <Row b={b} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

const PAID: Record<ManagerBooking['paymentMethod'], string> = {
  ONLINE: 'Paid online',
  VENUE_DEPOSIT_TOWARDS: 'Pays at the venue, deposit counts',
  VENUE_REFUND_DEPOSIT: 'Pays in full at the venue, deposit refunded',
}

function Row({ b }: { b: ManagerBooking }) {
  const state =
    b.status === 'NO_SHOW'
      ? 'No-show'
      : b.attendedAt
        ? 'Attended'
        : b.status === 'COMPLETED'
          ? 'Played'
          : 'Confirmed'
  return (
    <article
      aria-labelledby={`b-${b.id}`}
      className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm sm:flex-row sm:items-center"
    >
      <div className="min-w-0 flex-1">
        <h3 id={`b-${b.id}`} className="font-semibold text-neutral-900">
          {formatDateLong(b.date)}, {b.startTime}–{b.endTime} · {b.pitch.name}
        </h3>
        <p className="text-sm text-neutral-700">
          {b.player.name}
          {b.player.phone && <span className="text-neutral-500"> · {b.player.phone}</span>}
          <span className="text-neutral-500"> · {b.reference}</span>
        </p>
        <p className="mt-1 text-sm text-neutral-700">
          {PAID[b.paymentMethod]}
          {b.deposit ? ` · deposit ${b.deposit} RON` : ''}
          {' · '}
          {b.paymentMethod === 'ONLINE' ? (
            `${b.total} RON`
          ) : b.attendedAt ? (
            `${b.dueAtVenue} RON paid at the venue`
          ) : (
            <strong className="text-neutral-900">Due at the venue: {b.dueAtVenue} RON</strong>
          )}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-700">
          {state}
        </span>
        {(b.canConfirmAttended || b.canReportNoShow) && <BookingRowActions booking={b} />}
      </div>
    </article>
  )
}
