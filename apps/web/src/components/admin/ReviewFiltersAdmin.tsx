'use client'

/** Filters for review moderation — E15-08, kept in the URL. */
import { usePathname, useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

export function ReviewFiltersAdmin(initial: {
  minReports: string
  rating: string
  search: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [text, setText] = useState(initial.search)
  const [pending, startTransition] = useTransition()
  const go = (next: Partial<typeof initial>) => {
    const v = { ...initial, search: text, ...next }
    const q = new URLSearchParams({ minReports: v.minReports })
    if (v.rating) q.set('rating', v.rating)
    if (v.search.trim().length >= 2) q.set('search', v.search.trim())
    startTransition(() => router.replace(`${pathname}?${q}`))
  }
  const select = 'h-10 rounded-md border border-neutral-200 bg-white px-3 text-sm'
  return (
    <form
      role="search"
      aria-label="Find reviews"
      onSubmit={e => {
        e.preventDefault()
        go({})
      }}
      className="mt-4 flex flex-wrap items-end gap-3"
    >
      <label className="flex flex-col text-xs font-medium text-neutral-700">
        Reports
        <select
          value={initial.minReports}
          disabled={pending}
          onChange={e => go({ minReports: e.target.value })}
          className={select}
        >
          <option value="1">Reported</option>
          <option value="2">2 or more</option>
          <option value="3">3 or more</option>
          <option value="0">All reviews</option>
        </select>
      </label>
      <label className="flex flex-col text-xs font-medium text-neutral-700">
        Rating
        <select
          value={initial.rating}
          disabled={pending}
          onChange={e => go({ rating: e.target.value })}
          className={select}
        >
          <option value="">Any</option>
          {[5, 4, 3, 2, 1].map(n => (
            <option key={n} value={n}>
              {n} {n === 1 ? 'star' : 'stars'}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col text-xs font-medium text-neutral-700">
        Text, pitch or venue
        <input
          type="search"
          value={text}
          onChange={e => setText(e.target.value)}
          className="h-10 w-56 max-w-full rounded-md border border-neutral-200 px-3 text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="h-10 rounded-md bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
      >
        {pending ? 'Searching…' : 'Search'}
      </button>
    </form>
  )
}
