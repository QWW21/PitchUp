import Link from 'next/link'
import { notFound } from 'next/navigation'
import { formatDateLong, formatDuration, paymentStatusLine } from '@pitchup/shared'
import { auth } from '@/auth'
import { ApiException } from '@/lib/api/errors'
import { getBookingForViewer } from '@/lib/bookings/read'
import { stepPath } from '@/components/booking/paths'
import { ConfirmationActions, RefreshWhilePending } from '@/components/booking/ConfirmationActions'
import { getLocale, getT } from '@/i18n/server'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ pitchId: string }>
  searchParams: Promise<{ booking?: string }>
}

/** Step 5 — E05-10 (UIUX_SPEC §7.5). Rendered on the server from the booking itself. */
export default async function ConfirmationPage({ params, searchParams }: Props) {
  const [{ pitchId }, { booking: bookingId }] = await Promise.all([params, searchParams])
  const session = await auth()
  if (!bookingId || !session?.user) notFound()
  const [t, locale] = [await getT(), await getLocale()]

  const booking = await getBookingForViewer(bookingId, {
    id: session.user.id,
    role: session.user.role,
  }).catch(caught => {
    if (caught instanceof ApiException && caught.code === 'NOT_FOUND') notFound()
    throw caught
  })

  if (booking.status === 'PENDING') {
    return (
      <section className="py-16 text-center" aria-live="polite">
        <RefreshWhilePending />
        <h1 className="text-xl font-semibold text-neutral-900">
          {t('booking.confirmation.confirming')}
        </h1>
        <p className="mt-2 text-sm text-neutral-500">{t('booking.confirmation.fewSeconds')}</p>
      </section>
    )
  }

  const waiting = booking.status === 'AWAITING_APPROVAL'
  if (booking.status !== 'CONFIRMED' && !waiting) {
    return (
      <section className="py-16 text-center">
        <h1 className="text-xl font-semibold text-neutral-900">
          {t('booking.confirmation.failed')}
        </h1>
        <p className="mt-2 text-sm text-neutral-500">
          {booking.cancellationReason ?? t('booking.confirmation.nothingBooked')}
        </p>
        <Link
          href={stepPath(pitchId, 'summary')}
          className="mt-6 inline-block text-sm font-medium text-primary-600 hover:underline"
        >
          {t('booking.confirmation.tryAgain')}
        </Link>
      </section>
    )
  }

  const when = `${formatDateLong(booking.date, locale)}, ${booking.startTime}–${booking.endTime}`
  return (
    <section className="flex flex-col items-center py-8 text-center print:py-0">
      <svg
        className="h-20 w-20 motion-safe:animate-[pop_800ms_ease-in-out_600ms]"
        viewBox="0 0 80 80"
        aria-hidden="true"
      >
        <circle cx="40" cy="40" r="38" className="fill-primary-600" />
        <path
          d="M24 41 L36 53 L58 29"
          fill="none"
          stroke="white"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="60"
          className="motion-safe:animate-[draw_600ms_linear_forwards] motion-safe:[stroke-dashoffset:60]"
        />
      </svg>
      <h1 className="mt-6 text-2xl font-bold text-neutral-900">
        {waiting ? t('booking.confirmation.sent') : t('booking.confirmation.confirmed')}
      </h1>
      <p className="mt-1 max-w-md text-neutral-500">
        {waiting
          ? t('booking.confirmation.sentBody', { company: booking.company.name })
          : t('booking.confirmation.ready')}
      </p>

      <dl className="mt-8 w-full space-y-1 rounded-xl bg-neutral-100 p-5">
        <dt className="sr-only">{t('booking.confirmation.reference')}</dt>
        <dd className="font-mono text-xs text-neutral-700">{booking.reference}</dd>
        <dt className="sr-only">{t('booking.confirmation.pitch')}</dt>
        <dd className="text-lg font-semibold text-neutral-900">{booking.pitch.name}</dd>
        <dt className="sr-only">{t('booking.confirmation.venue')}</dt>
        <dd className="text-neutral-700">
          {booking.company.name}, {booking.company.address}
        </dd>
        <dt className="sr-only">{t('booking.confirmation.when')}</dt>
        <dd className="text-neutral-700">
          {when} ({formatDuration(booking.minutes)})
          {booking.airType && ` · ${t(`air.${booking.airType}`)}`}
        </dd>
        {booking.shirtSets > 0 && (
          <>
            <dt className="sr-only">{t('booking.confirmation.shirts')}</dt>
            <dd className="text-neutral-700">
              {t('booking.confirmation.freeShirts', { count: booking.shirtSets })}
            </dd>
          </>
        )}
        <dt className="sr-only">{t('booking.confirmation.payment')}</dt>
        <dd className="pt-1 font-medium text-primary-700">{paymentStatusLine(booking, locale)}</dd>
      </dl>

      <ConfirmationActions
        pitchId={pitchId}
        bookingId={booking.id}
        shareText={t('booking.confirmation.share', {
          pitch: booking.pitch.name,
          company: booking.company.name,
          when,
        })}
      />
    </section>
  )
}
