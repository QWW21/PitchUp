'use client'

/** Delete a review for good, telling the author why — E15-08. */
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { send } from '@/lib/http'

export function DeleteReviewButton({ reviewId, pitch }: { reviewId: string; pitch: string }) {
  const router = useRouter()
  const dialog = useRef<HTMLDialogElement>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const remove = async () => {
    setBusy(true)
    setError(null)
    try {
      await send(`/api/v1/admin/reviews/${reviewId}`, 'DELETE', { reason: reason.trim() })
      dialog.current?.close()
      router.refresh()
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
        className="mt-3 h-9 rounded-md border border-error-500 px-3 text-sm font-semibold text-error-600 hover:bg-error-50"
      >
        Delete…
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={`del-${reviewId}`}
        className="w-[min(28rem,calc(100%-2rem))] rounded-xl p-6 shadow-xl backdrop:bg-black/40"
        onClick={e => e.target === dialog.current && dialog.current?.close()}
      >
        <h2 id={`del-${reviewId}`} className="text-lg font-semibold text-neutral-900">
          Delete this review of {pitch}?
        </h2>
        <p className="mt-1 text-sm text-neutral-700">
          It&rsquo;s removed for good, with its reports. The author reads your reason.
        </p>
        <label className="mt-4 block text-sm font-medium text-neutral-700">
          Reason
          <textarea
            rows={3}
            maxLength={300}
            value={reason}
            onChange={e => setReason(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-200 p-3 text-sm"
          />
        </label>
        {error && (
          <div className="mt-3">
            <Alert>{error}</Alert>
          </div>
        )}
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
            disabled={busy || reason.trim().length < 10}
            onClick={() => void remove()}
            className="h-10 rounded-md bg-error-600 px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {busy ? 'Deleting…' : 'Delete review'}
          </button>
        </div>
      </dialog>
    </>
  )
}
