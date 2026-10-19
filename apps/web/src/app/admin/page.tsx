import type { Metadata } from 'next'
import Link from 'next/link'
import { AlertTriangle, ChevronRight } from 'lucide-react'
import { platformStats } from '@/lib/admin/stats'
import { AutoRefresh } from '@/components/admin/AutoRefresh'

export const metadata: Metadata = { title: 'Admin | PitchUp' }

const number = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 })
const ron = (n: number) => `${number.format(n)} RON`

/** The platform at a glance — E15-09. Refreshed every minute. */
export default async function AdminOverviewPage() {
  const s = await platformStats()
  const cards: [string, string, string?][] = [
    ['Users', number.format(s.users), `${s.players} players · ${s.managers} managers`],
    [
      'Venues',
      number.format(s.companies.total),
      `${s.companies.active} live · ${s.companies.suspended} suspended`,
    ],
    ['Bookable pitches', number.format(s.activePitches)],
    ['Bookings played', number.format(s.bookings)],
    ['Booking value', ron(s.gmv), `${ron(s.last30dGmv)} in the last 30 days`],
    ['PitchUp fees', ron(s.fees)],
    ['Suspended accounts', number.format(s.suspendedUsers)],
  ]
  const queue = [
    {
      count: s.companies.pending,
      label: 'venues wait for approval',
      href: '/admin/companies',
    },
    { count: s.venueChanges, label: 'venues changed their details', href: '/admin/companies' },
    { count: s.openDisputes, label: 'open disputes', href: '/admin/disputes' },
    { count: s.reportedReviews, label: 'reported reviews', href: '/admin/reviews' },
  ]

  return (
    <>
      <AutoRefresh seconds={60} />
      <h1 className="text-2xl font-bold text-neutral-900">Platform overview</h1>
      {s.openDisputes > 0 && (
        <div
          role="status"
          className="mt-4 flex items-center gap-3 rounded-lg border border-error-500 bg-error-50 p-4"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-error-600" aria-hidden="true" />
          <p className="text-sm text-error-600">
            <span className="font-semibold">
              {s.openDisputes} open {s.openDisputes === 1 ? 'dispute' : 'disputes'}
            </span>{' '}
            <Link href="/admin/disputes" className="underline">
              Decide now
            </Link>
          </p>
        </div>
      )}
      <section
        aria-label="Figures"
        className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {cards.map(([label, value, note]) => (
          <div key={label} className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-sm text-neutral-700">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-neutral-900">{value}</p>
            {note && <p className="text-xs text-neutral-500">{note}</p>}
          </div>
        ))}
      </section>
      <section aria-labelledby="queue-heading" className="mt-8">
        <h2 id="queue-heading" className="text-lg font-semibold text-neutral-900">
          Waiting for you
        </h2>
        <ul className="mt-3 divide-y divide-neutral-100 rounded-xl bg-white shadow-sm">
          {queue.map(q => (
            <li key={q.label}>
              <Link
                href={q.href}
                className="flex h-14 items-center gap-3 px-4 text-sm hover:bg-neutral-50"
              >
                <span
                  className={`min-w-8 rounded-full px-2 py-0.5 text-center font-semibold ${
                    q.count ? 'bg-warning-50 text-amber-800' : 'bg-neutral-100 text-neutral-700'
                  }`}
                >
                  {q.count}
                </span>
                <span className="text-neutral-900">{q.label}</span>
                <ChevronRight className="ml-auto h-4 w-4 text-neutral-500" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
