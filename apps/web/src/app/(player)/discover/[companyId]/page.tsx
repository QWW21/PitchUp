import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense, cache } from 'react'
import { BadgeCheck, Building2, ChevronLeft, Globe, MapPin, Phone } from 'lucide-react'
import { auth } from '@/auth'
import { getCompanyDetail } from '@/lib/venues/company'
import { RatingLine } from '@/components/venue/bits'
import { WorkingHours } from '@/components/venue/WorkingHours'
import { CompanyTabs } from './CompanyTabs'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ companyId: string }> }

/** One query per request, shared by the metadata and the page. */
const loadCompany = cache((id: string) => getCompanyDetail(id))

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const company = await loadCompany((await params).companyId)
  if (!company) return { title: 'Company not found · PitchUp' }
  const description =
    company.description?.slice(0, 155) ??
    `${company.pitches.length} football pitches at ${company.name}, ${company.city}. Book online with PitchUp.`
  return {
    title: `${company.name} — ${company.city} | PitchUp`,
    description,
    openGraph: {
      title: company.name,
      description,
      ...(company.pitches[0]?.coverPhotoUrl ? { images: [company.pitches[0].coverPhotoUrl] } : {}),
    },
  }
}

/** Company detail — E04-08. Rendered on the server from the same service as the API. */
export default async function CompanyPage({ params }: Props) {
  const company = await loadCompany((await params).companyId)
  if (!company) notFound()
  const session = await auth()

  const address = [company.addressLine1, company.addressLine2, company.city]
    .filter(Boolean)
    .join(', ')
  const mapsUrl =
    company.lat !== null && company.lng !== null
      ? `https://maps.google.com/?q=${company.lat},${company.lng}`
      : `https://maps.google.com/?q=${encodeURIComponent(address)}`

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 lg:px-6">
      <Link
        href={`/discover?city=${encodeURIComponent(company.city)}`}
        className="inline-flex items-center gap-1 text-sm font-medium text-neutral-500 hover:text-neutral-900"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Pitches in {company.city}
      </Link>

      <header className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-start">
        {company.logoUrl ? (
          <img
            src={company.logoUrl}
            alt={`${company.name} logo`}
            className="h-20 w-20 shrink-0 rounded-xl bg-white object-cover shadow-sm"
          />
        ) : (
          <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
            <Building2 className="h-8 w-8 text-neutral-500" aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0 space-y-2">
          <h1 className="flex flex-wrap items-center gap-2 text-3xl font-bold text-neutral-900">
            <span className="break-words">{company.name}</span>
            {company.isVerified && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-primary-600">
                <BadgeCheck className="h-5 w-5" aria-hidden="true" />
                Verified
              </span>
            )}
          </h1>
          <RatingLine avgRating={company.avgRating} reviewCount={company.reviewCount} />
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-900"
          >
            <MapPin className="h-4 w-4 shrink-0 text-neutral-500" aria-hidden="true" />
            {address}
          </a>
          {company.phone && (
            <a
              href={`tel:${company.phone}`}
              className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700"
            >
              <Phone className="h-4 w-4" aria-hidden="true" />
              {company.phone}
            </a>
          )}
          {company.websiteUrl && (
            <a
              href={company.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700"
            >
              <Globe className="h-4 w-4" aria-hidden="true" />
              {company.websiteUrl.replace(/^https?:\/\//, '')}
            </a>
          )}
          <WorkingHours week={company.workingHours} />
          {company.description && (
            <p className="max-w-2xl pt-2 text-sm text-neutral-700">{company.description}</p>
          )}
        </div>
      </header>

      {/* The tabs read ?tab= from the URL. */}
      <Suspense>
        <CompanyTabs company={company} signedIn={!!session?.user} />
      </Suspense>
    </main>
  )
}
