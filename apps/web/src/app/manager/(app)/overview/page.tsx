import type { Metadata } from 'next'
import { AlertTriangle, CalendarCheck, Gauge, Wallet, type LucideIcon } from 'lucide-react'
import { formatDateLong } from '@pitchup/shared'
import { requireActiveManager } from '@/lib/manager/access'
import { managerStats } from '@/lib/manager/stats'
import { getLocale, getT } from '@/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('mVenue.overview.title') }
}

/**
 * The manager's start page — E09-10 (UIUX_SPEC §13.1): four numbers for
 * today and the next ten bookings. Rendered on the server from the same
 * service as GET /manager/stats/today.
 */
export default async function OverviewPage() {
  const locale = await getLocale()
  const t = await getT()
  const { company } = await requireActiveManager()
  const s = await managerStats(company.id)

  return (
    <>
      <h1 className="sr-only">{t('mVenue.overview.heading')}</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Wallet}
          tone="text-primary-600"
          label={t('mVenue.overview.revenue')}
          value={`${s.revenueToday} RON`}
          delta={s.revenueDelta}
          deltaText={d =>
            t('mVenue.overview.vsLastWeek', { sign: d >= 0 ? '+' : '−', n: Math.abs(d) })
          }
        />
        <StatCard
          icon={CalendarCheck}
          tone="text-accent-600"
          label={t('mVenue.overview.bookings')}
          value={String(s.bookingsToday)}
          delta={s.bookingsDelta}
          deltaText={d =>
            t('mVenue.overview.vsLastWeek', { sign: d >= 0 ? '+' : '−', n: Math.abs(d) })
          }
        />
        <StatCard
          icon={Gauge}
          tone="text-info-500"
          label={t('mVenue.overview.occupancy')}
          value={`${s.occupancyRate}%`}
        />
        <StatCard
          icon={AlertTriangle}
          tone="text-warning-500"
          label={t('mVenue.overview.noShows')}
          value={String(s.noShowsThisWeek)}
        />
      </div>

      <section aria-labelledby="upcoming-heading" className="mt-8">
        <h2 id="upcoming-heading" className="text-lg font-semibold text-neutral-900">
          {t('mVenue.overview.next')}
        </h2>
        <div className="mt-3 overflow-x-auto rounded-xl bg-white shadow-sm">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-neutral-50 text-xs font-medium uppercase text-neutral-500">
              <tr>
                <th scope="col" className="px-4 py-3">
                  {t('mVenue.overview.time')}
                </th>
                <th scope="col" className="px-4 py-3">
                  {t('mVenue.overview.pitch')}
                </th>
                <th scope="col" className="px-4 py-3">
                  {t('mVenue.overview.player')}
                </th>
                <th scope="col" className="px-4 py-3">
                  {t('mVenue.overview.status')}
                </th>
                <th scope="col" className="px-4 py-3">
                  {t('mVenue.overview.booking')}
                </th>
              </tr>
            </thead>
            <tbody>
              {s.upcoming.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-neutral-500">
                    {t('mVenue.overview.none')}
                  </td>
                </tr>
              ) : (
                s.upcoming.map(b => (
                  <tr key={b.id} className="h-14 border-t border-neutral-100">
                    <td className="px-4">
                      <span className="block font-medium text-neutral-900">
                        {b.startTime}–{b.endTime}
                      </span>
                      <span className="text-xs text-neutral-500">
                        {formatDateLong(b.date, locale)}
                      </span>
                    </td>
                    <td className="px-4 text-neutral-700">{b.pitch}</td>
                    <td className="px-4 text-neutral-700">{b.player}</td>
                    <td className="px-4">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          b.status === 'CONFIRMED'
                            ? 'bg-primary-50 text-primary-700'
                            : 'bg-warning-50 text-amber-800'
                        }`}
                      >
                        {t(`mBookings.status.${b.status}`)}
                      </span>
                    </td>
                    <td className="px-4 font-mono text-xs text-neutral-500">{b.reference}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

function StatCard({
  icon: Icon,
  tone,
  label,
  value,
  delta,
  deltaText,
}: {
  icon: LucideIcon
  tone: string
  label: string
  value: string
  delta?: number | null
  deltaText?: (delta: number) => string
}) {
  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <Icon className={`h-8 w-8 ${tone}`} aria-hidden="true" />
      <p className="mt-3 text-3xl font-bold text-neutral-900">{value}</p>
      <p className="text-sm text-neutral-500">{label}</p>
      {delta !== undefined && delta !== null && deltaText && (
        <p
          className={`mt-1 text-xs font-medium ${delta >= 0 ? 'text-primary-700' : 'text-error-600'}`}
        >
          {deltaText(delta)}
        </p>
      )}
    </div>
  )
}
