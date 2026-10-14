'use client'

import { useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { MessageSquare, X } from 'lucide-react'
import type { ReviewItem, ReviewPage } from '@pitchup/shared'
import { Button } from '@/components/ui/Button'
import { Stars, formatReviewDate } from './bits'

/** Big number, stars, and a 5★→1★ bar per star. UIUX_SPEC §6.1. */
export function RatingBreakdown({ page }: { page: ReviewPage }) {
  const max = page.total || 1
  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
      <div className="shrink-0">
        <p className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-neutral-900">
            {page.avgRating !== null ? page.avgRating.toFixed(1) : '–'}
          </span>
          <span className="text-sm text-neutral-500">out of 5</span>
        </p>
        {page.avgRating !== null ? (
          <div className="mt-2">
            <Stars rating={page.avgRating} size={24} />
          </div>
        ) : (
          <p className="mt-2 text-sm text-neutral-400">Not rated yet</p>
        )}
        <p className="mt-2 text-xs text-neutral-500">
          {page.total} {page.total === 1 ? 'review' : 'reviews'}
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
                  className="h-full rounded-full bg-primary-600 transition-[width] duration-700"
                  style={{ width: `${(count / max) * 100}%` }}
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
}: {
  review: ReviewItem
  /** Pitch-page preview: three lines, no photos, no reply. */
  compact?: boolean
  showPitch?: boolean
}) {
  const [lightbox, setLightbox] = useState<string | null>(null)
  return (
    <article className="border-b border-neutral-200 py-4 last:border-b-0">
      <header className="flex items-center gap-3">
        <Avatar review={review} />
        <div>
          <p
            className={`text-[13px] font-medium ${review.isAnonymous ? 'text-neutral-500' : 'text-neutral-900'}`}
          >
            {review.playerName}
          </p>
          <p className="text-xs text-neutral-400">
            {formatReviewDate(review.createdAt)}
            {showPitch && ` · ${review.pitchName}`}
          </p>
        </div>
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
              <img src={url} alt="Review photo" className="h-20 w-20 rounded-md object-cover" />
            </button>
          ))}
        </div>
      )}
      {!compact && review.managerReply && (
        <div className="ml-3 mt-3 rounded-md bg-neutral-50 p-2">
          <p className="mb-1 text-[11px] font-medium uppercase text-neutral-500">
            Response from manager
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
            aria-label="Close photo"
            className="absolute right-4 top-4 rounded-full bg-white/15 p-2 text-white"
          >
            <X className="h-5 w-5" />
          </button>
          <img src={lightbox} alt="Review photo" className="max-h-full max-w-full object-contain" />
        </div>
      )}
    </article>
  )
}

async function fetchReviews(query: string, page: number): Promise<ReviewPage> {
  const res = await fetch(`/api/v1/reviews?${query}&page=${page}&limit=10`)
  const body = await res.json().catch(() => null)
  if (!res.ok || !body?.data) throw new Error(body?.error?.message ?? 'Request failed')
  return body.data as ReviewPage
}

/** Breakdown + paginated list, for a company (optionally one pitch). E04-07, E04-08. */
export function ReviewsList({
  companyId,
  pitches,
  initialPitchId,
}: {
  companyId: string
  pitches: { id: string; name: string }[]
  initialPitchId?: string | undefined
}) {
  const [pitchId, setPitchId] = useState(initialPitchId ?? '')
  const query = pitchId ? `pitchId=${pitchId}` : `companyId=${companyId}`

  const reviews = useInfiniteQuery({
    queryKey: ['reviews', query],
    queryFn: ({ pageParam }) => fetchReviews(query, pageParam),
    initialPageParam: 1,
    getNextPageParam: last => (last.hasMore ? last.page + 1 : undefined),
  })

  const first = reviews.data?.pages[0]
  const items = reviews.data?.pages.flatMap(p => p.reviews) ?? []

  return (
    <div>
      {pitches.length > 1 && (
        <label className="mb-6 flex items-center gap-2 text-sm text-neutral-700">
          Show reviews for
          <select
            value={pitchId}
            onChange={e => setPitchId(e.target.value)}
            className="h-9 rounded-md border border-neutral-200 bg-white px-2 text-sm"
          >
            <option value="">All pitches</option>
            {pitches.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {reviews.isPending ? (
        <div className="h-40 animate-pulse rounded-xl bg-neutral-100" />
      ) : reviews.isError ? (
        <div className="py-10 text-center text-sm text-neutral-500">
          Couldn&rsquo;t load reviews.{' '}
          <button
            type="button"
            onClick={() => void reviews.refetch()}
            className="font-medium text-primary-600"
          >
            Retry
          </button>
        </div>
      ) : first && first.total === 0 ? (
        <div className="flex flex-col items-center py-12 text-center">
          <MessageSquare className="h-12 w-12 text-neutral-300" aria-hidden="true" />
          <p className="mt-3 font-semibold text-neutral-900">No reviews yet</p>
          <p className="mt-1 text-sm text-neutral-500">Be the first to review after your booking</p>
        </div>
      ) : (
        <>
          {first && <RatingBreakdown page={first} />}
          <div className="mt-6">
            {items.map(r => (
              <ReviewCard key={r.id} review={r} showPitch={!pitchId && pitches.length > 1} />
            ))}
          </div>
          {reviews.hasNextPage && (
            <div className="mt-4 flex justify-center">
              <div className="w-48">
                <Button
                  variant="secondary"
                  loading={reviews.isFetchingNextPage}
                  onClick={() => void reviews.fetchNextPage()}
                >
                  Load more reviews
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
