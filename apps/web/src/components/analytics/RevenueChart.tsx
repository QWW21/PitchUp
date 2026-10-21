'use client'

/**
 * Revenue over the period — E14-07. Drawn as SVG rather than with a chart
 * library: three series (revenue, and how much of it was paid online and at
 * the venue; C-15: PitchUp takes no cut), toggled from the
 * legend; hovering or focusing a period shows its figures; and the same
 * numbers as a table for screen readers and anyone who prefers one.
 */
import { useState } from 'react'
import type { AnalyticsGroupBy, RevenuePoint } from '@pitchup/shared'
import { useLocale, useT } from '@/i18n/client'
import { compact, ron } from './format'

type Point = RevenuePoint & { label: string }
type Series = 'gross' | 'online' | 'atVenue'

const SERIES: { key: Series; stroke: string; fill?: string; dashed?: boolean }[] = [
  { key: 'gross', stroke: '#15803D', fill: 'rgba(22,163,74,0.18)' },
  { key: 'online', stroke: '#4F46E5' },
  { key: 'atVenue', stroke: '#C2410C', dashed: true },
]

const W = 640
const H = 260
const PAD = { left: 48, right: 12, top: 12, bottom: 28 }

/** A round number at or above the top value, so the axis reads well. */
function niceMax(n: number) {
  if (n <= 0) return 100
  const step = 10 ** Math.floor(Math.log10(n))
  return Math.ceil(n / step) * step
}

export function RevenueChart({ points, groupBy }: { points: Point[]; groupBy: AnalyticsGroupBy }) {
  const t = useT()
  const locale = useLocale()
  const [hidden, setHidden] = useState<Record<Series, boolean>>({
    gross: false,
    online: false,
    atVenue: false,
  })
  const [active, setActive] = useState<number | null>(null)
  const empty = points.every(p => p.gross === 0)
  const max = niceMax(Math.max(...points.map(p => p.gross), 0))
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const x = (i: number) =>
    PAD.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW)
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH
  const line = (key: Series) =>
    points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p[key])}`).join(' ')
  const area = (key: Series) => `${line(key)} L${x(points.length - 1)},${y(0)} L${x(0)},${y(0)} Z`
  // At most about eight labels along the bottom.
  const every = Math.max(1, Math.ceil(points.length / 8))
  const shown = active === null ? null : points[active]!
  const unit = t(`analytics.chart.unit.${groupBy}`)

  return (
    <section aria-labelledby="revenue-heading" className="rounded-xl bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="revenue-heading" className="text-base font-semibold text-neutral-900">
          {t('analytics.chart.heading')}
        </h2>
        <div className="flex flex-wrap gap-2" role="group" aria-label={t('analytics.chart.toggle')}>
          {SERIES.map(s => (
            <button
              key={s.key}
              type="button"
              aria-pressed={!hidden[s.key]}
              onClick={() => setHidden(h => ({ ...h, [s.key]: !h[s.key] }))}
              className={`flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium ${
                hidden[s.key]
                  ? 'border-neutral-200 text-neutral-500 line-through'
                  : 'border-neutral-300 text-neutral-900'
              }`}
            >
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: s.stroke }}
              />
              {t(`analytics.chart.series.${s.key}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="relative mt-3">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          role="img"
          aria-label={
            empty
              ? t('analytics.chart.emptyLabel')
              : t('analytics.chart.label', { n: points.length })
          }
          onMouseLeave={() => setActive(null)}
        >
          {[0, 0.25, 0.5, 0.75, 1].map(f => (
            <g key={f}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y(max * f)}
                y2={y(max * f)}
                stroke="#E5E7EB"
                strokeDasharray={f ? '3 3' : undefined}
              />
              <text
                x={PAD.left - 6}
                y={y(max * f) + 4}
                textAnchor="end"
                fontSize="11"
                fill="#4B5563"
              >
                {compact(max * f, locale)}
              </text>
            </g>
          ))}
          {points.map((p, i) =>
            i % every === 0 || i === points.length - 1 ? (
              <text
                key={p.period}
                x={x(i)}
                y={H - 8}
                textAnchor="middle"
                fontSize="11"
                fill="#4B5563"
              >
                {p.label}
              </text>
            ) : null
          )}
          {SERIES.filter(s => !hidden[s.key]).map(s => (
            <g key={s.key}>
              {s.fill && <path d={area(s.key)} fill={s.fill} />}
              <path
                d={line(s.key)}
                fill="none"
                stroke={s.stroke}
                strokeWidth="2"
                strokeDasharray={s.dashed ? '5 3' : undefined}
              />
            </g>
          ))}
          {shown && (
            <line
              x1={x(active!)}
              x2={x(active!)}
              y1={PAD.top}
              y2={PAD.top + innerH}
              stroke="#9CA3AF"
            />
          )}
          {points.map((p, i) => (
            <rect
              key={p.period}
              x={x(i) - innerW / Math.max(points.length - 1, 1) / 2}
              y={PAD.top}
              width={innerW / Math.max(points.length - 1, 1)}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setActive(i)}
            />
          ))}
        </svg>
        {empty && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-neutral-500">
            {t('analytics.chart.empty')}
          </p>
        )}
        {shown && (
          <div
            className="pointer-events-none absolute top-2 rounded-md bg-neutral-900 px-3 py-2 text-xs text-white shadow"
            style={{
              left: `${(x(active!) / W) * 100}%`,
              transform: `translateX(${active! > points.length / 2 ? '-105%' : '5%'})`,
            }}
          >
            <p className="font-semibold">
              {unit} {shown.label}
            </p>
            <p>{t('analytics.chart.tipRevenue', { amount: ron(shown.gross, locale) })}</p>
            <p>{t('analytics.chart.tipOnline', { amount: ron(shown.online, locale) })}</p>
            <p>{t('analytics.chart.tipAtVenue', { amount: ron(shown.atVenue, locale) })}</p>
            <p>{t('analytics.chart.bookings', { count: shown.bookings })}</p>
          </div>
        )}
      </div>

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer font-medium text-primary-700">
          {t('analytics.chart.asTable')}
        </summary>
        <div className="mt-2 max-h-64 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-neutral-700">
              <tr>
                <th scope="col" className="py-1 pr-3 font-medium">
                  {unit}
                </th>
                <th scope="col" className="py-1 pr-3 text-right font-medium">
                  {t('analytics.chart.revenue')}
                </th>
                <th scope="col" className="py-1 pr-3 text-right font-medium">
                  {t('analytics.chart.online')}
                </th>
                <th scope="col" className="py-1 pr-3 text-right font-medium">
                  {t('analytics.chart.atVenue')}
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  {t('analytics.chart.bookingsCol')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {points.map(p => (
                <tr key={p.period}>
                  <th scope="row" className="py-1 pr-3 font-normal text-neutral-900">
                    {p.label}
                  </th>
                  <td className="py-1 pr-3 text-right">{ron(p.gross, locale)}</td>
                  <td className="py-1 pr-3 text-right">{ron(p.online, locale)}</td>
                  <td className="py-1 pr-3 text-right">{ron(p.atVenue, locale)}</td>
                  <td className="py-1 text-right">{p.bookings}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  )
}
