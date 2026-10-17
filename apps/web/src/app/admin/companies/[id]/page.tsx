import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DAY_SHORT, normalizeWeek } from '@pitchup/shared'
import { prisma } from '@/lib/prisma'
import { changeLines } from '@/lib/manager/venue'
import { CompanyStatusBadge } from '@/components/admin/CompanyStatusBadge'
import { CompanyStatusActions } from '@/components/admin/CompanyStatusActions'
import { CompanyDecision } from '@/components/admin/CompanyDecision'

export const metadata: Metadata = { title: 'Venue | PitchUp admin' }

const when = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Europe/Bucharest',
})

/** One venue — E15-06: its details, its manager, and what can be done with it. */
export default async function AdminCompanyPage({ params }: { params: Promise<{ id: string }> }) {
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
  const lines = c.changesSubmittedAt ? changeLines(c) : []
  const row = (label: string, value: React.ReactNode) => (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <dt className="w-40 shrink-0 text-neutral-500">{label}</dt>
      <dd className="text-neutral-900">{value}</dd>
    </div>
  )

  return (
    <>
      <Link href="/admin/companies" className="text-sm text-neutral-700 hover:underline">
        ← Venues
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-neutral-900">{c.name}</h1>
        <CompanyStatusBadge status={c.status} />
      </div>
      {c.status === 'SUSPENDED' && c.suspensionReason && (
        <p className="mt-2 text-sm text-error-600">Suspended: {c.suspensionReason}</p>
      )}
      {c.status === 'DRAFT' && c.rejectionReason && (
        <p className="mt-2 text-sm text-neutral-700">Sent back: {c.rejectionReason}</p>
      )}

      <section aria-labelledby="actions" className="mt-6 rounded-xl bg-white p-5 shadow-sm">
        <h2 id="actions" className="text-lg font-semibold text-neutral-900">
          Status
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
            Changes waiting for approval
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
          Details
        </h2>
        <dl className="mt-3 space-y-2 text-sm">
          {row(
            'Address',
            [c.addressLine1, c.addressLine2, c.postalCode, c.city, c.county]
              .filter(Boolean)
              .join(', ') || '—'
          )}
          {row('Contact', [c.phone, c.email].filter(Boolean).join(' · ') || '—')}
          {row('Website', c.websiteUrl ?? '—')}
          {row('Payouts', c.stripeAccountId ? 'Stripe connected' : 'Not connected')}
          {row(
            'Opening hours',
            c.workingHours
              ? normalizeWeek(c.workingHours)
                  .map(
                    d =>
                      `${DAY_SHORT[d.day]} ${d.isClosed ? 'closed' : `${d.openTime}–${d.closeTime}`}`
                  )
                  .join(', ')
              : '—'
          )}
          {row('Created', when.format(c.createdAt))}
          {row(
            'Pitches',
            c.pitches.length
              ? c.pitches.map(p => `${p.name}${p.isActive ? '' : ' (inactive)'}`).join(', ')
              : 'None yet'
          )}
          {row(
            'Bookings',
            `${count('COMPLETED')} played · ${count('CONFIRMED') + count('AWAITING_APPROVAL')} upcoming · ${count('CANCELLED')} cancelled · ${count('NO_SHOW')} no-shows`
          )}
        </dl>
      </section>

      <section aria-labelledby="manager" className="mt-6 rounded-xl bg-white p-5 shadow-sm">
        <h2 id="manager" className="text-lg font-semibold text-neutral-900">
          Manager
        </h2>
        <p className="mt-2 text-sm">
          <Link
            href={`/admin/users/${c.owner.id}`}
            className="font-medium text-primary-700 underline"
          >
            {c.owner.name}
          </Link>{' '}
          <span className="text-neutral-700">
            · {c.owner.email} · joined {when.format(c.owner.createdAt)}
          </span>
        </p>
      </section>
    </>
  )
}
