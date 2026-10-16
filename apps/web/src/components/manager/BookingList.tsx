'use client'

/**
 * The bookings table — E11-06. Filters live in the URL: changing one
 * navigates, and the server renders the first page. "Load more" and the CSV
 * export call the same API with the same filters.
 */
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { CalendarDays, ChevronRight, Download, SearchX } from 'lucide-react'
import {
  MANAGER_BOOKING_STATUSES,
  formatDateLong,
  type ManagerBooking,
  type ManagerBookingPage,
} from '@pitchup/shared'
import { Alert } from '@/components/ui/Alert'
import { send } from '@/lib/http'
import { BookingStatusBadge } from './BookingStatusBadge'

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Awaiting payment',
  CONFIRMED: 'Confirmed',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed',
  NO_SHOW: 'No-show',
}

const short = (date: string) =>
  new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`))

const csvCell = (v: string | number) => {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function BookingList({
  initial,
  pitches,
  filters,
}: {
  initial: ManagerBookingPage
  pitches: { id: string; name: string }[]
  filters: Record<string, string>
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [items, setItems] = useState(initial.items)
  const [cursor, setCursor] = useState(initial.nextCursor)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [search, setSearch] = useState(filters.search ?? '')
  const first = useRef(true)

  const apply = (patch: Record<string, string>) => {
    const next = new URLSearchParams({ ...filters, ...patch })
    for (const [k, v] of [...next.entries()]) if (!v) next.delete(k)
    router.replace(`${pathname}${next.size ? `?${next}` : ''}`)
  }

  // Search waits for a pause in typing, and for two letters (or none).
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const term = search.trim()
    if (term.length === 1 || term === (filters.search ?? '')) return
    const t = setTimeout(() => apply({ search: term }), 400)
    return () => clearTimeout(t)
  }, [search])

  const apiUrl = (extra: Record<string, string>) =>
    `/api/v1/manager/bookings?${new URLSearchParams({ ...filters, ...extra })}`

  const more = async () => {
    if (!cursor) return
    setBusy(true)
    try {
      const page = await send<ManagerBookingPage>(apiUrl({ cursor }), 'GET')
      setItems(list => [...list, ...page.items])
      setCursor(page.nextCursor)
    } catch (caught) {
      setMessage((caught as Error).message)
    }
    setBusy(false)
  }

  const exportCsv = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const all: ManagerBooking[] = []
      let next: string | null = null
      // At most 10,000 rows.
      for (let i = 0; i < 100; i++) {
        const page: ManagerBookingPage = await send<ManagerBookingPage>(
          apiUrl({ limit: '100', ...(next ? { cursor: next } : {}) }),
          'GET'
        )
        all.push(...page.items)
        next = page.nextCursor
        if (!next) break
      }
      if (!all.length) {
        setMessage('No bookings to export.')
      } else {
        const rows = [
          [
            'Date',
            'Start',
            'End',
            'Player',
            'Pitch',
            'Status',
            'Price (RON)',
            'Payment',
            'Due at venue (RON)',
            'Reference',
          ],
          ...all.map(b => [
            b.date,
            b.startTime,
            b.endTime,
            b.player.name,
            b.pitch.name,
            STATUS_LABELS[b.status] ?? b.status,
            b.total,
            b.paymentMethod === 'ONLINE' ? 'Online' : 'At the venue',
            b.attendedAt ? 0 : b.dueAtVenue,
            b.reference,
          ]),
        ]
        const csv = rows.map(r => r.map(csvCell).join(',')).join('\n')
        const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
        const a = document.createElement('a')
        a.href = url
        a.download = `bookings-${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch {
      setMessage('Export failed. Try again.')
    }
    setBusy(false)
  }

  const field = 'h-10 rounded-md border border-neutral-200 bg-white px-3 text-sm'
  const filtered = Object.keys(filters).length > 0

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/manager/bookings/calendar"
          className="inline-flex h-10 items-center gap-2 rounded-md border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
        >
          <CalendarDays className="h-4 w-4" aria-hidden="true" />
          Week view
        </Link>
        <button
          type="button"
          onClick={() => void exportCsv()}
          disabled={busy}
          className="inline-flex h-10 items-center gap-2 rounded-md bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Export CSV
        </button>
      </div>

      <form
        role="search"
        aria-label="Filter bookings"
        onSubmit={e => e.preventDefault()}
        className="mb-4 flex flex-wrap items-end gap-3 rounded-xl bg-white p-4 shadow-sm"
      >
        <label className="text-xs font-medium text-neutral-700">
          Pitch
          <select
            value={filters.pitchId ?? ''}
            onChange={e => apply({ pitchId: e.target.value })}
            className={`mt-1 block ${field}`}
          >
            <option value="">All pitches</option>
            {pitches.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-neutral-700">
          Status
          <select
            value={filters.status ?? ''}
            onChange={e => apply({ status: e.target.value })}
            className={`mt-1 block ${field}`}
          >
            <option value="">All statuses</option>
            {MANAGER_BOOKING_STATUSES.map(s => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-neutral-700">
          From
          <input
            type="date"
            value={filters.dateFrom ?? ''}
            onChange={e => apply({ dateFrom: e.target.value })}
            className={`mt-1 block ${field}`}
          />
        </label>
        <label className="text-xs font-medium text-neutral-700">
          To
          <input
            type="date"
            value={filters.dateTo ?? ''}
            min={filters.dateFrom}
            onChange={e => apply({ dateTo: e.target.value })}
            className={`mt-1 block ${field}`}
          />
        </label>
        <label className="min-w-[12rem] flex-1 text-xs font-medium text-neutral-700">
          Player
          <input
            type="search"
            value={search}
            placeholder="Name or email"
            onChange={e => setSearch(e.target.value)}
            className={`mt-1 block w-full ${field}`}
          />
        </label>
        {filtered && (
          <button
            type="button"
            onClick={() => {
              setSearch('')
              router.replace(pathname)
            }}
            className="h-10 px-2 text-sm font-semibold text-primary-700 hover:underline"
          >
            Clear filters
          </button>
        )}
      </form>

      {message && (
        <div className="mb-4">
          <Alert>{message}</Alert>
        </div>
      )}

      {items.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl bg-white px-6 py-14 text-center shadow-sm">
          <SearchX className="h-12 w-12 text-neutral-300" aria-hidden="true" />
          <p className="mt-3 font-semibold text-neutral-900">No bookings found</p>
          {filtered && <p className="mt-1 text-sm text-neutral-500">Try other filters.</p>}
        </div>
      ) : (
        <div className="relative overflow-x-auto rounded-xl bg-white shadow-sm">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-neutral-50 text-xs font-medium uppercase text-neutral-500">
              <tr>
                <th scope="col" className="px-4 py-3">
                  Date and time
                </th>
                <th scope="col" className="px-4 py-3">
                  Player
                </th>
                <th scope="col" className="px-4 py-3">
                  Pitch
                </th>
                <th scope="col" className="px-4 py-3">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Amount
                </th>
                <th scope="col" className="px-4 py-3">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {items.map(b => (
                <tr key={b.id} className="hover:bg-neutral-50">
                  <td className="whitespace-nowrap px-4 py-3 text-neutral-900">
                    <span title={formatDateLong(b.date)}>{short(b.date)}</span>, {b.startTime}–
                    {b.endTime}
                  </td>
                  <td className="px-4 py-3 text-neutral-900">{b.player.name}</td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2 text-neutral-700">
                      <span
                        aria-hidden="true"
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: b.pitch.color }}
                      />
                      {b.pitch.name}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <BookingStatusBadge status={b.status} attended={!!b.attendedAt} />
                  </td>
                  <td className="px-4 py-3 text-right text-neutral-900">
                    {b.total} RON
                    {b.dueAtVenue > 0 && !b.attendedAt && b.status === 'CONFIRMED' && (
                      <span className="block text-xs text-neutral-500">
                        {b.dueAtVenue} RON at the venue
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/manager/bookings/${b.id}`}
                      aria-label={`Open booking ${b.reference}, ${b.player.name}, ${short(b.date)} ${b.startTime}`}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md text-neutral-700 hover:bg-neutral-100"
                    >
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {cursor && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => void more()}
            disabled={busy}
            className="h-10 rounded-md border border-neutral-200 bg-white px-5 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 disabled:opacity-60"
          >
            {busy ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </>
  )
}
