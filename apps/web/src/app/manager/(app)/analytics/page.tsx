import type { Metadata } from 'next'
import { AnalyticsQuerySchema, bucketLabel } from '@pitchup/shared'
import { prisma } from '@/lib/prisma'
import { requireActiveManager } from '@/lib/manager/access'
import {
  analyticsOccupancy,
  analyticsPitches,
  analyticsRevenue,
  analyticsSummary,
} from '@/lib/manager/analytics'
import { AnalyticsFilters } from '@/components/analytics/AnalyticsFilters'
import { KpiCards } from '@/components/analytics/KpiCards'
import { RevenueChart } from '@/components/analytics/RevenueChart'
import { OccupancyHeatmap } from '@/components/analytics/OccupancyHeatmap'
import { PitchPerformanceTable } from '@/components/analytics/PitchPerformanceTable'

export const metadata: Metadata = { title: 'Analytics | PitchUp' }

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

/**
 * The venue's analytics — E14-06 … E14-09. The period and pitch live in the
 * URL, so a view can be shared; everything is worked out on the server for
 * that view, in the venue's own days and hours.
 */
export default async function AnalyticsPage({ searchParams }: Props) {
  const { company } = await requireActiveManager()
  const raw = await searchParams
  const parsed = AnalyticsQuerySchema.safeParse({
    period: typeof raw.period === 'string' ? raw.period : undefined,
    pitchId: typeof raw.pitchId === 'string' && raw.pitchId ? raw.pitchId : undefined,
  })
  // A hand-edited URL with a bad value shows the default view.
  const { period, pitchId } = parsed.success ? parsed.data : AnalyticsQuerySchema.parse({})
  const [pitches, summary, revenue, occupancy, rows] = await Promise.all([
    prisma.pitch.findMany({
      where: { companyId: company.id, deletedAt: null },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    analyticsSummary(company.id, period, pitchId),
    analyticsRevenue(company.id, period, pitchId),
    analyticsOccupancy(company.id, period, pitchId),
    analyticsPitches(company.id, period),
  ])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold text-neutral-900">Analytics</h1>
        <AnalyticsFilters period={period} pitchId={pitchId ?? ''} pitches={pitches} />
      </div>
      <KpiCards summary={summary} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <RevenueChart
          groupBy={revenue.groupBy}
          points={revenue.data.map(p => ({ ...p, label: bucketLabel(p.period, revenue.groupBy) }))}
        />
        <OccupancyHeatmap grid={occupancy.grid} />
      </div>
      <PitchPerformanceTable rows={rows} period={period} pitchId={pitchId ?? ''} />
    </div>
  )
}
