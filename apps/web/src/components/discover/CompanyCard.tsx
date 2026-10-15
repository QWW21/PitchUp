import Link from 'next/link'
import { Building2, MapPin, Star } from 'lucide-react'
import type { CompanyListItem } from '@pitchup/shared'

/** Same content as the mobile CompanyCard (UIUX_SPEC §5.1), laid out for a grid. E03-08. */
export function CompanyCard({ company }: { company: CompanyListItem }) {
  return (
    <Link
      href={`/discover/${company.id}`}
      className="flex gap-3 rounded-xl bg-white p-4 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
    >
      <CompanyLogo url={company.logoUrl} name={company.name} />
      <CompanySummary company={company} />
    </Link>
  )
}

export function CompanyLogo({ url, name }: { url: string | null; name: string }) {
  if (!url) {
    return (
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-neutral-100">
        <Building2 className="h-6 w-6 text-neutral-500" aria-hidden="true" />
      </div>
    )
  }
  return (
    // A plain img: next/image would need the Cloudinary host allow-listed in next.config.
    <img
      src={url}
      alt={`${name} logo`}
      className="h-14 w-14 shrink-0 rounded-md bg-neutral-100 object-cover"
    />
  )
}

/** The text column, shared with the map preview card. */
export function CompanySummary({ company }: { company: CompanyListItem }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-start gap-2">
        <h3 className="flex-1 truncate font-semibold text-neutral-900">{company.name}</h3>
        {company.isOpenNow && (
          <span className="shrink-0 rounded bg-success-50 px-1.5 py-0.5 text-[11px] font-medium text-primary-700">
            OPEN
          </span>
        )}
      </div>
      <p className="mt-1 flex items-center gap-1 text-xs text-neutral-500">
        <MapPin className="h-3.5 w-3.5 shrink-0 text-neutral-500" aria-hidden="true" />
        <span className="truncate">{company.address}</span>
      </p>
      <p className="mt-1 flex items-center gap-1 text-xs">
        {company.avgRating !== null ? (
          <>
            <Star className="h-3 w-3 fill-[#FBBF24] text-[#FBBF24]" aria-hidden="true" />
            <span className="font-bold text-neutral-700">{company.avgRating.toFixed(1)}</span>
            <span className="text-neutral-500">({company.reviewCount})</span>
          </>
        ) : (
          <span className="text-neutral-500">Not rated yet</span>
        )}
        {company.distanceKm !== null && (
          <>
            <span className="text-neutral-500">·</span>
            <span className="text-neutral-500">{company.distanceKm.toFixed(1)} km</span>
          </>
        )}
      </p>
      <div className="mt-2 flex items-center gap-2">
        <span className="rounded-full bg-neutral-100 px-2 py-1 text-[11px] font-medium text-neutral-700">
          {company.pitchCount} {company.pitchCount === 1 ? 'pitch' : 'pitches'}
        </span>
        <span className="ml-auto text-xs text-primary-700">
          from <strong>{company.priceFrom} RON</strong>/h
        </span>
      </div>
    </div>
  )
}

export function CompanyCardSkeleton() {
  return (
    <div className="flex animate-pulse gap-3 rounded-xl bg-white p-4 shadow-sm" aria-hidden="true">
      <div className="h-14 w-14 shrink-0 rounded-md bg-neutral-100" />
      <div className="flex-1 space-y-2 pt-1">
        <div className="h-4 w-3/5 rounded bg-neutral-100" />
        <div className="h-3 w-4/5 rounded bg-neutral-100" />
        <div className="h-3 w-1/2 rounded bg-neutral-100" />
        <div className="h-3 w-2/5 rounded bg-neutral-100" />
      </div>
    </div>
  )
}
