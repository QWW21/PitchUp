import type { Metadata } from 'next'
import { Building2, CheckCircle2 } from 'lucide-react'
import { auth } from '@/auth'
import { listPendingCompanies } from '@/lib/admin/companies'
import { CompanyDecision } from '@/components/admin/CompanyDecision'

export const metadata: Metadata = { title: 'Venue approvals | PitchUp' }

const when = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Bucharest',
})

/** Venues waiting for approval, oldest first — the minimal admin step agreed for E09. */
export default async function AdminCompaniesPage() {
  // The layout checks too, but layouts and pages render in parallel.
  const session = await auth()
  if (session?.user.role !== 'ADMIN') return null
  const companies = await listPendingCompanies()

  return (
    <>
      <h1 className="text-2xl font-bold text-neutral-900">Venue approvals</h1>
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
    </>
  )
}
