'use client'

/**
 * One review on My Reviews — E07-08: pitch, day played, stars, the text
 * (folded after three lines), photos, the venue's reply, and Edit (while the
 * server says it is editable) and Delete (any time).
 */
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { formatDateLong, type MyReview } from '@pitchup/shared'
import { Stars, formatReviewDate } from '@/components/venue/bits'
import { send } from '@/lib/http'
import { useLocale, useT } from '@/i18n/client'

/** Roughly three lines at this width; shorter texts need no toggle. */
const FOLD_AT = 180

export function MyReviewCard({ review: r }: { review: MyReview }) {
  const t = useT()
  const locale = useLocale()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const long = (r.text?.length ?? 0) > FOLD_AT

  const remove = async () => {
    if (!window.confirm(t('myBookings.myReviews.deleteConfirm'))) return
    setBusy(true)
    setError(null)
    try {
      await send(`/api/v1/reviews/${r.id}`, 'DELETE')
      router.replace('/my-reviews?deleted=1')
      router.refresh()
    } catch (caught) {
      setError((caught as Error).message)
      setBusy(false)
    }
  }

  return (
    <article aria-labelledby={`review-${r.id}`} className="rounded-xl bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={`review-${r.id}`} className="font-semibold text-neutral-900">
            <Link href={`/discover/${r.company.id}/${r.pitch.id}`} className="hover:underline">
              {r.pitch.name}
            </Link>
          </h2>
          <p className="text-sm text-neutral-500">{r.company.name}</p>
        </div>
        <Stars rating={r.rating} />
      </div>
      <p className="mt-1 text-xs text-neutral-500">
        {t('myBookings.myReviews.played', {
          date: formatDateLong(r.bookingDate, locale),
          reviewed: formatReviewDate(r.createdAt, locale),
        })}
        {r.isAnonymous && t('myBookings.myReviews.anonymous')}
      </p>

      {r.text && (
        <>
          <p className={`mt-2 text-sm text-neutral-700 ${long && !open ? 'line-clamp-3' : ''}`}>
            {r.text}
          </p>
          {long && (
            <button
              type="button"
              onClick={() => setOpen(o => !o)}
              aria-expanded={open}
              className="mt-1 text-sm font-medium text-primary-700 hover:underline"
            >
              {open ? t('venue.showLess') : t('venue.showMore')}
            </button>
          )}
        </>
      )}

      {r.photoUrls.length > 0 && (
        <div className="mt-2 flex gap-2 overflow-x-auto">
          {r.photoUrls.map(url => (
            <img
              key={url}
              src={url}
              alt={t('myBookings.myReviews.photoAlt')}
              className="h-[60px] w-[60px] rounded object-cover"
            />
          ))}
        </div>
      )}

      {r.reply && (
        <div className="ml-3 mt-3 rounded-md bg-neutral-50 p-2">
          <p className="mb-1 text-[11px] font-medium uppercase text-neutral-500">
            {t('myBookings.myReviews.venueResponse')}
          </p>
          <p className="text-sm text-neutral-700">{r.reply.text}</p>
        </div>
      )}

      <div className="mt-3 flex items-center gap-4 text-sm">
        {r.isEditable && (
          <Link
            href={`/my-bookings/${r.bookingId}/review?from=my-reviews`}
            className="inline-flex items-center gap-1 font-medium text-primary-700 hover:underline"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
            {t('myBookings.myReviews.edit')}
          </Link>
        )}
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          className="ml-auto inline-flex items-center gap-1 font-medium text-error-600 hover:underline disabled:opacity-60"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          {busy ? t('myBookings.myReviews.deleting') : t('myBookings.myReviews.delete')}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-error-600">
          {error}
        </p>
      )}
    </article>
  )
}
