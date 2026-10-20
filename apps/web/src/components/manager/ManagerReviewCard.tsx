'use client'

/**
 * One review on reviews management — E07-09: pitch, player, date, stars, the
 * full text and photos, the venue's reply (write, edit for 24 hours, delete)
 * and Report.
 */
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { REVIEW, type ManagerReview } from '@pitchup/shared'
import { Stars, formatReviewDate } from '@/components/venue/bits'
import { ReportReview } from '@/components/venue/ReportReview'
import { send } from '@/lib/http'
import { useLocale, useT } from '@/i18n/client'

export function ManagerReviewCard({ review: r }: { review: ManagerReview }) {
  const t = useT()
  const locale = useLocale()
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const removeReply = async () => {
    if (!window.confirm(t('mVenue.reviews.deleteReply'))) return
    setError(null)
    try {
      await send(`/api/v1/reviews/${r.id}/reply`, 'DELETE')
      router.refresh()
    } catch (caught) {
      setError((caught as Error).message)
    }
  }

  return (
    <article aria-labelledby={`mr-${r.id}`} className="rounded-xl bg-white p-4 shadow-sm">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-700">
          {r.pitch.name}
        </span>
        <h2 id={`mr-${r.id}`} className="text-sm font-medium text-neutral-900">
          {r.playerName}
        </h2>
        <span className="text-xs text-neutral-500">{formatReviewDate(r.createdAt, locale)}</span>
        <span className="ml-auto">
          <Stars rating={r.rating} />
        </span>
      </header>
      {r.text ? (
        <p className="mt-2 text-sm text-neutral-700">{r.text}</p>
      ) : (
        <p className="mt-2 text-sm italic text-neutral-500">{t('mVenue.reviews.noComment')}</p>
      )}
      {r.photoUrls.length > 0 && (
        <div className="mt-2 flex gap-2 overflow-x-auto">
          {r.photoUrls.map(url => (
            <img
              key={url}
              src={url}
              alt={t('mVenue.reviews.photo')}
              className="h-16 w-16 rounded object-cover"
            />
          ))}
        </div>
      )}

      <div className="mt-3">
        {r.reply && !editing ? (
          <div className="ml-3 rounded-md bg-neutral-50 p-2">
            <p className="mb-1 text-[11px] font-medium uppercase text-neutral-500">
              {t('mVenue.reviews.yourReply', { date: formatReviewDate(r.reply.createdAt, locale) })}
            </p>
            <p className="text-sm text-neutral-700">{r.reply.text}</p>
            <div className="mt-2 flex items-center gap-4 text-sm">
              {r.reply.isEditable && (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="font-medium text-primary-700 hover:underline"
                >
                  {t('mVenue.reviews.edit')}
                </button>
              )}
              <button
                type="button"
                onClick={removeReply}
                className="inline-flex items-center gap-1 font-medium text-error-600 hover:underline"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                {t('mVenue.reviews.delete')}
              </button>
            </div>
          </div>
        ) : (
          <ReplyForm
            reviewId={r.id}
            existing={editing ? r.reply?.text : undefined}
            onDone={() => {
              setEditing(false)
              router.refresh()
            }}
            onCancel={editing ? () => setEditing(false) : undefined}
          />
        )}
        {error && (
          <p role="alert" className="mt-2 text-sm text-error-600">
            {error}
          </p>
        )}
      </div>

      <footer className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-2">
        <span className="text-xs text-neutral-500">
          {r.reportCount > 0 && t('mVenue.reviews.reported', { count: r.reportCount })}
        </span>
        <ReportReview reviewId={r.id} initiallyReported={r.reportedByMe} />
      </footer>
    </article>
  )
}

/** "Reply to this review": collapsed until opened. Also edits a reply. */
function ReplyForm({
  reviewId,
  existing,
  onDone,
  onCancel,
}: {
  reviewId: string
  existing?: string | undefined
  onDone: () => void
  onCancel?: (() => void) | undefined
}) {
  const t = useT()
  const editing = existing !== undefined
  const [open, setOpen] = useState(editing)
  const [text, setText] = useState(existing ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const max = REVIEW.MAX_MANAGER_REPLY_LENGTH

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-medium text-primary-700 hover:underline"
      >
        {t('mVenue.reviews.reply')}
      </button>
    )
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await send(`/api/v1/reviews/${reviewId}/reply`, editing ? 'PUT' : 'POST', { reply: text })
      setOpen(false)
      setText('')
      onDone()
    } catch (caught) {
      setError((caught as Error).message)
    }
    setBusy(false)
  }

  return (
    <form onSubmit={submit} noValidate className="ml-3">
      <label htmlFor={`reply-${reviewId}`} className="block text-sm font-medium text-neutral-700">
        {t('mVenue.reviews.replyLabel')}
      </label>
      <textarea
        id={`reply-${reviewId}`}
        rows={3}
        maxLength={max}
        value={text}
        onChange={e => setText(e.target.value)}
        autoFocus
        className="mt-1 w-full rounded-md border border-neutral-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
      />
      <div className="flex items-center justify-between">
        <p className="text-xs text-neutral-500">
          {text.length} / {max}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => (onCancel ? onCancel() : setOpen(false))}
            className="h-9 rounded-md px-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-100"
          >
            {t('mVenue.reviews.cancel')}
          </button>
          <button
            type="submit"
            disabled={busy || !text.trim()}
            className="h-9 rounded-md bg-primary-600 px-3 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
          >
            {busy
              ? t('mVenue.reviews.saving')
              : editing
                ? t('mVenue.reviews.save')
                : t('mVenue.reviews.post')}
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-1 text-sm text-error-600">
          {error}
        </p>
      )}
    </form>
  )
}
