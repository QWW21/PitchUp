'use client'

/**
 * Small display pieces shared by the company and pitch pages — E04-08.
 */
import { useId } from 'react'
import { Info, Star } from 'lucide-react'
import {
  INTL_LOCALE,
  REVIEW,
  SURFACE_COLORS,
  sharedT,
  type Locale,
  type PitchSize,
  type SurfaceType,
} from '@pitchup/shared'
import { useT } from '@/i18n/client'

export function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  const t = useT()
  const full = Math.round(rating)
  return (
    <span
      className="inline-flex gap-0.5"
      aria-label={t('venue.rating.outOf5', { rating: rating.toFixed(1) })}
      role="img"
    >
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
  const t = useT()
  if (avgRating === null || reviewCount < REVIEW.MIN_FOR_PUBLIC_RATING) {
    return <span className="text-sm text-neutral-500">{t('venue.rating.notRated')}</span>
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <Stars rating={avgRating} />
      <span className="font-bold text-neutral-700">{avgRating.toFixed(1)}</span>
      <span className="text-neutral-500">
        ({t('venue.rating.reviews', { count: reviewCount })})
      </span>
    </span>
  )
}

export function SurfaceChip({ surface }: { surface: SurfaceType }) {
  const t = useT()
  const c = SURFACE_COLORS[surface]
  return (
    <span
      className="rounded-full px-2 py-1 text-[11px] font-medium"
      style={{ backgroundColor: c.background, color: c.text }}
    >
      {t(`surface.${surface}`)}
    </span>
  )
}

export const sizeLabel = (size: PitchSize, locale: Locale) => sharedT(locale)(`size.${size}`)

/**
 * An (i) beside a pitch size, explaining that it is the owner's
 * recommendation rather than a limit. Shown on hover and on keyboard focus;
 * screen readers get the text as the button's description.
 *
 * `fill`: the tooltip spans the nearest positioned ancestor instead of
 * centring on the icon, for narrow places like the filter sidebar, where a
 * centred bubble would be cut off.
 */
export function SizeInfo({ fill = false }: { fill?: boolean }) {
  const t = useT()
  // Unique per instance: the filter panel renders twice (sidebar and drawer).
  const id = useId()
  return (
    <span className={`group inline-flex ${fill ? '' : 'relative'}`}>
      <button
        type="button"
        aria-label={t('venue.sizeInfoButton')}
        aria-describedby={id}
        className="rounded-full text-neutral-500 hover:text-neutral-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
      >
        <Info className="h-4 w-4" aria-hidden="true" />
      </button>
      <span
        id={id}
        role="tooltip"
        className={`invisible absolute top-full z-20 mt-2 ${fill ? 'inset-x-0' : 'left-1/2 w-64 -translate-x-1/2'} rounded-md bg-neutral-900 px-3 py-2 text-xs font-normal leading-snug text-white opacity-0 shadow-lg transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100`}
      >
        {t('size.info')}
      </span>
    </span>
  )
}

/** "1 Oct 2026" · "1 oct. 2026". */
export const formatReviewDate = (iso: string, locale: Locale) =>
  new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(iso))
