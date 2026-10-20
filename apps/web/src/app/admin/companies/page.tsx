import type { Metadata } from 'next'
import { Building2, CheckCircle2 } from 'lucide-react'
import { auth } from '@/auth'
import Link from 'next/link'
import { AdminCompanyQuerySchema } from '@pitchup/shared'
import { listCompanies, listPendingCompanies } from '@/lib/admin/companies'
import { VenueFilters } from '@/components/admin/VenueFilters'
import { CompanyStatusBadge } from '@/components/admin/CompanyStatusBadge'
import { listVenueChanges } from '@/lib/manager/venue'
import { CompanyDecision } from '@/components/admin/CompanyDecision'
import { INTL_LOCALE } from '@pitchup/shared'
import { getLocale, getT } from '@/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('admin.companies.title') }
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

/**
 * Venues — E09's approvals (oldest first), C-13's changes to live venues,
 * and every venue with filters (E15-06), each opening its own page.
 */
export default async function AdminCompaniesPage({ searchParams }: Props) {
  // The layout checks too, but layouts and pages render in parallel.
  const session = await auth()
  if (session?.user.role !== 'ADMIN') return null
  const t = await getT()
  const when = new Intl.DateTimeFormat(INTL_LOCALE[await getLocale()], {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Bucharest',
  })
  const raw = await searchParams
  const parsed = AdminCompanyQuerySchema.safeParse({
    status: typeof raw.status === 'string' && raw.status ? raw.status : undefined,
    search: typeof raw.search === 'string' && raw.search.trim() ? raw.search : undefined,
    cursor: typeof raw.cursor === 'string' ? raw.cursor : undefined,
  })
  const query = parsed.success ? parsed.data : AdminCompanyQuerySchema.parse({})
  const [companies, changes, all] = await Promise.all([
    listPendingCompanies(),
    listVenueChanges(),
    listCompanies(query),
  ])

  return (
    <>
      <h1 className="text-2xl font-bold text-neutral-900">{t('admin.companies.heading')}</h1>
      <h2 className="mt-6 text-xl font-bold text-neutral-900">
        {t('admin.companies.waitingHeading')}
      </h2>
      <p className="mt-1 text-sm text-neutral-500">
        {companies.length === 0
          ? t('admin.companies.nothing')
          : t('admin.companies.waitCount', { count: companies.length })}
      </p>
      {companies.length === 0 ? (
        <div className="mt-6 flex flex-col items-center rounded-xl bg-white px-6 py-12 text-center shadow-sm">
          <CheckCircle2 className="h-12 w-12 text-neutral-300" aria-hidden="true" />
          <p className="mt-3 font-semibold text-neutral-900">{t('admin.allCaughtUp')}</p>
        </div>
      ) : (
        <ul className="mt-6 space-y-4">
          {companies.map(c => (
            <li key={c.id}>
              <article aria-labelledby={`co-${c.id}`} className="rounded-xl bg-white p-5 shadow-sm">
                <div className="flex items-start gap-4">
                  {c.logoUrl ? (
                    <img src={c.logoUrl} alt="" className="h-16 w-16 rounded-md object-cover" />
                  ) : (
                    <span className="flex h-16 w-16 items-center justify-center rounded-md bg-neutral-100">
                      <Building2 className="h-7 w-7 text-neutral-400" aria-hidden="true" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <h2 id={`co-${c.id}`} className="text-lg font-semibold text-neutral-900">
                      {c.name}
                    </h2>
                    <p className="text-sm text-neutral-700">
                      {c.address}, {c.city}
                    </p>
                    {c.submittedAt && (
                      <p className="text-xs text-neutral-500">
                        {t('admin.companies.submitted', {
                          when: when.format(new Date(c.submittedAt)),
                        })}
                      </p>
                    )}
                  </div>
                </div>
                {c.description && <p className="mt-3 text-sm text-neutral-700">{c.description}</p>}
                <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="inline text-neutral-500">{t('admin.companies.manager')}</dt>
                    <dd className="inline text-neutral-900">
                      {c.manager.name} ({c.manager.email})
                    </dd>
                  </div>
                  <div>
                    <dt className="inline text-neutral-500">
                      {t('admin.companies.publicContact')}
                    </dt>
                    <dd className="inline text-neutral-900">
                      {[c.phone, c.email].filter(Boolean).join(' · ') || '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline text-neutral-500">{t('admin.companies.payouts')}</dt>
                    <dd className="inline text-neutral-900">
                      {c.stripeConnected
                        ? t('admin.companies.stripe')
                        : t('admin.companies.notConnected')}
                    </dd>
                  </div>
                  {c.websiteUrl && (
                    <div>
                      <dt className="inline text-neutral-500">{t('admin.companies.website')}</dt>
                      <dd className="inline">
                        <a
                          href={c.websiteUrl}
                          className="text-primary-700 underline"
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          {c.websiteUrl}
                        </a>
                      </dd>
                    </div>
                  )}
                </dl>
                <CompanyDecision companyId={c.id} companyName={c.name} />
              </article>
            </li>
          ))}
        </ul>
      )}
      <h2 className="mt-10 text-xl font-bold text-neutral-900">
        {t('admin.companies.changesHeading')}
      </h2>
      <p className="mt-1 text-sm text-neutral-500">
        {changes.length === 0 ? t('admin.companies.noChanges') : t('admin.companies.keepsCurrent')}
      </p>
      {changes.length > 0 && (
        <ul className="mt-4 space-y-4">
          {changes.map(c => (
            <li key={c.companyId}>
              <article
                aria-labelledby={`chg-${c.companyId}`}
                className="rounded-xl bg-white p-5 shadow-sm"
              >
                <h3 id={`chg-${c.companyId}`} className="text-lg font-semibold text-neutral-900">
                  {c.companyName}
                </h3>
                <p className="text-xs text-neutral-500">
                  {t('admin.companies.sent', {
                    name: c.manager.name,
                    email: c.manager.email,
                    when: when.format(new Date(c.submittedAt)),
                  })}
                </p>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[32rem] text-left text-sm">
                    <thead className="text-xs text-neutral-500">
                      <tr>
                        <th scope="col" className="py-1 pr-3 font-medium">
                          {t('admin.companies.field')}
                        </th>
                        <th scope="col" className="py-1 pr-3 font-medium">
                          {t('admin.companies.now')}
                        </th>
                        <th scope="col" className="py-1 font-medium">
                          {t('admin.companies.proposed')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 align-top">
                      {c.lines.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="py-2 text-neutral-700">
                            {t('admin.companies.sameAgain')}
                          </td>
                        </tr>
                      ) : (
                        c.lines.map(l => (
                          <tr key={l.field}>
                            <th scope="row" className="py-2 pr-3 font-medium text-neutral-900">
                              {l.field}
                            </th>
                            <td className="py-2 pr-3 text-neutral-700">{l.before}</td>
                            <td className="py-2 font-medium text-neutral-900">{l.after}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <CompanyDecision companyId={c.companyId} companyName={c.companyName} changes />
              </article>
            </li>
          ))}
        </ul>
      )}
      <h2 className="mt-10 text-xl font-bold text-neutral-900">{t('admin.companies.all')}</h2>
      <VenueFilters status={query.status ?? ''} search={query.search ?? ''} />
      {all.items.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-700">{t('admin.companies.noneMatch')}</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl bg-white shadow-sm">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b border-neutral-200 text-xs text-neutral-700">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">
                  {t('admin.companies.venue')}
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  {t('admin.companies.managerCol')}
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  {t('admin.companies.pitches')}
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  {t('admin.companies.status')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {all.items.map(c => (
                <tr key={c.id}>
                  <th scope="row" className="px-4 py-3 font-medium">
                    <Link
                      href={`/admin/companies/${c.id}`}
                      className="text-primary-700 hover:underline"
                    >
                      {c.name}
                    </Link>
                    <span className="block text-xs font-normal text-neutral-500">
                      {c.city ?? '—'}
                    </span>
                  </th>
                  <td className="px-4 py-3 text-neutral-700">
                    {c.manager.name}
                    <span className="block text-xs text-neutral-500">{c.manager.email}</span>
                  </td>
                  <td className="px-4 py-3 text-neutral-700">{c.pitchCount}</td>
                  <td className="px-4 py-3">
                    <CompanyStatusBadge status={c.status} />
                    {c.hasChanges && (
                      <span className="ml-1 text-xs text-amber-800">
                        {t('admin.companies.changesWaiting')}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {all.nextCursor && (
        <Link
          href={`/admin/companies?${new URLSearchParams({
            ...(query.status ? { status: query.status } : {}),
            ...(query.search ? { search: query.search } : {}),
            cursor: all.nextCursor,
          })}`}
          className="mt-4 inline-flex h-10 items-center rounded-md border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
        >
          {t('admin.nextPage')}
        </Link>
      )}
    </>
  )
}
