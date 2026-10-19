'use client'

/**
 * What a manager can do to one booking — E11-08 with C-8: Confirm attended
 * (refunds a "deposit back" deposit), Report no-show (asks first), and Mark
 * as complete; C-12 and C-13: Accept or Decline a request, and Cancel a
 * booking before kick-off (both ask why, and refund the player in full).
 * Each shows only when it is allowed.
 */
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { NO_SHOW_WINDOW, type ManagerBookingDetail } from '@pitchup/shared'
import { Alert } from '@/components/ui/Alert'
import { send } from '@/lib/http'

export function BookingActions({ booking: b }: { booking: ManagerBookingDetail }) {
  const router = useRouter()
  const dialog = useRef<HTMLDialogElement>(null)
  const cancelDialog = useRef<HTMLDialogElement>(null)
  const [why, setWhy] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reason, setReason] = useState('')

  const act = async (
    action: 'attended' | 'no-show' | 'complete' | 'accept' | 'cancel',
    body: object = {}
  ) => {
    setBusy(true)
    setError(null)
    try {
      await send(`/api/v1/manager/bookings/${b.id}/${action}`, 'POST', body)
      dialog.current?.close()
      cancelDialog.current?.close()
      router.refresh()
    } catch (caught) {
      setError((caught as Error).message)
    }
    setBusy(false)
  }

  const none =
    !b.canConfirmAttended && !b.canReportNoShow && !b.canComplete && !b.canAccept && !b.canCancel
  const declining = b.status === 'AWAITING_APPROVAL'
  const refundText =
    b.paymentMethod === 'ONLINE'
      ? `${b.player.name} gets the ${b.total} RON back.`
      : b.deposit
        ? `${b.player.name} gets the ${b.deposit} RON deposit back.`
        : `${b.player.name} paid nothing online.`
  const kept = b.deposit
    ? `You keep the ${b.deposit} RON deposit.`
    : b.paymentMethod === 'ONLINE'
      ? `You keep the ${b.total} RON paid online.`
      : 'There is no deposit to keep.'

  return (
    <div className="mt-3 space-y-3">
      {error && <Alert>{error}</Alert>}
      {none && (
        <p className="text-sm text-neutral-500">
          {b.status === 'CONFIRMED'
            ? `Attendance can be confirmed from kick-off; a no-show reported from ${NO_SHOW_WINDOW.FROM_MINUTES} minutes after it, for ${NO_SHOW_WINDOW.UNTIL_HOURS} hours.`
            : 'Nothing to do for this booking.'}
        </p>
      )}
      {b.canAccept && b.approvalDeadline && (
        <p className="text-sm text-neutral-700">
          {b.player.name} has paid and waits for your answer. If you don&rsquo;t answer by{' '}
          {new Date(b.approvalDeadline).toLocaleString('en-GB', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Europe/Bucharest',
          })}
          , it is declined and refunded.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {b.canAccept && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void act('accept')}
            className="h-10 rounded-md bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
          >
            Accept booking
          </button>
        )}
        {b.canCancel && (
          <button
            type="button"
            disabled={busy}
            onClick={() => cancelDialog.current?.showModal()}
            className="h-10 rounded-md border border-error-500 px-4 text-sm font-semibold text-error-600 hover:bg-error-50 disabled:opacity-60"
          >
            {declining ? 'Decline' : 'Cancel booking'}
          </button>
        )}
        {b.canConfirmAttended && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void act('attended')}
            className="h-10 rounded-md bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
          >
            Confirm attended
          </button>
        )}
        {b.canComplete && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void act('complete')}
            className="h-10 rounded-md border border-neutral-200 px-4 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 disabled:opacity-60"
          >
            Mark as complete
          </button>
        )}
        {b.canReportNoShow && (
          <button
            type="button"
            disabled={busy}
            onClick={() => dialog.current?.showModal()}
            className="h-10 rounded-md border border-error-500 px-4 text-sm font-semibold text-error-600 hover:bg-error-50 disabled:opacity-60"
          >
            Report no-show
          </button>
        )}
      </div>
      {b.canConfirmAttended && b.paymentMethod === 'VENUE_REFUND_DEPOSIT' && !!b.deposit && (
        <p className="text-xs text-neutral-500">
          Confirming refunds the player&rsquo;s {b.deposit} RON deposit.
        </p>
      )}

      <dialog
        ref={cancelDialog}
        aria-labelledby={`cancel-${b.id}`}
        className="w-[min(28rem,calc(100%-2rem))] rounded-xl p-6 shadow-xl backdrop:bg-black/40"
        onClick={e => e.target === cancelDialog.current && cancelDialog.current?.close()}
      >
        <h2 id={`cancel-${b.id}`} className="text-lg font-semibold text-neutral-900">
          {declining ? `Decline ${b.player.name}'s booking?` : `Cancel ${b.player.name}'s booking?`}
        </h2>
        <p className="mt-2 text-sm text-neutral-700">
          {refundText} They lose no trust points, and are told the reason you give.
        </p>
        <label htmlFor={`why-${b.id}`} className="mt-4 block text-sm font-medium text-neutral-700">
          Reason for the player
        </label>
        <textarea
          id={`why-${b.id}`}
          rows={3}
          maxLength={300}
          value={why}
          onChange={e => setWhy(e.target.value)}
          className="mt-1 w-full rounded-md border border-neutral-200 p-3 text-sm"
        />
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => cancelDialog.current?.close()}
            className="h-10 rounded-md px-4 text-sm font-semibold text-neutral-700 hover:bg-neutral-100"
          >
            Keep it
          </button>
          <button
            type="button"
            disabled={busy || why.trim().length < 5}
            onClick={() => void act('cancel', { reason: why.trim() })}
            className="h-10 rounded-md bg-error-600 px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {busy ? 'Working…' : declining ? 'Decline and refund' : 'Cancel and refund'}
          </button>
        </div>
      </dialog>

      <dialog
        ref={dialog}
        aria-labelledby={`noshow-${b.id}`}
        className="w-[min(28rem,calc(100%-2rem))] rounded-xl p-6 shadow-xl backdrop:bg-black/40"
        onClick={e => e.target === dialog.current && dialog.current?.close()}
      >
        <h2 id={`noshow-${b.id}`} className="text-lg font-semibold text-neutral-900">
          Report {b.player.name} as a no-show?
        </h2>
        <p className="mt-2 text-sm text-neutral-700">
          {kept} The player loses 20 trust points and is told; they can dispute it within 24 hours.
          This can&rsquo;t be undone.
        </p>
        <label
          htmlFor={`reason-${b.id}`}
          className="mt-4 block text-sm font-medium text-neutral-700"
        >
          What happened <span className="font-normal text-neutral-500">(optional)</span>
        </label>
        <textarea
          id={`reason-${b.id}`}
          rows={3}
          maxLength={300}
          value={reason}
          onChange={e => setReason(e.target.value)}
          className="mt-1 w-full rounded-md border border-neutral-200 p-3 text-sm"
        />
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            className="h-10 rounded-md px-4 text-sm font-semibold text-neutral-700 hover:bg-neutral-100"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void act('no-show', reason.trim() ? { reason: reason.trim() } : {})}
            className="h-10 rounded-md bg-error-600 px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {busy ? 'Reporting…' : 'Report no-show'}
          </button>
        </div>
      </dialog>
    </div>
  )
}
