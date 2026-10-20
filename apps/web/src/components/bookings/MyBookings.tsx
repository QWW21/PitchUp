'use client'

/**
 * My Bookings list — E06-10. Upcoming / Past / Cancelled, with the tab in the
 * URL (?tab=) so it can be shared and Back works. Each tab pages with "Load
 * more" through GET /bookings' cursor.
 */
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useInfiniteQuery } from '@tanstack/react-query'
import { CalendarX2, CheckCircle2, History } from 'lucide-react'
import { BOOKING_TABS, type BookingListPage, type BookingTab } from '@pitchup/shared'
import { BookingCard } from './BookingCard'
import { useT } from '@/i18n/client'

async function fetchPage(tab: BookingTab, cursor: string | null) {
  const res = await fetch(
    `/api/v1/bookings?tab=${tab}&limit=10${cursor ? `&cursor=${cursor}` : ''}`,
    {
      cache: 'no-store',
    }
  )
  const body = await res.json().catch(() => null)
  if (!res.ok || !body?.data) throw new Error(body?.error?.message ?? res.statusText)
  return body.data as BookingListPage
}

export function MyBookings() {
  const t = useT()
  const params = useSearchParams()
  const router = useRouter()
  const tab = (BOOKING_TABS as readonly string[]).includes(params.get('tab') ?? '')
    ? (params.get('tab') as BookingTab)
    : 'upcoming'

  const q = useInfiniteQuery({
    queryKey: ['my-bookings', tab],
    queryFn: ({ pageParam }) => fetchPage(tab, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: last => last.nextCursor,
    staleTime: 0,
  })
  const items = q.data?.pages.flatMap(p => p.items) ?? []

  return (
    <section aria-labelledby="my-bookings-heading">
      <h1 id="my-bookings-heading" className="text-2xl font-bold text-neutral-900">
        {t('myBookings.heading')}
      </h1>

      <div
        role="tablist"
        aria-label={t('myBookings.tabs')}
        className="mt-4 flex gap-6 border-b border-neutral-200"
      >
        {BOOKING_TABS.map(name => (
          <button
            key={name}
            type="button"
            role="tab"
            id={`tab-${name}`}
            aria-selected={name === tab}
            aria-controls="bookings-panel"
            onClick={() =>
              router.push(`/my-bookings${name === 'upcoming' ? '' : `?tab=${name}`}`, {
                scroll: false,
              })
            }
            className={`-mb-px h-11 border-b-2 text-sm font-medium ${
              name === tab
                ? 'border-primary-600 text-neutral-900'
                : 'border-transparent text-neutral-700 hover:text-neutral-900'
            }`}
          >
            {t(`myBookings.tab.${name}`)}
          </button>
        ))}
      </div>

      <div id="bookings-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="mt-4">
        {q.isLoading && (
          <div className="space-y-3">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-32 animate-pulse rounded-xl bg-neutral-100" />
            ))}
          </div>
        )}
        {q.isError && (
          <p role="alert" className="text-sm text-error-600">
            {t('myBookings.loadError')}
          </p>
        )}
        {q.isSuccess && !items.length && <Empty tab={tab} />}
        <ul className="space-y-3">
          {items.map(b => (
            <li key={b.id}>
              <BookingCard booking={b} />
            </li>
          ))}
        </ul>
        {q.hasNextPage && (
          <button
            type="button"
            onClick={() => q.fetchNextPage()}
            disabled={q.isFetchingNextPage}
            className="mt-4 h-10 w-full rounded-md border border-neutral-200 bg-white text-sm font-medium text-neutral-900 hover:bg-neutral-50"
          >
            {q.isFetchingNextPage ? t('myBookings.loading') : t('myBookings.loadMore')}
          </button>
        )}
      </div>
    </section>
  )
}

function Empty({ tab }: { tab: BookingTab }) {
  const t = useT()
  const Icon = tab === 'upcoming' ? CalendarX2 : tab === 'past' ? History : CheckCircle2
  const text = t(`myBookings.empty.${tab}`)
  return (
    <div className="flex flex-col items-center rounded-xl bg-white px-6 py-12 text-center shadow-sm">
      <Icon className="h-12 w-12 text-neutral-300" aria-hidden="true" />
      <p className="mt-3 font-semibold text-neutral-900">{text}</p>
      {tab === 'upcoming' && (
        <Link
          href="/discover"
          className="mt-4 rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
        >
          {t('myBookings.findPitch')}
        </Link>
      )}
    </div>
  )
}
