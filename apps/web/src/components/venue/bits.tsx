/**
 * Small display pieces shared by the company and pitch pages — E04-08.
 */
import { Star } from 'lucide-react'
import {
  REVIEW,
  SIZE_LABELS,
  SURFACE_COLORS,
  SURFACE_LABELS,
  type PitchSize,
  type SurfaceType,
} from '@pitchup/shared'

export function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  const full = Math.round(rating)
  return (
    <span className="inline-flex gap-0.5" aria-label={`${rating.toFixed(1)} out of 5`} role="img">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          style={{ width: size, height: size }}
          className={
            i <= full ? 'fill-[#FBBF24] text-[#FBBF24]' : 'fill-neutral-200 text-neutral-200'
          }
          aria-hidden="true"
        />
      ))}
    </span>
  )
}

/** "★★★★☆ 4.3 (127 reviews)", or "Not rated yet" below the public threshold. */
export function RatingLine({
  avgRating,
  reviewCount,
}: {
  avgRating: number | null
  reviewCount: number
}) {
  if (avgRating === null || reviewCount < REVIEW.MIN_FOR_PUBLIC_RATING) {
    return <span className="text-sm text-neutral-500">Not rated yet</span>
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <Stars rating={avgRating} />
      <span className="font-bold text-neutral-700">{avgRating.toFixed(1)}</span>
      <span className="text-neutral-500">
        ({reviewCount} {reviewCount === 1 ? 'review' : 'reviews'})
      </span>
    </span>
  )
}

export function SurfaceChip({ surface }: { surface: SurfaceType }) {
  const c = SURFACE_COLORS[surface]
  return (
    <span
      className="rounded-full px-2 py-1 text-[11px] font-medium"
      style={{ backgroundColor: c.background, color: c.text }}
    >
      {SURFACE_LABELS[surface]}
    </span>
  )
}

export const sizeLabel = (size: PitchSize) => SIZE_LABELS[size]

/** "Oct 1, 2026". */
export const formatReviewDate = (iso: string) =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(
    new Date(iso)
  )
