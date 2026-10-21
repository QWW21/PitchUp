import type { Metadata } from 'next'
import Link from 'next/link'
import { AlertTriangle, ChevronRight } from 'lucide-react'
import { platformStats } from '@/lib/admin/stats'
import { AutoRefresh } from '@/components/admin/AutoRefresh'
import { getLocale, getT } from '@/i18n/server'
import { formatNumber, formatRon } from '@pitchup/shared'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('admin.overview.title') }
}

/** The platform at a glance — E15-09. Refreshed every minute. */
export default async function AdminOverviewPage() {
  const s = await platformStats()
  const t = await getT()
  const locale = await getLocale()
  const number = { format: (n: number) => formatNumber(n, locale) }
  const ron = (n: number) => formatRon(n, locale)
  const cards: [string, string, string?][] = [
    [
      t('admin.overview.users'),
      number.format(s.users),
      t('admin.overview.usersNote', { players: s.players, managers: s.managers }),
    ],
    [
      t('admin.overview.venues'),
      number.format(s.companies.total),
      t('admin.overview.venuesNote', {
        active: s.companies.active,
        suspended: s.companies.suspended,
      }),
    ],
    [t('admin.overview.pitches'), number.format(s.activePitches)],
    [t('admin.overview.played'), number.format(s.bookings)],
    [
      t('admin.overview.value'),
      ron(s.gmv),
      t('admin.overview.valueNote', { amount: ron(s.last30dGmv) }),
    ],
    [
      t('admin.overview.revenue'),
      ron(s.revenue),
      t('admin.overview.valueNote', { amount: ron(s.last30dRevenue) }),
    ],
    [
      t('admin.overview.subscribed'),
      number.format(
        s.subscriptions.TRIALING +
          s.subscriptions.ACTIVE +
          s.subscriptions.PAST_DUE +
          s.subscriptions.CANCELLING
      ),
      t('admin.overview.subscribedNote', {
        trialing: s.subscriptions.TRIALING,
        pastDue: s.subscriptions.PAST_DUE,
        off: s.subscriptions.NONE + s.subscriptions.PAUSED,
      }),
    ],
    [t('admin.overview.suspended'), number.format(s.suspendedUsers)],
  ]
  const queue = [
    {
      count: s.companies.pending,
      label: t('admin.overview.queue.pending'),
      href: '/admin/companies',
    },
    { count: s.venueChanges, label: t('admin.overview.queue.changes'), href: '/admin/companies' },
    { count: s.openDisputes, label: t('admin.overview.queue.disputes'), href: '/admin/disputes' },
    { count: s.reportedReviews, label: t('admin.overview.queue.reviews'), href: '/admin/reviews' },
  ]

  return (
    <>
      <AutoRefresh seconds={60} />
      <h1 className="text-2xl font-bold text-neutral-900">{t('admin.overview.heading')}</h1>
      {s.openDisputes > 0 && (
        <div
          role="status"
          className="mt-4 flex items-center gap-3 rounded-lg border border-error-500 bg-error-50 p-4"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-error-600" aria-hidden="true" />
          <p className="text-sm text-error-600">
            <span className="font-semibold">
              {t('admin.overview.openDisputes', { count: s.openDisputes })}
            </span>{' '}
            <Link href="/admin/disputes" className="underline">
              {t('admin.overview.decide')}
            </Link>
          </p>
        </div>
      )}
      <section
        aria-label={t('admin.overview.figures')}
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
          {t('admin.overview.waiting')}
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
