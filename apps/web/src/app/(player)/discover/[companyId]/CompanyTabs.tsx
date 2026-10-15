'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronRight, ImageOff } from 'lucide-react'
import type { CompanyDetail } from '@pitchup/shared'
import { RatingLine, SurfaceChip, sizeLabel } from '@/components/venue/bits'
import { ReviewsList } from '@/components/venue/Reviews'

type Tab = 'pitches' | 'reviews'

/**
 * Pitches | Reviews. The active tab and a pitch filter live in the URL
 * (?tab=reviews&pitch=…), so "See all reviews" on a pitch page can link
 * straight to that pitch's reviews.
 */
export function CompanyTabs({ company }: { company: CompanyDetail }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const tab: Tab = params.get('tab') === 'reviews' ? 'reviews' : 'pitches'

  const select = (next: Tab) => {
    const q = new URLSearchParams(params.toString())
    if (next === 'reviews') q.set('tab', 'reviews')
    else {
      q.delete('tab')
      q.delete('pitch')
    }
    router.replace(`${pathname}${q.size ? `?${q}` : ''}`, { scroll: false })
  }

  return (
    <section className="mt-8">
      <div
        role="tablist"
        aria-label="Company sections"
        className="sticky top-16 z-10 flex h-12 gap-6 border-b border-neutral-200 bg-neutral-50"
      >
        {(['pitches', 'reviews'] as const).map(t => (
          <button
            key={t}
            type="button"
            role="tab"
            id={`tab-${t}`}
            aria-selected={tab === t}
            aria-controls={`panel-${t}`}
            onClick={() => select(t)}
            className={`-mb-px border-b-2 px-1 text-base font-semibold ${
              tab === t
                ? 'border-primary-600 text-neutral-900'
                : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {t === 'pitches'
              ? `Pitches (${company.pitches.length})`
              : `Reviews (${company.reviewCount})`}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="pt-6">
        {tab === 'pitches' ? (
          company.pitches.length === 0 ? (
            <p className="py-12 text-center text-sm text-neutral-500">No pitches available</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {company.pitches.map(p => (
                <Link
                  key={p.id}
                  href={`/discover/${company.id}/${p.id}`}
                  className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
                >
                  {p.coverPhotoUrl ? (
                    <img
                      src={p.coverPhotoUrl}
                      alt=""
                      className="h-20 w-20 shrink-0 rounded-md bg-neutral-100 object-cover"
                    />
                  ) : (
                    <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-md bg-neutral-100">
                      <ImageOff className="h-6 w-6 text-neutral-500" aria-hidden="true" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <h3 className="truncate font-semibold text-neutral-900">{p.name}</h3>
                    <div className="flex items-center gap-2">
                      <SurfaceChip surface={p.surfaceType} />
                      <span className="text-xs text-neutral-500">{sizeLabel(p.size)}</span>
                    </div>
                    <p className="text-xs text-neutral-700">
                      from <strong className="text-primary-700">{p.offPeakRate} RON</strong>/h
                    </p>
                    <RatingLine avgRating={p.avgRating} reviewCount={p.reviewCount} />
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-neutral-300" aria-hidden="true" />
                </Link>
              ))}
            </div>
          )
        ) : (
          <ReviewsList
            // Re-mount when the URL's pitch filter changes, e.g. arriving from a pitch page.
            key={params.get('pitch') ?? 'all'}
            companyId={company.id}
            pitches={company.pitches.map(p => ({ id: p.id, name: p.name }))}
            initialPitchId={params.get('pitch') ?? undefined}
          />
        )}
      </div>
    </section>
  )
}
