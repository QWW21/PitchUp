import type { Metadata } from 'next'
import { CheckCircle2 } from 'lucide-react'
import { formatDateLong } from '@pitchup/shared'
import { auth } from '@/auth'
import Link from 'next/link'
import { listDisputes } from '@/lib/admin/disputes'
import { DisputeDecision } from '@/components/admin/DisputeDecision'
import { getLocale, getT } from '@/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('admin.disputes.title') }
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

const OUTCOME: Record<string, ['playerRight' | 'venueRight', string]> = {
  RESOLVED_PLAYER: ['playerRight', 'bg-success-50 text-primary-700'],
  RESOLVED_MANAGER: ['venueRight', 'bg-info-50 text-blue-800'],
}

/** No-show disputes — E12-04, with decided ones too (E15-08). */
export default async function DisputesPage({ searchParams }: Props) {
  const locale = await getLocale()
  const t = await getT()
  // The layout checks too, but layouts and pages render in parallel.
  const session = await auth()
  if (session?.user.role !== 'ADMIN') return null
  const decided = (await searchParams).status === 'resolved'
  const disputes = await listDisputes(decided ? 'resolved' : 'open')
  const tab = (href: string, label: string, on: boolean) => (
    <Link
      href={href}
      aria-current={on ? 'page' : undefined}
      className={`flex h-10 items-center border-b-2 px-3 text-sm font-medium ${
        on ? 'border-primary-600 text-primary-700' : 'border-transparent text-neutral-700'
      }`}
    >
      {label}
    </Link>
  )
  return (
    <>
      <h1 className="text-2xl font-bold text-neutral-900">{t('admin.disputes.heading')}</h1>
      <nav
        aria-label={t('admin.disputes.tabs')}
        className="mt-3 flex gap-1 border-b border-neutral-200"
      >
        {tab('/admin/disputes', t('admin.disputes.open'), !decided)}
        {tab('/admin/disputes?status=resolved', t('admin.disputes.decided'), decided)}
      </nav>
      <p className="mt-3 text-sm text-neutral-500">
        {decided
          ? t('admin.disputes.decidedCount', { n: disputes.length })
          : disputes.length === 0
            ? t('admin.disputes.nothing')
            : t('admin.disputes.waitCount', { count: disputes.length })}
      </p>
      {disputes.length === 0 && !decided ? (
        <div className="mt-6 flex flex-col items-center rounded-xl bg-white px-6 py-12 text-center shadow-sm">
          <CheckCircle2 className="h-12 w-12 text-neutral-300" aria-hidden="true" />
          <p className="mt-3 font-semibold text-neutral-900">{t('admin.allCaughtUp')}</p>
        </div>
      ) : (
        <ul className="mt-6 space-y-4">
          {disputes.map(d => (
            <li key={d.bookingId}>
              <article
                aria-labelledby={`d-${d.bookingId}`}
                className="rounded-xl bg-white p-5 shadow-sm"
              >
                <h2 id={`d-${d.bookingId}`} className="text-lg font-semibold text-neutral-900">
                  {t('admin.disputes.at', { player: d.player.name, venue: d.venue })}
                </h2>
                <p className="text-sm text-neutral-700">
                  {d.pitch} · {formatDateLong(d.date, locale)}, {d.startTime}–{d.endTime} ·{' '}
                  {d.reference}
                </p>
                <dl className="mt-3 space-y-2 text-sm">
                  <div>
                    <dt className="font-medium text-neutral-900">
                      {t('admin.disputes.venueSays')}
                    </dt>
                    <dd className="text-neutral-700">
                      {d.managerReason ?? t('admin.disputes.noReason')}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-neutral-900">
                      {t('admin.disputes.playerSays')}
                    </dt>
                    <dd className="text-neutral-700">{d.disputeText ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-neutral-900">{t('admin.disputes.kept')}</dt>
                    <dd className="text-neutral-700">{d.keptAmount} RON</dd>
                  </div>
                </dl>
                {d.status === 'OPEN' ? (
                  <DisputeDecision bookingId={d.bookingId} />
                ) : (
                  <p className="mt-3 text-sm">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${OUTCOME[d.status]![1]}`}
                    >
                      {t(`admin.disputes.${OUTCOME[d.status]![0]}`)}
                    </span>{' '}
                    <span className="text-neutral-700">{d.resolution}</span>
                  </p>
                )}
              </article>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
