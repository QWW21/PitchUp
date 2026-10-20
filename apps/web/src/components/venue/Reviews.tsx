'use client'

import { useEffect, useRef, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { MessageSquare, X } from 'lucide-react'
import { REVIEW_SORTS, type ReviewItem, type ReviewPage, type ReviewSort } from '@pitchup/shared'
import { Button } from '@/components/ui/Button'
import { Stars, formatReviewDate } from './bits'
import { ReportReview } from './ReportReview'
import { useLocale, useT } from '@/i18n/client'

/** True once the element has scrolled into view (and stays true). */
function useSeen<T extends Element>() {
  const ref = useRef<T>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || seen) return
    // Without IntersectionObserver (old browsers), just show it.
    if (typeof IntersectionObserver === 'undefined') {
      setSeen(true)
      return
    }
    const io = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) setSeen(true)
    })
    io.observe(el)
    return () => io.disconnect()
  }, [seen])
  return [ref, seen] as const
}

/**
 * Big number, stars, and a 5★→1★ bar per star. UIUX_SPEC §6.1. The bars grow
 * when the chart scrolls into view (E07-10).
 */
export function RatingBreakdown({ page }: { page: ReviewPage }) {
  const t = useT()
  const max = page.total || 1
  const [ref, seen] = useSeen<HTMLDivElement>()
  return (
    <div ref={ref} className="flex flex-col gap-6 sm:flex-row sm:items-center">
      <div className="shrink-0">
        <p className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-neutral-900">
            {page.avgRating !== null ? page.avgRating.toFixed(1) : '–'}
          </span>
          <span className="text-sm text-neutral-500">{t('venue.rating.outOf5Short')}</span>
        </p>
        {page.avgRating !== null ? (
          <div className="mt-2">
            <Stars rating={page.avgRating} size={24} />
          </div>
        ) : (
          <p className="mt-2 text-sm text-neutral-500">{t('venue.rating.notRated')}</p>
        )}
        <p className="mt-2 text-xs text-neutral-500">
          {t('venue.rating.reviews', { count: page.total })}
        </p>
      </div>
      <div className="w-full max-w-sm space-y-1.5">
        {([5, 4, 3, 2, 1] as const).map(star => {
          const count = page.distribution[star]
          return (
            <div key={star} className="flex items-center gap-2 text-xs text-neutral-500">
              <span className="w-8">{star} ★</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-200">
                <div
                  className="h-full rounded-full bg-primary-600 transition-[width] duration-[600ms] ease-out"
                  style={{ width: seen ? `${(count / max) * 100}%` : 0 }}
                />
              </div>
              <span className="w-8 text-right">{count}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Avatar({ review }: { review: ReviewItem }) {
  if (review.isAnonymous) {
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-200 text-xs font-medium text-neutral-500">
        ?
      </span>
    )
  }
  if (review.playerAvatarUrl) {
    return (
      // A plain img: next/image would need every avatar host allow-listed.
      <img src={review.playerAvatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
    )
  }
  const initials = review.playerName
    .replace('.', '')
    .split(' ')
    .map(p => p[0])
    .join('')
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-[11px] font-medium text-primary-700">
      {initials}
    </span>
  )
}

export function ReviewCard({
  review,
  compact = false,
  showPitch = false,
  canReport = false,
}: {
  review: ReviewItem
  /** Pitch-page preview: three lines, no photos, no reply. */
  compact?: boolean
  showPitch?: boolean
  /** Signed in: offer "Report" (E07-04). */
  canReport?: boolean
}) {
  const t = useT()
  const locale = useLocale()
  const [lightbox, setLightbox] = useState<string | null>(null)
  return (
    <article className="border-b border-neutral-200 py-4 last:border-b-0">
      <header className="flex items-center gap-3">
        <Avatar review={review} />
        <div className="flex-1">
          <p
            className={`text-[13px] font-medium ${review.isAnonymous ? 'text-neutral-500' : 'text-neutral-900'}`}
          >
            {review.playerName}
          </p>
          <p className="text-xs text-neutral-500">
            {formatReviewDate(review.createdAt, locale)}
            {showPitch && ` · ${review.pitchName}`}
          </p>
        </div>
        {canReport && !compact && <ReportReview reviewId={review.id} />}
      </header>
      <div className="mt-1.5">
        <Stars rating={review.rating} />
      </div>
      {review.text && (
        <p className={`mt-2 text-sm text-neutral-700 ${compact ? 'line-clamp-3' : ''}`}>
          {review.text}
        </p>
      )}
      {!compact && review.photoUrls.length > 0 && (
        <div className="mt-2 flex gap-2 overflow-x-auto">
          {review.photoUrls.map(url => (
            <button key={url} type="button" onClick={() => setLightbox(url)} className="shrink-0">
              <img
                src={url}
                alt={t('venue.reviews.photoAlt')}
                className="h-20 w-20 rounded-md object-cover"
              />
            </button>
          ))}
        </div>
      )}
      {!compact && review.managerReply && (
        <div className="ml-3 mt-3 rounded-md bg-neutral-50 p-2">
          <p className="mb-1 text-[11px] font-medium uppercase text-neutral-500">
            {t('venue.reviews.venueResponse')}
            {review.managerRepliedAt && ` · ${formatReviewDate(review.managerRepliedAt, locale)}`}
          </p>
          <p className="text-sm text-neutral-700">{review.managerReply}</p>
        </div>
      )}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            aria-label={t('venue.reviews.closePhoto')}
            className="absolute right-4 top-4 rounded-full bg-white/15 p-2 text-white"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={lightbox}
            alt={t('venue.reviews.photoAlt')}
            className="max-h-full max-w-full object-contain"
          />
        </div>
      )}
    </article>
  )
}

async function fetchReviews(query: string, page: number): Promise<ReviewPage> {
  const res = await fetch(`/api/v1/reviews?${query}&page=${page}&limit=10`)
  const body = await res.json().catch(() => null)
  if (!res.ok || !body?.data) throw new Error(body?.error?.message ?? res.statusText)
  return body.data as ReviewPage
}

const isSort = (v: string | undefined): v is ReviewSort =>
  (REVIEW_SORTS as readonly string[]).includes(v ?? '')

/**
 * Breakdown + list, for a company (optionally one pitch). E04-07, E04-08;
 * E07-10 adds the order (kept in the URL as ?sort=) and loads the next page
 * by itself as the end of the list scrolls into view.
 */
export function ReviewsList({
  companyId,
  pitches,
  initialPitchId,
  initialSort,
  signedIn = false,
}: {
  companyId: string
  pitches: { id: string; name: string }[]
  initialPitchId?: string | undefined
  initialSort?: string | undefined
  signedIn?: boolean
}) {
  const t = useT()
  const [pitchId, setPitchId] = useState(initialPitchId ?? '')
  const [sort, setSort] = useState<ReviewSort>(isSort(initialSort) ? initialSort : 'newest')
  const query = `${pitchId ? `pitchId=${pitchId}` : `companyId=${companyId}`}&sort=${sort}`

  const chooseSort = (next: ReviewSort) => {
    setSort(next)
    const q = new URLSearchParams(window.location.search)
    if (next === 'newest') q.delete('sort')
    else q.set('sort', next)
    // As in CompanyTabs: the browser's own call, so the page is not refetched.
    window.history.replaceState(null, '', `${window.location.pathname}${q.size ? `?${q}` : ''}`)
  }

  const reviews = useInfiniteQuery({
    queryKey: ['reviews', query],
    queryFn: ({ pageParam }) => fetchReviews(query, pageParam),
    initialPageParam: 1,
    getNextPageParam: last => (last.hasMore ? last.page + 1 : undefined),
  })

  const first = reviews.data?.pages[0]
  const items = reviews.data?.pages.flatMap(p => p.reviews) ?? []

  // The end of the list in view: fetch the next page. The button stays for
  // keyboards and browsers without IntersectionObserver.
  const end = useRef<HTMLDivElement>(null)
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = reviews
  useEffect(() => {
    const el = end.current
    if (!el || !hasNextPage || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting && !isFetchingNextPage) void fetchNextPage()
    })
    io.observe(el)
    return () => io.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  return (
    <div>
      {pitches.length > 1 && (
        <label className="mb-6 flex items-center gap-2 text-sm text-neutral-700">
          {t('venue.reviews.showFor')}
          <select
            value={pitchId}
            onChange={e => setPitchId(e.target.value)}
            className="h-9 rounded-md border border-neutral-200 bg-white px-2 text-sm"
          >
            <option value="">{t('venue.reviews.allPitches')}</option>
            {pitches.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <div role="group" aria-label={t('venue.reviews.sort')} className="mb-6 flex flex-wrap gap-2">
        {REVIEW_SORTS.map(s => (
          <button
            key={s}
            type="button"
            aria-pressed={sort === s}
            onClick={() => chooseSort(s)}
            className={`h-9 rounded-full px-4 text-sm font-medium ${
              sort === s
                ? 'bg-primary-600 text-white'
                : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
            }`}
          >
            {t(`reviewSort.${s}`)}
          </button>
        ))}
      </div>

      {reviews.isPending ? (
        <div className="h-40 animate-pulse rounded-xl bg-neutral-100" />
      ) : reviews.isError ? (
        <div className="py-10 text-center text-sm text-neutral-500">
          {t('venue.reviews.loadError')}{' '}
          <button
            type="button"
            onClick={() => void reviews.refetch()}
            className="font-medium text-primary-600"
          >
            {t('common.retry')}
          </button>
        </div>
      ) : first && first.total === 0 ? (
        <div className="flex flex-col items-center py-12 text-center">
          <MessageSquare className="h-12 w-12 text-neutral-300" aria-hidden="true" />
          <p className="mt-3 font-semibold text-neutral-900">{t('venue.reviews.none')}</p>
          <p className="mt-1 text-sm text-neutral-500">{t('venue.reviews.beFirst')}</p>
        </div>
      ) : (
        <>
          {first && <RatingBreakdown page={first} />}
          <div className="mt-6">
            {items.map(r => (
              <ReviewCard
                key={r.id}
                review={r}
                showPitch={!pitchId && pitches.length > 1}
                canReport={signedIn}
              />
            ))}
          </div>
          {reviews.hasNextPage && (
            <div ref={end} className="mt-4 flex justify-center">
              <div className="w-48">
                <Button
                  variant="secondary"
                  loading={reviews.isFetchingNextPage}
                  onClick={() => void reviews.fetchNextPage()}
                >
                  {t('venue.reviews.loadMore')}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
