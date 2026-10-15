import type { CSSProperties } from 'react'
import { TRUST_TIER_COLOURS, trustTier } from '@pitchup/shared'

/**
 * The score as a ring — E08-08. An SVG circle whose stroke is dashed to
 * the score's share of the circumference; CSS draws it from empty
 * (`.ring-fill` in globals.css), so no JavaScript runs for the animation.
 */
export function TrustScoreRing({ score, size = 120 }: { score: number; size?: number }) {
  const tier = trustTier(score)
  const colour = TRUST_TIER_COLOURS[tier.label]
  const stroke = size >= 100 ? 10 : 6
  const r = (size - stroke) / 2
  const length = 2 * Math.PI * r
  const offset = length * (1 - Math.max(0, Math.min(100, score)) / 100)
  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Trust score ${score} out of 100, ${tier.label}`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#E5E7EB"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={colour}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={length}
          strokeDashoffset={offset}
          className="ring-fill"
          style={{ '--ring-length': length } as CSSProperties}
        />
      </svg>
      <span
        aria-hidden="true"
        className={`absolute font-bold text-neutral-900 ${size >= 100 ? 'text-3xl' : 'text-base'}`}
      >
        {score}
      </span>
    </div>
  )
}
