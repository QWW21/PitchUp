'use client'

/**
 * What a manager can do to one booking — E11-08 with C-8: Confirm attended
 * (refunds a "deposit back" deposit), Report no-show (asks first), and Mark
 * as complete. Each shows only when it is allowed.
 */
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { NO_SHOW_WINDOW, type ManagerBookingDetail } from '@pitchup/shared'
import { Alert } from '@/components/ui/Alert'
import { send } from '@/lib/http'

export function BookingActions({ booking: b }: { booking: ManagerBookingDetail }) {
  const router = useRouter()
  const dialog = useRef<HTMLDialogElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reason, setReason] = useState('')

  const act = async (action: 'attended' | 'no-show' | 'complete', body: object = {}) => {
    setBusy(true)
    setError(null)
    try {
      await send(`/api/v1/manager/bookings/${b.id}/${action}`, 'POST', body)
      dialog.current?.close()
      router.refresh()
    } catch (caught) {
      setError((caught as Error).message)
    }
    setBusy(false)
  }

  const none = !b.canConfirmAttended && !b.canReportNoShow && !b.canComplete
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
      <div className="flex flex-wrap gap-2">
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
