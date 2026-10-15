'use client'

/**
 * The filter bar on reviews management — E07-09: pitch, order, and a player
 * name search (300 ms after typing stops). Everything lives in the URL, so
 * the server renders the list and Back works.
 */
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { MANAGER_REVIEW_SORTS, type ManagerReviewSort } from '@pitchup/shared'

const LABELS: Record<ManagerReviewSort, string> = {
  newest: 'Newest',
  lowest: 'Lowest rated',
  unanswered: 'Unanswered',
}

export function ReviewFilters({
  pitches,
  pitchId,
  sort,
  q,
}: {
  pitches: { id: string; name: string }[]
  pitchId?: string | undefined
  sort: ManagerReviewSort
  q?: string | undefined
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [text, setText] = useState(q ?? '')
  const typed = useRef(false)

  const go = (change: { pitch?: string; sort?: string; q?: string }) => {
    const next = { pitch: pitchId ?? '', sort, q: q ?? '', ...change }
    const params = new URLSearchParams()
    if (next.pitch) params.set('pitch', next.pitch)
    if (next.sort && next.sort !== 'newest') params.set('sort', next.sort)
    if (next.q) params.set('q', next.q)
    // Any change starts again at page one.
    router.replace(`${pathname}${params.size ? `?${params}` : ''}`)
  }

  useEffect(() => {
    // Not on first render: only once the manager has typed.
    if (!typed.current) return
    const timer = setTimeout(() => go({ q: text.trim() }), 300)
    return () => clearTimeout(timer)
    // Only the typed text restarts the timer.
  }, [text])

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-xl bg-white p-3 shadow-sm sm:flex-row sm:items-center">
      <label className="flex items-center gap-2 text-sm text-neutral-700">
        <span className="sr-only">Pitch</span>
        <select
          value={pitchId ?? ''}
          onChange={e => go({ pitch: e.target.value })}
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
      <div role="group" aria-label="Sort" className="flex gap-1">
        {MANAGER_REVIEW_SORTS.map(s => (
          <button
            key={s}
            type="button"
            aria-pressed={sort === s}
            onClick={() => go({ sort: s })}
            className={`h-9 whitespace-nowrap rounded-full px-3 text-sm font-medium ${
              sort === s
                ? 'bg-primary-600 text-white'
                : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
            }`}
          >
            {LABELS[s]}
          </button>
        ))}
      </div>
      <label className="relative flex-1">
        <span className="sr-only">Search by player name</span>
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500"
          aria-hidden="true"
        />
        <input
          type="search"
          value={text}
          onChange={e => {
            typed.current = true
            setText(e.target.value)
          }}
          placeholder="Player name"
          className="h-9 w-full rounded-md border border-neutral-200 pl-8 pr-2 text-sm"
        />
      </label>
    </div>
  )
}
