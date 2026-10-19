'use client'

/**
 * The period and the pitch — E14-06. Kept in the URL (?period=30d&pitchId=…),
 * so a view can be bookmarked or shared; changing one re-renders the page.
 * Both wait while it does ("Updating…"), so a second change can't overwrite
 * the first. No loading.tsx: with one, Next 15.5 sent an empty response to
 * these in-page navigations and the URL never changed.
 */
import { usePathname, useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { ANALYTICS_PERIOD_LABELS, ANALYTICS_PERIODS, type AnalyticsPeriod } from '@pitchup/shared'

export function AnalyticsFilters({
  period,
  pitchId,
  pitches,
}: {
  period: AnalyticsPeriod
  pitchId: string
  pitches: { id: string; name: string }[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [pending, startTransition] = useTransition()
  const go = (next: { period?: string; pitchId?: string }) => {
    const q = new URLSearchParams()
    const p = next.period ?? period
    const pitch = next.pitchId ?? pitchId
    if (p !== '30d') q.set('period', p)
    if (pitch) q.set('pitchId', pitch)
    startTransition(() => router.replace(`${pathname}${q.size ? `?${q}` : ''}`))
  }
  const select = 'h-10 rounded-md border border-neutral-200 bg-white px-3 text-sm'
  return (
    <div className="flex flex-wrap gap-3" aria-busy={pending}>
      <label className="flex flex-col text-xs font-medium text-neutral-700">
        Pitch
        <select
          value={pitchId}
          onChange={e => go({ pitchId: e.target.value })}
          disabled={pending}
          className={select}
        >
          <option value="">All pitches</option>
          {pitches.map(p => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col text-xs font-medium text-neutral-700">
        Period
        <select
          value={period}
          onChange={e => go({ period: e.target.value })}
          disabled={pending}
          className={select}
        >
          {ANALYTICS_PERIODS.map(p => (
            <option key={p} value={p}>
              {ANALYTICS_PERIOD_LABELS[p]}
            </option>
          ))}
        </select>
      </label>
      <p role="status" className="self-end pb-2 text-xs text-neutral-700">
        {pending ? 'Updating…' : ''}
      </p>
    </div>
  )
}
