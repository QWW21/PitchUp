'use client'

/**
 * Each pitch over the period — E14-09: sortable by any column (revenue first,
 * highest first), and the period's bookings as CSV from the server.
 */
import { useState } from 'react'
import { ArrowDown, ArrowUp, Download } from 'lucide-react'
import type { PitchPerformanceRow } from '@pitchup/shared'
import { Alert } from '@/components/ui/Alert'
import { ron } from './format'

type Key =
  | 'name'
  | 'revenue'
  | 'totalBookings'
  | 'occupancy'
  | 'avgRating'
  | 'cancellationRate'
  | 'noShowRate'

const COLUMNS: { key: Key; label: string; numeric: boolean }[] = [
  { key: 'name', label: 'Pitch', numeric: false },
  { key: 'revenue', label: 'Revenue', numeric: true },
  { key: 'totalBookings', label: 'Bookings', numeric: true },
  { key: 'occupancy', label: 'Occupancy', numeric: true },
  { key: 'avgRating', label: 'Rating', numeric: true },
  { key: 'cancellationRate', label: 'Cancelled', numeric: true },
  { key: 'noShowRate', label: 'No-shows', numeric: true },
]

/** Under 10% fine, under 20% worth a look, above that a problem. */
function Rate({ value }: { value: number }) {
  const color = value < 10 ? 'text-primary-700' : value < 20 ? 'text-amber-800' : 'text-error-600'
  return <span className={`font-medium ${color}`}>{value}%</span>
}

export function PitchPerformanceTable({
  rows,
  period,
  pitchId,
}: {
  rows: PitchPerformanceRow[]
  period: string
  pitchId: string
}) {
  const [sort, setSort] = useState<{ key: Key; dir: 'asc' | 'desc' }>({
    key: 'revenue',
    dir: 'desc',
  })
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const sorted = [...rows].sort((a, b) => {
    const va = a[sort.key]
    const vb = b[sort.key]
    const order =
      typeof va === 'string' || typeof vb === 'string'
        ? String(va).localeCompare(String(vb))
        : (va ?? -1) - (vb ?? -1)
    return sort.dir === 'asc' ? order : -order
  })
  const by = (key: Key) =>
    setSort(s =>
      s.key === key
        ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'name' ? 'asc' : 'desc' }
    )

  const download = async () => {
    setBusy(true)
    setNote(null)
    setError(null)
    try {
      const q = new URLSearchParams({ period })
      if (pitchId) q.set('pitchId', pitchId)
      const res = await fetch(`/api/v1/manager/analytics/export?${q}`)
      if (!res.ok) throw new Error('The export could not be made. Try again.')
      const name =
        /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ??
        'pitchup-analytics.csv'
      const url = URL.createObjectURL(await res.blob())
      const a = document.createElement('a')
      a.href = url
      a.download = name
      a.click()
      URL.revokeObjectURL(url)
      if (res.headers.get('X-Truncated')) {
        setNote(
          'Only the latest 10,000 bookings were exported. Pick a shorter period for all of them.'
        )
      }
    } catch (caught) {
      setError((caught as Error).message)
    }
    setBusy(false)
  }

  return (
    <section aria-labelledby="pitches-heading" className="rounded-xl bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="pitches-heading" className="text-base font-semibold text-neutral-900">
          Pitch performance
        </h2>
        <button
          type="button"
          onClick={() => void download()}
          disabled={busy}
          className="flex h-10 items-center gap-2 rounded-md border border-neutral-200 px-4 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 disabled:opacity-60"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          {busy ? 'Preparing…' : 'Export CSV'}
        </button>
      </div>
      {note && (
        <p role="status" className="mt-2 text-sm text-amber-800">
          {note}
        </p>
      )}
      {error && (
        <div className="mt-2">
          <Alert>{error}</Alert>
        </div>
      )}
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-700">No pitches yet.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-xs text-neutral-700">
                {COLUMNS.map(c => (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={
                      sort.key === c.key
                        ? sort.dir === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                    className={`py-2 font-medium ${c.numeric ? 'text-right' : 'text-left'}`}
                  >
                    <button
                      type="button"
                      onClick={() => by(c.key)}
                      className="inline-flex h-8 items-center gap-1 hover:text-neutral-900"
                    >
                      {c.label}
                      {sort.key === c.key &&
                        (sort.dir === 'asc' ? (
                          <ArrowUp className="h-3 w-3" aria-hidden="true" />
                        ) : (
                          <ArrowDown className="h-3 w-3" aria-hidden="true" />
                        ))}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {sorted.map(r => (
                <tr key={r.pitchId}>
                  <th scope="row" className="py-2 text-left font-medium text-neutral-900">
                    {r.name}
                    {!r.isActive && (
                      <span className="ml-1 text-xs font-normal text-neutral-500">(inactive)</span>
                    )}
                  </th>
                  <td className="text-right">{ron(r.revenue)}</td>
                  <td className="text-right">
                    {r.totalBookings}
                    {r.completedBookings !== r.totalBookings && (
                      <span className="block text-xs text-neutral-500">
                        {r.completedBookings} played
                      </span>
                    )}
                  </td>
                  <td className="text-right">{r.occupancy === null ? '—' : `${r.occupancy}%`}</td>
                  <td className="text-right">
                    {r.avgRating === null ? '—' : `★ ${r.avgRating.toFixed(1)}`}
                    {r.reviewCount > 0 && (
                      <span className="block text-xs text-neutral-500">
                        {r.reviewCount} {r.reviewCount === 1 ? 'review' : 'reviews'}
                      </span>
                    )}
                  </td>
                  <td className="text-right">
                    <Rate value={r.cancellationRate} />
                  </td>
                  <td className="text-right">
                    <Rate value={r.noShowRate} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
