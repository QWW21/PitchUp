import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { auth } from '@/auth'
import { ApiException } from '@/lib/api/errors'
import { userDetail } from '@/lib/admin/users'
import { UserAdminActions } from '@/components/admin/UserAdminActions'
import { INTL_LOCALE } from '@pitchup/shared'
import { getLocale, getT } from '@/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('admin.user.title') }
}

const BAR: Record<string, string> = {
  Excellent: 'bg-primary-600',
  Good: 'bg-primary-500',
  Fair: 'bg-neutral-500',
  Poor: 'bg-warning-500',
  Suspended: 'bg-error-600',
}

/** One account — E15-07: profile, bookings, trust and what an admin can do. */
export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, session] = await Promise.all([params, auth()])
  const u = await userDetail(id).catch(caught => {
    if (caught instanceof ApiException && caught.code === 'NOT_FOUND') notFound()
    throw caught
  })
  const t = await getT()
  const when = new Intl.DateTimeFormat(INTL_LOCALE[await getLocale()], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Bucharest',
  })

  return (
    <>
      <Link href="/admin/users" className="text-sm text-neutral-700 hover:underline">
        {t('admin.user.back')}
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-neutral-900">{u.name}</h1>
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
          {t(`admin.users.role.${u.role as 'PLAYER' | 'MANAGER' | 'ADMIN'}`)}
        </span>
        {u.suspendedAt && (
          <span className="rounded-full bg-error-50 px-2 py-0.5 text-xs font-medium text-error-600">
            {t('admin.users.suspended')}
          </span>
        )}
        {u.deletedAt && (
          <span className="text-xs text-neutral-500">{t('admin.users.deleted')}</span>
        )}
      </div>
      {u.suspendedAt && u.suspensionReason && (
        <p className="mt-2 text-sm text-error-600">
          {t('admin.user.suspendedOn', {
            when: when.format(new Date(u.suspendedAt)),
            reason: u.suspensionReason,
          })}
        </p>
      )}

      <section aria-labelledby="profile" className="mt-6 rounded-xl bg-white p-5 shadow-sm">
        <h2 id="profile" className="text-lg font-semibold text-neutral-900">
          {t('admin.user.profile')}
        </h2>
        <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-neutral-500">{t('admin.user.email')}</dt>
            <dd className="text-neutral-900">
              {u.email} {u.emailVerified ? '' : t('admin.user.notVerified')}
            </dd>
          </div>
          <div>
            <dt className="text-neutral-500">{t('admin.user.phone')}</dt>
            <dd className="text-neutral-900">
              {u.phone} {u.phoneVerified ? '' : t('admin.user.notVerified')}
            </dd>
          </div>
          <div>
            <dt className="text-neutral-500">{t('admin.user.joined')}</dt>
            <dd className="text-neutral-900">{when.format(new Date(u.createdAt))}</dd>
          </div>
          {u.company && (
            <div>
              <dt className="text-neutral-500">{t('admin.user.venue')}</dt>
              <dd>
                <Link
                  href={`/admin/companies/${u.company.id}`}
                  className="text-primary-700 hover:underline"
                >
                  {u.company.name}
                </Link>
              </dd>
            </div>
          )}
          <div className="sm:col-span-2">
            <dt className="text-neutral-500">{t('admin.user.bookings')}</dt>
            <dd className="text-neutral-900">
              {t('admin.user.bookingsLine', {
                played: u.stats.completed,
                upcoming: u.stats.upcoming,
                cancelled: u.stats.cancelled,
                late: u.stats.lateCancels,
                noShows: u.stats.noShows,
              })}
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="trust" className="mt-6 rounded-xl bg-white p-5 shadow-sm">
        <h2 id="trust" className="text-lg font-semibold text-neutral-900">
          {t('admin.user.trust', { score: u.trustScore, tier: t(`trust.tier.${u.tier}`) })}
        </h2>
        <div
          className="mt-3 h-2 w-full rounded-full bg-neutral-100"
          role="img"
          aria-label={t('admin.user.outOf', { score: u.trustScore })}
        >
          <div
            className={`h-2 rounded-full ${BAR[u.tier]}`}
            style={{ width: `${u.trustScore}%` }}
          />
        </div>
        {u.trustHistory.length > 0 ? (
          <ul className="mt-4 divide-y divide-neutral-100 text-sm">
            {u.trustHistory.map(e => (
              <li key={e.id} className="flex items-start justify-between gap-3 py-2">
                <span>
                  <span className="text-neutral-900">{e.label}</span>
                  {e.note && <span className="block text-xs text-neutral-700">{e.note}</span>}
                  <span className="block text-xs text-neutral-500">
                    {when.format(new Date(e.at))}
                  </span>
                </span>
                <span
                  className={`font-semibold ${e.delta < 0 ? 'text-error-600' : 'text-primary-700'}`}
                >
                  {e.delta > 0 ? '+' : ''}
                  {e.delta}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-neutral-700">{t('admin.user.noChanges')}</p>
        )}
      </section>

      {!u.deletedAt && (
        <UserAdminActions
          user={{
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
            suspended: !!u.suspendedAt,
            trustScore: u.trustScore,
          }}
          isSelf={session?.user.id === u.id}
        />
      )}
    </>
  )
}
