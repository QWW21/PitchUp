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

export const metadata: Metadata = { title: 'Venue approvals | PitchUp' }

const when = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Bucharest',
})

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

/**
 * Venues — E09's approvals (oldest first), C-13's changes to live venues,
 * and every venue with filters (E15-06), each opening its own page.
 */
export default async function AdminCompaniesPage({ searchParams }: Props) {
  // The layout checks too, but layouts and pages render in parallel.
  const session = await auth()
  if (session?.user.role !== 'ADMIN') return null
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
      <h1 className="text-2xl font-bold text-neutral-900">Venues</h1>
      <h2 className="mt-6 text-xl font-bold text-neutral-900">Waiting for approval</h2>
      <p className="mt-1 text-sm text-neutral-500">
        {companies.length === 0
          ? 'Nothing to review.'
          : `${companies.length} ${companies.length === 1 ? 'venue waits' : 'venues wait'} for a decision.`}
      </p>
      {companies.length === 0 ? (
        <div className="mt-6 flex flex-col items-center rounded-xl bg-white px-6 py-12 text-center shadow-sm">
          <CheckCircle2 className="h-12 w-12 text-neutral-300" aria-hidden="true" />
          <p className="mt-3 font-semibold text-neutral-900">All caught up</p>
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
                        Submitted {when.format(new Date(c.submittedAt))}
                      </p>
                    )}
                  </div>
                </div>
                {c.description && <p className="mt-3 text-sm text-neutral-700">{c.description}</p>}
                <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="inline text-neutral-500">Manager: </dt>
                    <dd className="inline text-neutral-900">
                      {c.manager.name} ({c.manager.email})
                    </dd>
                  </div>
                  <div>
                    <dt className="inline text-neutral-500">Public contact: </dt>
                    <dd className="inline text-neutral-900">
                      {[c.phone, c.email].filter(Boolean).join(' · ') || '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline text-neutral-500">Payouts: </dt>
                    <dd className="inline text-neutral-900">
                      {c.stripeConnected ? 'Stripe connected' : 'Not connected'}
                    </dd>
                  </div>
                  {c.websiteUrl && (
                    <div>
                      <dt className="inline text-neutral-500">Website: </dt>
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
      <h2 className="mt-10 text-xl font-bold text-neutral-900">Changes to live venues</h2>
      <p className="mt-1 text-sm text-neutral-500">
        {changes.length === 0
          ? 'No changes to review.'
          : 'Each venue keeps its current details until you approve.'}
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
                  {c.manager.name} ({c.manager.email}) · sent {when.format(new Date(c.submittedAt))}
                </p>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[32rem] text-left text-sm">
                    <thead className="text-xs text-neutral-500">
                      <tr>
                        <th scope="col" className="py-1 pr-3 font-medium">
                          Field
                        </th>
                        <th scope="col" className="py-1 pr-3 font-medium">
                          Now
                        </th>
                        <th scope="col" className="py-1 font-medium">
                          Proposed
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 align-top">
                      {c.lines.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="py-2 text-neutral-700">
                            Sent again without changes.
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
      <h2 className="mt-10 text-xl font-bold text-neutral-900">All venues</h2>
      <VenueFilters status={query.status ?? ''} search={query.search ?? ''} />
      {all.items.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-700">No venues match.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl bg-white shadow-sm">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b border-neutral-200 text-xs text-neutral-700">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">
                  Venue
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Manager
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Pitches
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Status
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
                      <span className="ml-1 text-xs text-amber-800">changes waiting</span>
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
          Next page
        </Link>
      )}
    </>
  )
}
