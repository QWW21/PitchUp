import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { INTL_LOCALE, normalizeWeek, weekdayShort } from '@pitchup/shared'
import { prisma } from '@/lib/prisma'
import { changeLines } from '@/lib/manager/venue'
import { CompanyStatusBadge } from '@/components/admin/CompanyStatusBadge'
import { CompanyStatusActions } from '@/components/admin/CompanyStatusActions'
import { CompanyDecision } from '@/components/admin/CompanyDecision'
import { getLocale, getT } from '@/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('admin.company.title') }
}

/** One venue — E15-06: its details, its manager, and what can be done with it. */
export default async function AdminCompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const [t, locale] = [await getT(), await getLocale()]
  const when = new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Bucharest',
  })
  const { id } = await params
  const c = await prisma.company.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true, email: true, createdAt: true } },
      pitches: { where: { deletedAt: null }, select: { id: true, name: true, isActive: true } },
    },
  })
  if (!c) notFound()
  const bookings = await prisma.booking.groupBy({
    by: ['status'],
    where: { pitch: { companyId: c.id } },
    _count: { _all: true },
  })
  const count = (s: string) => bookings.find(b => b.status === s)?._count._all ?? 0
  const lines = c.changesSubmittedAt ? changeLines(c, locale) : []
  const row = (label: string, value: React.ReactNode) => (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <dt className="w-40 shrink-0 text-neutral-500">{label}</dt>
      <dd className="text-neutral-900">{value}</dd>
    </div>
  )

  return (
    <>
      <Link href="/admin/companies" className="text-sm text-neutral-700 hover:underline">
        {t('admin.company.back')}
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-neutral-900">{c.name}</h1>
        <CompanyStatusBadge status={c.status} />
      </div>
      {c.status === 'SUSPENDED' && c.suspensionReason && (
        <p className="mt-2 text-sm text-error-600">
          {t('admin.company.suspended', { reason: c.suspensionReason })}
        </p>
      )}
      {c.status === 'DRAFT' && c.rejectionReason && (
        <p className="mt-2 text-sm text-neutral-700">
          {t('admin.company.sentBack', { reason: c.rejectionReason })}
        </p>
      )}

      <section aria-labelledby="actions" className="mt-6 rounded-xl bg-white p-5 shadow-sm">
        <h2 id="actions" className="text-lg font-semibold text-neutral-900">
          {t('admin.company.status')}
        </h2>
        {c.status === 'PENDING' ? (
          <CompanyDecision companyId={c.id} companyName={c.name} />
        ) : (
          <CompanyStatusActions companyId={c.id} companyName={c.name} status={c.status} />
        )}
      </section>

      {lines.length > 0 && (
        <section aria-labelledby="changes" className="mt-6 rounded-xl bg-white p-5 shadow-sm">
          <h2 id="changes" className="text-lg font-semibold text-neutral-900">
            {t('admin.company.changes')}
          </h2>
          <ul className="mt-2 space-y-1 text-sm">
            {lines.map(l => (
              <li key={l.field}>
                <span className="font-medium">{l.field}:</span> {l.before} →{' '}
                <span className="font-medium">{l.after}</span>
              </li>
            ))}
          </ul>
          <CompanyDecision companyId={c.id} companyName={c.name} changes />
        </section>
      )}

      <section aria-labelledby="details" className="mt-6 rounded-xl bg-white p-5 shadow-sm">
        <h2 id="details" className="text-lg font-semibold text-neutral-900">
          {t('admin.company.details')}
        </h2>
        <dl className="mt-3 space-y-2 text-sm">
          {row(
            t('admin.company.address'),
            [c.addressLine1, c.addressLine2, c.postalCode, c.city, c.county]
              .filter(Boolean)
              .join(', ') || '—'
          )}
          {row(t('admin.company.contact'), [c.phone, c.email].filter(Boolean).join(' · ') || '—')}
          {row(t('admin.company.website'), c.websiteUrl ?? '—')}
          {row(
            t('admin.company.payouts'),
            c.stripeAccountId ? t('admin.companies.stripe') : t('admin.companies.notConnected')
          )}
          {row(
            t('admin.company.hours'),
            c.workingHours
              ? normalizeWeek(c.workingHours)
                  .map(
                    d =>
                      `${weekdayShort(d.day, locale)} ${d.isClosed ? t('hours.closed').toLowerCase() : `${d.openTime}–${d.closeTime}`}`
                  )
                  .join(', ')
              : '—'
          )}
          {row(t('admin.company.created'), when.format(c.createdAt))}
          {row(
            t('admin.company.pitches'),
            c.pitches.length
              ? c.pitches
                  .map(p => `${p.name}${p.isActive ? '' : t('admin.company.inactive')}`)
                  .join(', ')
              : t('admin.company.noneYet')
          )}
          {row(
            t('admin.company.bookings'),
            t('admin.company.bookingsLine', {
              played: count('COMPLETED'),
              upcoming: count('CONFIRMED') + count('AWAITING_APPROVAL'),
              cancelled: count('CANCELLED'),
              noShows: count('NO_SHOW'),
            })
          )}
        </dl>
      </section>

      <section aria-labelledby="manager" className="mt-6 rounded-xl bg-white p-5 shadow-sm">
        <h2 id="manager" className="text-lg font-semibold text-neutral-900">
          {t('admin.company.manager')}
        </h2>
        <p className="mt-2 text-sm">
          <Link
            href={`/admin/users/${c.owner.id}`}
            className="font-medium text-primary-700 underline"
          >
            {c.owner.name}
          </Link>{' '}
          <span className="text-neutral-700">
            {t('admin.company.joined', {
              email: c.owner.email,
              when: when.format(c.owner.createdAt),
            })}
          </span>
        </p>
      </section>
    </>
  )
}
