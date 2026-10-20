'use client'

/**
 * The review form — E06-10 (UIUX_SPEC §8.4 for the web): stars, optional
 * text (10–500 characters), up to three photos when Cloudinary is set up,
 * and posting anonymously.
 *
 * The stars are a radio group, so they work from the keyboard (arrow keys)
 * and are read out as "4 stars, Good"; hovering previews a rating.
 */
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ImagePlus, Star, X } from 'lucide-react'
import { REVIEW, type BookingDetail } from '@pitchup/shared'
import { Alert } from '@/components/ui/Alert'
import { uploadToCloudinary } from '@/lib/upload-client'
import { useT } from '@/i18n/client'

interface Props {
  bookingId: string
  existing: BookingDetail['review']
  photosEnabled: boolean
  /** Where to go once saved; the booking by default. */
  returnTo?: string | undefined
}

export function ReviewForm({ bookingId, existing, photosEnabled, returnTo }: Props) {
  const t = useT()
  const label = (n: number) => (n ? t(`myBookings.review.labels.${n as 1 | 2 | 3 | 4 | 5}`) : '')
  const router = useRouter()
  const [rating, setRating] = useState(existing?.rating ?? 0)
  const [hover, setHover] = useState(0)
  const [text, setText] = useState(existing?.text ?? '')
  const [anonymous, setAnonymous] = useState(existing?.isAnonymous ?? false)
  const [photos, setPhotos] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tried, setTried] = useState(false)

  const trimmed = text.trim()
  const textError =
    trimmed.length > 0 && trimmed.length < REVIEW.MIN_TEXT_LENGTH
      ? t('myBookings.review.minText', { min: REVIEW.MIN_TEXT_LENGTH })
      : null
  const shown = hover || rating

  const addPhotos = async (files: FileList | null) => {
    if (!files) return
    setUploading(true)
    setError(null)
    for (const file of [...files].slice(0, REVIEW.MAX_PHOTOS - photos.length)) {
      try {
        const url = await uploadToCloudinary('REVIEW', bookingId, file)
        setPhotos(p => [...p, url])
      } catch {
        setError(t('myBookings.review.photoFailed'))
      }
    }
    setUploading(false)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (!rating || textError) return
    setBusy(true)
    setError(null)
    const body = existing
      ? { rating, text: trimmed, isAnonymous: anonymous }
      : {
          bookingId,
          rating,
          ...(trimmed ? { text: trimmed } : {}),
          ...(photos.length ? { photoUrls: photos } : {}),
          isAnonymous: anonymous,
        }
    const res = await fetch(existing ? `/api/v1/reviews/${existing.id}` : '/api/v1/reviews', {
      method: existing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok || json?.error) {
      setError(json?.error?.message ?? t('myBookings.review.saveFailed'))
      setBusy(false)
      return
    }
    router.push(returnTo ?? `/my-bookings/${bookingId}?reviewed=1`)
    router.refresh()
  }

  return (
    <form onSubmit={submit} noValidate className="mt-6 space-y-6">
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-neutral-700">
          {t('myBookings.review.yourRating')}
        </legend>
        <div
          role="radiogroup"
          aria-label={t('myBookings.review.rating')}
          className="flex gap-1"
          onMouseLeave={() => setHover(0)}
        >
          {[1, 2, 3, 4, 5].map(n => (
            <label
              key={n}
              onMouseEnter={() => setHover(n)}
              className="cursor-pointer rounded-md p-0.5 focus-within:ring-2 focus-within:ring-primary-600"
            >
              <input
                type="radio"
                name="rating"
                value={n}
                checked={rating === n}
                onChange={() => setRating(n)}
                className="sr-only"
                aria-label={t('myBookings.review.stars', { count: n, label: label(n) })}
              />
              <Star
                aria-hidden="true"
                className={`h-9 w-9 ${n <= shown ? 'fill-warning-500 text-warning-500' : 'text-neutral-300'}`}
              />
            </label>
          ))}
        </div>
        <p aria-live="polite" className="mt-1 h-5 text-sm font-medium text-neutral-700">
          {label(shown)}
        </p>
        {tried && !rating && (
          <p role="alert" className="text-sm text-error-600">
            {t('myBookings.review.chooseRating')}
          </p>
        )}
      </fieldset>

      <div>
        <label htmlFor="review-text" className="mb-1 block text-sm font-medium text-neutral-700">
          {t('myBookings.review.yourReview')}{' '}
          <span className="font-normal text-neutral-500">{t('myBookings.review.optional')}</span>
        </label>
        <textarea
          id="review-text"
          rows={5}
          maxLength={REVIEW.MAX_TEXT_LENGTH}
          placeholder={t('myBookings.review.placeholder')}
          value={text}
          onChange={e => setText(e.target.value)}
          aria-invalid={!!textError}
          aria-describedby="review-text-help"
          className="w-full rounded-md border border-neutral-200 p-3 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-600"
        />
        <div id="review-text-help" className="flex justify-between text-xs">
          <span className="text-error-600">{textError}</span>
          <span className="text-neutral-500">
            {text.length} / {REVIEW.MAX_TEXT_LENGTH}
          </span>
        </div>
      </div>

      {photosEnabled && (
        <div>
          <p className="mb-2 text-sm font-medium text-neutral-700">
            {t('myBookings.review.photos')}{' '}
            <span className="font-normal text-neutral-500">
              {t('myBookings.review.upTo', { count: REVIEW.MAX_PHOTOS })}
            </span>
          </p>
          <div className="flex gap-2">
            {photos.map(url => (
              <span key={url} className="relative">
                <img
                  src={url}
                  alt={t('myBookings.review.yourPhoto')}
                  className="h-20 w-20 rounded-md object-cover"
                />
                <button
                  type="button"
                  aria-label={t('myBookings.review.removePhoto')}
                  onClick={() => setPhotos(p => p.filter(x => x !== url))}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900 text-white"
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              </span>
            ))}
            {photos.length < REVIEW.MAX_PHOTOS && (
              <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-md border border-dashed border-neutral-300 text-neutral-500 focus-within:ring-2 focus-within:ring-primary-600">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="sr-only"
                  disabled={uploading}
                  onChange={e => addPhotos(e.target.files)}
                />
                <span className="sr-only">{t('myBookings.review.addPhotos')}</span>
                {uploading ? (
                  <span className="h-6 w-6 animate-pulse rounded-full bg-neutral-200" />
                ) : (
                  <ImagePlus className="h-6 w-6" aria-hidden="true" />
                )}
              </label>
            )}
          </div>
        </div>
      )}

      <label className="flex cursor-pointer items-start justify-between gap-4">
        <span>
          <span className="block text-sm font-medium text-neutral-900">
            {t('myBookings.review.anonymous')}
          </span>
          <span className="block text-sm text-neutral-700">
            {t('myBookings.review.anonymousHint')}
          </span>
        </span>
        <input
          type="checkbox"
          role="switch"
          checked={anonymous}
          onChange={e => setAnonymous(e.target.checked)}
          className="mt-1 h-5 w-5 accent-primary-600"
        />
      </label>

      {error && <Alert>{error}</Alert>}

      <button
        type="submit"
        disabled={busy || uploading}
        aria-busy={busy || undefined}
        className="h-12 w-full rounded-md bg-primary-600 font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
      >
        {busy
          ? t('myBookings.review.saving')
          : existing
            ? t('myBookings.review.saveChanges')
            : t('myBookings.review.submit')}
      </button>
    </form>
  )
}
