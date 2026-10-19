'use client'

/**
 * Suspend a live venue (with a reason the manager reads) or reinstate a
 * suspended one — E15-02/E15-06.
 */
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { send } from '@/lib/http'

export function CompanyStatusActions({
  companyId,
  companyName,
  status,
}: {
  companyId: string
  companyName: string
  status: string
}) {
  const router = useRouter()
  const dialog = useRef<HTMLDialogElement>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const change = async (next: 'ACTIVE' | 'SUSPENDED') => {
    setBusy(true)
    setError(null)
    try {
      await send(
        `/api/v1/admin/companies/${companyId}/status`,
        'PUT',
        next === 'SUSPENDED' ? { status: next, reason: reason.trim() } : { status: next }
      )
      dialog.current?.close()
      router.refresh()
    } catch (caught) {
      setError((caught as Error).message)
    }
    setBusy(false)
  }

  if (status === 'DRAFT') {
    return (
      <p className="mt-2 text-sm text-neutral-700">
        The manager is still onboarding; nothing to decide yet.
      </p>
    )
  }

  return (
    <div className="mt-3">
      {error && (
        <div className="mb-3">
          <Alert>{error}</Alert>
        </div>
      )}
      {status === 'ACTIVE' ? (
        <>
          <p className="text-sm text-neutral-700">
            Live on Discover. Suspending hides it and stops new bookings; bookings already made
            stay.
          </p>
          <button
            type="button"
            onClick={() => dialog.current?.showModal()}
            disabled={busy}
            className="mt-3 h-10 rounded-md border border-error-500 px-4 text-sm font-semibold text-error-600 hover:bg-error-50 disabled:opacity-60"
          >
            Suspend venue…
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => void change('ACTIVE')}
          disabled={busy}
          className="h-10 rounded-md bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
        >
          {busy ? 'Reinstating…' : 'Reinstate venue'}
        </button>
      )}
      <dialog
        ref={dialog}
        aria-labelledby={`suspend-${companyId}`}
        className="w-[min(28rem,calc(100%-2rem))] rounded-xl p-6 shadow-xl backdrop:bg-black/40"
        onClick={e => e.target === dialog.current && dialog.current?.close()}
      >
        <h2 id={`suspend-${companyId}`} className="text-lg font-semibold text-neutral-900">
          Suspend {companyName}?
        </h2>
        <p className="mt-1 text-sm text-neutral-700">The manager reads this reason.</p>
        <label
          htmlFor={`suspend-reason-${companyId}`}
          className="mt-4 block text-sm font-medium text-neutral-700"
        >
          Why
        </label>
        <textarea
          id={`suspend-reason-${companyId}`}
          rows={3}
          maxLength={500}
          value={reason}
          onChange={e => setReason(e.target.value)}
          className="mt-1 w-full rounded-md border border-neutral-200 p-3 text-sm"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            className="h-10 rounded-md px-4 text-sm font-semibold text-neutral-700 hover:bg-neutral-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void change('SUSPENDED')}
            disabled={busy || reason.trim().length < 5}
            className="h-10 rounded-md bg-error-600 px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {busy ? 'Suspending…' : 'Suspend'}
          </button>
        </div>
      </dialog>
    </div>
  )
}
