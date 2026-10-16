'use client'

/** Confirm attended and Report no-show for one booking — C-8. No-show asks first. */
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import type { ManagerBooking } from '@pitchup/shared'
import { Alert } from '@/components/ui/Alert'
import { send } from '@/lib/http'

export function BookingRowActions({ booking: b }: { booking: ManagerBooking }) {
  const router = useRouter()
  const dialog = useRef<HTMLDialogElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const act = async (action: 'attended' | 'no-show') => {
    setBusy(true)
    setError(null)
    try {
      await send(`/api/v1/manager/bookings/${b.id}/${action}`, 'POST', {})
      dialog.current?.close()
      router.refresh()
    } catch (caught) {
      setError((caught as Error).message)
    }
    setBusy(false)
  }

  const refundsDeposit = b.paymentMethod === 'VENUE_REFUND_DEPOSIT' && !!b.deposit

  return (
    <>
      {b.canConfirmAttended && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void act('attended')}
          className="h-9 rounded-md bg-primary-600 px-3 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
        >
          Confirm attended
        </button>
      )}
      {b.canReportNoShow && (
        <button
          type="button"
          disabled={busy}
          onClick={() => dialog.current?.showModal()}
          className="h-9 rounded-md border border-neutral-200 px-3 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 disabled:opacity-60"
        >
          Report no-show
        </button>
      )}
      {error && (
        <div className="w-full">
          <Alert>{error}</Alert>
        </div>
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
          {b.deposit
            ? `You keep the ${b.deposit} RON deposit. `
            : b.paymentMethod === 'ONLINE'
              ? `You keep the ${b.total} RON paid online. `
              : 'There is no deposit to keep. '}
          The player loses 20 trust points and can dispute it within 24 hours.
        </p>
        {refundsDeposit && (
          <p className="mt-2 text-sm text-neutral-700">
            If they did come, use Confirm attended instead: their deposit is refunded.
          </p>
        )}
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
            onClick={() => void act('no-show')}
            className="h-10 rounded-md bg-error-600 px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {busy ? 'Reporting…' : 'Report no-show'}
          </button>
        </div>
      </dialog>
    </>
  )
}
