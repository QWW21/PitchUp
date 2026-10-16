'use client'

/**
 * Approve, or send back with a reason (a dialog) — the admin step agreed for
 * E09; with `changes`, the same for an approved venue's new details (C-13).
 */
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { send } from '@/lib/http'

export function CompanyDecision({
  companyId,
  companyName,
  changes = false,
}: {
  companyId: string
  companyName: string
  changes?: boolean
}) {
  const router = useRouter()
  const dialog = useRef<HTMLDialogElement>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const decide = async (action: 'approve' | 'reject') => {
    setBusy(true)
    setError(null)
    try {
      await send(
        `/api/v1/admin/${changes ? 'venue-changes' : 'companies'}/${companyId}/${action}`,
        'POST',
        action === 'reject' ? { reason } : {}
      )
      dialog.current?.close()
      router.refresh()
    } catch (caught) {
      setError((caught as Error).message)
    }
    setBusy(false)
  }

  return (
    <div className="mt-4 border-t border-neutral-100 pt-4">
      {error && (
        <div className="mb-3">
          <Alert>{error}</Alert>
        </div>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void decide('approve')}
          disabled={busy}
          className="h-10 rounded-md bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
        >
          {changes ? 'Approve changes' : 'Approve'}
        </button>
        <button
          type="button"
          onClick={() => dialog.current?.showModal()}
          disabled={busy}
          className="h-10 rounded-md border border-neutral-200 px-4 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 disabled:opacity-60"
        >
          {changes ? 'Turn down…' : 'Send back…'}
        </button>
      </div>
      <dialog
        ref={dialog}
        aria-labelledby={`reject-${changes ? 'changes-' : ''}${companyId}`}
        className="w-[min(28rem,calc(100%-2rem))] rounded-xl p-6 shadow-xl backdrop:bg-black/40"
        onClick={e => e.target === dialog.current && dialog.current?.close()}
      >
        <h2
          id={`reject-${changes ? 'changes-' : ''}${companyId}`}
          className="text-lg font-semibold text-neutral-900"
        >
          {changes ? `Turn down ${companyName}'s changes` : `Send ${companyName} back`}
        </h2>
        <p className="mt-1 text-sm text-neutral-700">
          {changes
            ? 'The manager sees this reason; the venue keeps its current details.'
            : 'The manager sees this reason and can fix the venue and submit again.'}
        </p>
        <label
          htmlFor={`reason-${changes ? 'changes-' : ''}${companyId}`}
          className="mt-4 block text-sm font-medium text-neutral-700"
        >
          What needs fixing
        </label>
        <textarea
          id={`reason-${changes ? 'changes-' : ''}${companyId}`}
          rows={4}
          maxLength={500}
          value={reason}
          onChange={e => setReason(e.target.value)}
          className="mt-1 w-full rounded-md border border-neutral-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
        />
        {error && <Alert>{error}</Alert>}
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
            onClick={() => void decide('reject')}
            disabled={busy || reason.trim().length < 5}
            className="h-10 rounded-md bg-error-600 px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {busy ? 'Sending…' : changes ? 'Turn down' : 'Send back'}
          </button>
        </div>
      </dialog>
    </div>
  )
}
