import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { formatDateLong } from '@pitchup/shared'
import { auth } from '@/auth'
import { ApiException } from '@/lib/api/errors'
import { getBookingForViewer } from '@/lib/bookings/read'
import { ReviewForm } from '@/components/bookings/ReviewForm'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Rate this pitch | PitchUp' }

const until = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Bucharest',
})

type Props = {
  params: Promise<{ id: string }>
  /** `from=my-reviews`: an edit started on My reviews goes back there. */
  searchParams: Promise<{ from?: string }>
}

/**
 * Review form — E06-10. A new review for a completed booking, or an edit of
 * one's own review while it is editable; anything else goes back to the booking.
 */
export default async function ReviewPage({ params, searchParams }: Props) {
  const { id } = await params
  const fromMyReviews = (await searchParams).from === 'my-reviews'
  const session = await auth()
  if (!session?.user) notFound()
  const b = await getBookingForViewer(id, { id: session.user.id, role: session.user.role }).catch(
    caught => {
      if (caught instanceof ApiException && caught.code === 'NOT_FOUND') return null
      throw caught
    }
  )
  if (!b) notFound()

  const editable = b.review && new Date(b.review.editableUntil).getTime() > Date.now()
  if (!b.canReview && !editable) redirect(fromMyReviews ? '/my-reviews' : `/my-bookings/${b.id}`)

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-bold text-neutral-900">
        {b.review ? 'Edit your review' : 'Rate this pitch'}
      </h1>
      <div className="mt-4 rounded-lg bg-neutral-100 p-3 text-sm">
        <p className="font-medium text-neutral-900">{b.pitch.name}</p>
        <p className="text-neutral-700">{b.company.name}</p>
        <p className="text-neutral-700">Played {formatDateLong(b.date)}</p>
      </div>
      {b.review && (
        <p className="mt-2 text-sm text-neutral-500">
          You can edit this until {until.format(new Date(b.review.editableUntil))}.
        </p>
      )}
      <ReviewForm
        bookingId={b.id}
        existing={b.review}
        photosEnabled={!b.review && !!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}
        returnTo={fromMyReviews ? '/my-reviews?updated=1' : undefined}
      />
    </div>
  )
}
