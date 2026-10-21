'use client'

/**
 * The five headline numbers — E14-06, each against the same length of time
 * just before. Up is good, except for no-shows.
 */
import { ArrowDown, ArrowUp } from 'lucide-react'
import type { AnalyticsSummary, Kpi } from '@pitchup/shared'
import { useLocale, useT } from '@/i18n/client'
import { ron } from './format'

function KpiCard({
  label,
  value,
  kpi,
  note,
  invertGood = false,
}: {
  label: string
  value: string
  kpi: Kpi
  note?: string
  invertGood?: boolean
}) {
  const t = useT()
  const { change } = kpi
  const good = change !== null && change !== 0 && (invertGood ? change < 0 : change > 0)
  const bad = change !== null && change !== 0 && !good
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <p className="text-sm text-neutral-700">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-neutral-900">{value}</p>
      {note && <p className="text-xs text-neutral-500">{note}</p>}
      {change === null ? (
        <p className="mt-1 text-sm text-neutral-500">{t('analytics.kpi.noEarlier')}</p>
      ) : (
        <p
          className={`mt-1 flex items-center gap-1 text-sm font-medium ${
            good ? 'text-primary-700' : bad ? 'text-error-600' : 'text-neutral-700'
          }`}
        >
          {change > 0 ? (
            <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
          ) : change < 0 ? (
            <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
          ) : null}
          <span>
            {t('analytics.kpi.vsPrevious', {
              sign: change > 0 ? '+' : change < 0 ? '−' : '',
              n: Math.abs(change),
            })}
          </span>
        </p>
      )}
    </div>
  )
}

export function KpiCards({ summary: s }: { summary: AnalyticsSummary }) {
  const t = useT()
  const locale = useLocale()
  return (
    <section
      aria-label={t('analytics.kpi.label')}
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5"
    >
      <KpiCard
        label={t('analytics.kpi.revenue')}
        value={ron(s.revenue.value ?? 0, locale)}
        kpi={s.revenue}
        note={t('analytics.kpi.split', {
          online: ron(s.revenue.online, locale),
          venue: ron(s.revenue.atVenue, locale),
        })}
      />
      <KpiCard
        label={t('analytics.kpi.played')}
        value={String(s.bookings.value ?? 0)}
        kpi={s.bookings}
      />
      <KpiCard
        label={t('analytics.kpi.occupancy')}
        value={s.occupancy.value === null ? '—' : `${s.occupancy.value}%`}
        kpi={s.occupancy}
        note={t('analytics.kpi.occupancyNote')}
      />
      <KpiCard
        label={t('analytics.kpi.rating')}
        value={s.avgRating.value === null ? '—' : `★ ${s.avgRating.value.toFixed(1)}`}
        kpi={s.avgRating}
        note={t('analytics.kpi.ratingNote')}
      />
      <KpiCard
        label={t('analytics.kpi.noShowRate')}
        value={s.noShowRate.value === null ? '—' : `${s.noShowRate.value}%`}
        kpi={s.noShowRate}
        invertGood
      />
    </section>
  )
}
