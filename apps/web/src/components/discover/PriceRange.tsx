'use client'

import { useEffect, useState } from 'react'
import { DISCOVER, priceBound } from '@pitchup/shared'
import { useT } from '@/i18n/client'

interface PriceRangeProps {
  min: number | null
  max: number | null
  onChange: (min: number | null, max: number | null) => void
}

const { PRICE_MIN, PRICE_MAX, PRICE_STEP } = DISCOVER

/**
 * Two native range inputs stacked on one track. Native inputs keep keyboard
 * and screen-reader support for free; the thumbs are styled in globals.css.
 * The value is committed on release, so dragging does not fire a request per
 * pixel.
 */
export function PriceRange({ min, max, onChange }: PriceRangeProps) {
  const t = useT()
  const [low, setLow] = useState(min ?? PRICE_MIN)
  const [high, setHigh] = useState(max ?? PRICE_MAX)

  // Follow outside changes such as "Reset all".
  useEffect(() => setLow(min ?? PRICE_MIN), [min])
  useEffect(() => setHigh(max ?? PRICE_MAX), [max])

  const commit = () => onChange(priceBound(low, 'min'), priceBound(high, 'max'))
  const pct = (v: number) => ((v - PRICE_MIN) / (PRICE_MAX - PRICE_MIN)) * 100

  return (
    <div>
      <p className="mb-3 text-right text-[13px] font-medium text-neutral-900">
        {low} – {high} RON
      </p>
      <div className="relative h-6">
        <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-neutral-200" />
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-primary-600"
          style={{ left: `${pct(low)}%`, right: `${100 - pct(high)}%` }}
        />
        <input
          type="range"
          aria-label={t('discover.sidebar.minPrice')}
          min={PRICE_MIN}
          max={PRICE_MAX}
          step={PRICE_STEP}
          value={low}
          // The handles cannot cross: each stops one step short of the other.
          onChange={e => setLow(Math.min(Number(e.target.value), high - PRICE_STEP))}
          onPointerUp={commit}
          onKeyUp={commit}
          className="range-thumb absolute inset-0 w-full"
        />
        <input
          type="range"
          aria-label={t('discover.sidebar.maxPrice')}
          min={PRICE_MIN}
          max={PRICE_MAX}
          step={PRICE_STEP}
          value={high}
          onChange={e => setHigh(Math.max(Number(e.target.value), low + PRICE_STEP))}
          onPointerUp={commit}
          onKeyUp={commit}
          className="range-thumb absolute inset-0 w-full"
        />
      </div>
      <div className="mt-1 flex justify-between text-[13px] font-medium text-neutral-500">
        <span>{PRICE_MIN} RON</span>
        <span>{PRICE_MAX} RON</span>
      </div>
    </div>
  )
}
