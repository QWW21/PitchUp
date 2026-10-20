import type { Metadata } from 'next'
import Link from 'next/link'
import { MessageSquare } from 'lucide-react'
import { ManagerReviewQuerySchema } from '@pitchup/shared'
import { requireActiveManager } from '@/lib/manager/access'
import { listCompanyReviews, managedCompany } from '@/lib/reviews/manage'
import { ReviewFilters } from '@/components/manager/ReviewFilters'
import { ManagerReviewCard } from '@/components/manager/ManagerReviewCard'
import { getT } from '@/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('mVenue.reviews.title') }
}

type Props = { searchParams: Promise<Record<string, string | undefined>> }

/**
 * Reviews management — E07-09 (PRD §8.5). Every review on the company's
 * pitches, filtered and sorted from the URL, with inline replies and
 * reports. Rendered from the same service as GET /companies/:id/reviews.
 */
export default async function ManagerReviewsPage({ searchParams }: Props) {
  // The layout checks too, but layouts and pages render in parallel.
  const { session } = await requireActiveManager()
  const company = (await managedCompany(session.user.id))!
  const t = await getT()

  const raw = await searchParams
  const parsed = ManagerReviewQuerySchema.safeParse({
    pitchId: raw.pitch || undefined,
    sort: raw.sort,
    q: raw.q || undefined,
    page: raw.page,
  })
  const query = parsed.success ? parsed.data : ManagerReviewQuerySchema.parse({})
  const page = await listCompanyReviews(company.id, session.user, query)

  const pageHref = (n: number) => {
    const q = new URLSearchParams()
    if (query.pitchId) q.set('pitch', query.pitchId)
    if (query.sort !== 'newest') q.set('sort', query.sort)
    if (query.q) q.set('q', query.q)
    if (n > 1) q.set('page', String(n))
    return `/manager/reviews${q.size ? `?${q}` : ''}`
  }

  return (
    <div className="max-w-[800px]">
      <h1 className="text-2xl font-bold text-neutral-900">{t('mVenue.reviews.heading')}</h1>
      <p className="mt-1 text-sm text-neutral-500">{company.name}</p>

      <ReviewFilters
        pitches={company.pitches}
        pitchId={query.pitchId}
        sort={query.sort}
        q={query.q}
      />

      <p className="mt-4 text-sm text-neutral-500" aria-live="polite">
        {t('mVenue.reviews.count', { count: page.total })}
      </p>

      {page.items.length === 0 ? (
        <div className="mt-3 flex flex-col items-center rounded-xl bg-white px-6 py-12 text-center shadow-sm">
          <MessageSquare className="h-12 w-12 text-neutral-300" aria-hidden="true" />
          <p className="mt-3 font-semibold text-neutral-900">{t('mVenue.reviews.none')}</p>
        </div>
      ) : (
        <ul className="mt-3 space-y-3">
          {page.items.map(r => (
            <li key={r.id}>
              <ManagerReviewCard review={r} />
            </li>
          ))}
        </ul>
      )}

      {(query.page > 1 || page.hasMore) && (
        <nav
          aria-label={t('mVenue.reviews.pages')}
          className="mt-6 flex justify-between text-sm font-medium"
        >
          {query.page > 1 ? (
            <Link href={pageHref(query.page - 1)} className="text-primary-700 hover:underline">
              {t('mVenue.reviews.previous')}
            </Link>
          ) : (
            <span />
          )}
          {page.hasMore && (
            <Link href={pageHref(query.page + 1)} className="text-primary-700 hover:underline">
              {t('mVenue.reviews.next')}
            </Link>
          )}
        </nav>
      )}
    </div>
  )
}
