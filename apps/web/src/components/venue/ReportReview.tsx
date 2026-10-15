'use client'

/**
 * "Report" on a review — E07-04 (PRD §11.3). A reason is required, a note is
 * optional. The review stays up; an admin decides.
 */
import { useRef, useState } from 'react'
import { Flag } from 'lucide-react'
import {
  REPORT_CATEGORIES,
  REPORT_CATEGORY_LABELS,
  REVIEW,
  type ReportCategory,
} from '@pitchup/shared'
import { Alert } from '@/components/ui/Alert'
import { send } from '@/lib/http'

export function ReportReview({
  reviewId,
  onReported,
  initiallyReported = false,
}: {
  reviewId: string
  onReported?: () => void
  initiallyReported?: boolean
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [category, setCategory] = useState<ReportCategory | null>(null)
  const [detail, setDetail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(initiallyReported)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!category) {
      setError('Choose a reason.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await send(`/api/v1/reviews/${reviewId}/report`, 'POST', { category, detail })
      setDone(true)
      dialog.current?.close()
      onReported?.()
    } catch (caught) {
      setError((caught as Error).message)
    }
    setBusy(false)
  }

  if (done) {
    return (
      <p role="status" className="text-xs text-neutral-500">
        Reported. Thanks, we&rsquo;ll take a look.
      </p>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-700"
      >
        <Flag className="h-3.5 w-3.5" aria-hidden="true" />
        Report
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={`report-title-${reviewId}`}
        className="w-[min(28rem,calc(100%-2rem))] rounded-xl p-6 shadow-xl backdrop:bg-black/40"
        onClick={e => e.target === dialog.current && dialog.current?.close()}
      >
        <form onSubmit={submit} noValidate>
          <h2 id={`report-title-${reviewId}`} className="text-lg font-semibold text-neutral-900">
            Report this review
          </h2>
          <p className="mt-1 text-sm text-neutral-700">It stays up while an admin looks at it.</p>
          <fieldset className="mt-4">
            <legend className="text-sm font-medium text-neutral-700">Reason</legend>
            <div className="mt-2 space-y-2">
              {REPORT_CATEGORIES.map(c => (
                <label key={c} className="flex items-center gap-2 text-sm text-neutral-900">
                  <input
                    type="radio"
                    name={`reason-${reviewId}`}
                    value={c}
                    checked={category === c}
                    onChange={() => setCategory(c)}
                    className="h-4 w-4 accent-primary-600"
                  />
                  {REPORT_CATEGORY_LABELS[c]}
                </label>
              ))}
            </div>
          </fieldset>
          <label
            htmlFor={`report-detail-${reviewId}`}
            className="mt-4 block text-sm font-medium text-neutral-700"
          >
            Anything to add? (optional)
          </label>
          <textarea
            id={`report-detail-${reviewId}`}
            rows={3}
            maxLength={REVIEW.MAX_REPORT_DETAIL_LENGTH}
            value={detail}
            onChange={e => setDetail(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
          />
          {error && (
            <div className="mt-2">
              <Alert>{error}</Alert>
            </div>
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
              type="submit"
              disabled={busy}
              className="h-10 rounded-md bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
            >
              {busy ? 'Sending…' : 'Send report'}
            </button>
          </div>
        </form>
      </dialog>
    </>
  )
}
