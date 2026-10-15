'use client'

/**
 * The actions on a booking detail — E06-10: cancel (a dialog showing the
 * refund the policy gives), review, dispute a no-show, and edit one's own
 * review while it is still editable or delete it (any time, E07-06).
 */
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { REVIEW, formatDateLong, type BookingDetail } from '@pitchup/shared'
import { Alert } from '@/components/ui/Alert'
import { send } from '@/lib/http'

export function BookingActions({ booking: b }: { booking: BookingDetail }) {
  return (
    <div className="space-y-3">
      {b.cancellation && <CancelBooking booking={b} />}
      {b.canReview && (
        <Link
          href={`/my-bookings/${b.id}/review`}
          className="flex h-12 w-full items-center justify-center rounded-md bg-primary-600 font-semibold text-white hover:bg-primary-700"
        >
          Rate this pitch
        </Link>
      )}
      {b.noShow && <NoShowDispute booking={b} />}
      {(b.status === 'COMPLETED' || b.status === 'NO_SHOW' || b.status === 'CANCELLED') && (
        <Link
          href={`/book/${b.pitch.id}/date`}
          className="flex h-12 w-full items-center justify-center rounded-md font-semibold text-primary-700 hover:bg-primary-50"
        >
          Book this pitch again
        </Link>
      )}
    </div>
  )
}

function CancelBooking({ booking: b }: { booking: BookingDetail }) {
  const router = useRouter()
  const dialog = useRef<HTMLDialogElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { refundPercent, refundAmount } = b.cancellation!
  const tone =
    refundPercent === 100
      ? 'border-primary-600 bg-primary-50'
      : refundPercent > 0
        ? 'border-warning-500 bg-warning-50'
        : 'border-error-600 bg-error-50'

  const cancel = async () => {
    setBusy(true)
    setError(null)
    try {
      await send(`/api/v1/bookings/${b.id}/cancel`, 'POST', {})
      router.replace(`/my-bookings/${b.id}?cancelled=1`)
      router.refresh()
      dialog.current?.close()
    } catch (caught) {
      setError((caught as Error).message)
    }
    setBusy(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="h-12 w-full rounded-md border border-error-600 bg-white font-semibold text-error-600 hover:bg-error-50"
      >
        Cancel booking
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="cancel-title"
        className="w-[min(28rem,calc(100%-2rem))] rounded-xl p-6 shadow-xl backdrop:bg-black/40"
        onClick={e => e.target === dialog.current && dialog.current?.close()}
      >
        <h2 id="cancel-title" className="text-lg font-semibold text-neutral-900">
          Cancel this booking?
        </h2>
        <p className="mt-1 text-sm text-neutral-700">
          {b.pitch.name} · {formatDateLong(b.date)}, {b.startTime}–{b.endTime}
        </p>
        <div className={`mt-4 rounded-r-md border-l-[3px] p-3 text-sm ${tone}`}>
          {b.paidAt ? (
            refundPercent > 0 ? (
              <>
                <p className="text-neutral-900">
                  You&rsquo;ll receive <strong>{refundAmount} RON</strong> back · {refundPercent}%
                  refund
                </p>
                <p className="mt-1 text-neutral-700">
                  Refunds reach your card in 5–10 business days.
                </p>
              </>
            ) : (
              <p className="text-neutral-900">
                <strong>No refund</strong> · it is less than 2 hours to kick-off.
              </p>
            )
          ) : (
            <p className="text-neutral-900">
              This booking is not paid, so there is nothing to refund.
            </p>
          )}
        </div>
        {error && (
          <div className="mt-3">
            <Alert>{error}</Alert>
          </div>
        )}
        <div className="mt-6 space-y-2">
          <button
            type="button"
            autoFocus
            onClick={() => dialog.current?.close()}
            className="h-11 w-full rounded-md bg-primary-600 text-sm font-semibold text-white hover:bg-primary-700"
          >
            Keep my booking
          </button>
          <button
            type="button"
            onClick={cancel}
            disabled={busy}
            aria-busy={busy || undefined}
            className="h-11 w-full rounded-md border border-error-600 bg-white text-sm font-semibold text-error-600 hover:bg-error-50 disabled:opacity-60"
          >
            {busy
              ? 'Cancelling…'
              : b.paidAt && refundAmount > 0
                ? `Cancel — get ${refundAmount} RON back`
                : 'Cancel booking'}
          </button>
        </div>
      </dialog>
    </>
  )
}

function NoShowDispute({ booking: b }: { booking: BookingDetail }) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ns = b.noShow!

  if (ns.disputeStatus !== 'NONE') {
    return (
      <p className="rounded-md bg-neutral-100 p-3 text-sm text-neutral-700">
        {ns.disputeStatus === 'OPEN'
          ? 'Dispute submitted. An admin will review it.'
          : ns.disputeStatus === 'RESOLVED_PLAYER'
            ? 'Your dispute was upheld.'
            : 'Your dispute was reviewed and the no-show stands.'}
      </p>
    )
  }
  if (!ns.disputeUntil) {
    return <p className="text-sm text-neutral-700">The time to dispute this no-show has passed.</p>
  }

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await send(`/api/v1/bookings/${b.id}/dispute`, 'POST', { disputeText: text })
      router.refresh()
    } catch (caught) {
      setError((caught as Error).message)
    }
    setBusy(false)
  }

  return (
    <section aria-labelledby="dispute-heading" className="rounded-xl bg-white p-4 shadow-sm">
      <h2 id="dispute-heading" className="text-base font-semibold text-neutral-900">
        Were you there?
      </h2>
      <p className="mt-1 text-sm text-neutral-700">
        The venue marked this booking as a no-show{ns.reason ? `: “${ns.reason}”` : ''}. If you
        played, tell us what happened.
      </p>
      <label htmlFor="dispute-text" className="mt-3 block text-sm font-medium text-neutral-700">
        What happened
      </label>
      <textarea
        id="dispute-text"
        rows={3}
        maxLength={REVIEW.MAX_DISPUTE_TEXT_LENGTH}
        value={text}
        onChange={e => setText(e.target.value)}
        className="mt-1 w-full rounded-md border border-neutral-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
      />
      {error && <Alert>{error}</Alert>}
      <button
        type="button"
        onClick={submit}
        disabled={busy || !text.trim()}
        className="mt-2 h-11 w-full rounded-md border border-neutral-200 bg-white text-sm font-semibold text-neutral-900 hover:bg-neutral-50 disabled:opacity-60"
      >
        {busy ? 'Sending…' : 'Dispute no-show'}
      </button>
    </section>
  )
}

export function ReviewActions({
  bookingId,
  reviewId,
  editableUntil,
}: {
  bookingId: string
  reviewId: string
  editableUntil: string
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const editable = new Date(editableUntil).getTime() > Date.now()

  const remove = async () => {
    if (!window.confirm('Delete your review? This cannot be undone.')) return
    try {
      await send(`/api/v1/reviews/${reviewId}`, 'DELETE')
      router.refresh()
    } catch (caught) {
      setError((caught as Error).message)
    }
  }

  return (
    <div className="mt-3 flex items-center gap-4 text-sm">
      {editable && (
        <Link
          href={`/my-bookings/${bookingId}/review`}
          className="font-medium text-primary-700 hover:underline"
        >
          Edit review
        </Link>
      )}
      <button type="button" onClick={remove} className="font-medium text-error-600 hover:underline">
        Delete review
      </button>
      {error && <span className="text-error-600">{error}</span>}
    </div>
  )
}
