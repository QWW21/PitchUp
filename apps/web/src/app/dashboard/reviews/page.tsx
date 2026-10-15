import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { MessageSquare } from 'lucide-react'
import { ManagerReviewQuerySchema } from '@pitchup/shared'
import { auth } from '@/auth'
import { listCompanyReviews, managedCompany } from '@/lib/reviews/manage'
import { ReviewFilters } from '@/components/manager/ReviewFilters'
import { ManagerReviewCard } from '@/components/manager/ManagerReviewCard'

export const metadata: Metadata = { title: 'Reviews | PitchUp' }

type Props = { searchParams: Promise<Record<string, string | undefined>> }

/**
 * Reviews management — E07-09 (PRD §8.5). Every review on the company's
 * pitches, filtered and sorted from the URL, with inline replies and
 * reports. Rendered from the same service as GET /companies/:id/reviews.
 */
export default async function ManagerReviewsPage({ searchParams }: Props) {
  // The layout redirects too, but layouts and pages render in parallel.
  const session = await auth()
  if (!session?.user) redirect('/login?callbackUrl=%2Fdashboard%2Freviews')
  const company = await managedCompany(session.user.id)
  if (!company) {
    return (
      <>
        <h1 className="text-2xl font-bold text-neutral-900">Reviews</h1>
        <p className="mt-4 text-neutral-700">Reviews appear here once your company is set up.</p>
      </>
    )
  }

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
    return `/dashboard/reviews${q.size ? `?${q}` : ''}`
  }

  return (
    <div className="max-w-[800px]">
      <h1 className="text-2xl font-bold text-neutral-900">Reviews</h1>
      <p className="mt-1 text-sm text-neutral-500">{company.name}</p>

      <ReviewFilters
        pitches={company.pitches}
        pitchId={query.pitchId}
        sort={query.sort}
        q={query.q}
      />

      <p className="mt-4 text-sm text-neutral-500" aria-live="polite">
        {page.total} {page.total === 1 ? 'review' : 'reviews'}
      </p>

      {page.items.length === 0 ? (
        <div className="mt-3 flex flex-col items-center rounded-xl bg-white px-6 py-12 text-center shadow-sm">
          <MessageSquare className="h-12 w-12 text-neutral-300" aria-hidden="true" />
          <p className="mt-3 font-semibold text-neutral-900">No reviews found</p>
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
        <nav aria-label="Pages" className="mt-6 flex justify-between text-sm font-medium">
          {query.page > 1 ? (
            <Link href={pageHref(query.page - 1)} className="text-primary-700 hover:underline">
              ← Previous page
            </Link>
          ) : (
            <span />
          )}
          {page.hasMore && (
            <Link href={pageHref(query.page + 1)} className="text-primary-700 hover:underline">
              Next page →
            </Link>
          )}
        </nav>
      )}
    </div>
  )
}
