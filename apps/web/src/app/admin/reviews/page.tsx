import type { Metadata } from 'next'
import Link from 'next/link'
import { AdminReviewQuerySchema } from '@pitchup/shared'
import { listReviews } from '@/lib/admin/reviews'
import { ReviewFiltersAdmin } from '@/components/admin/ReviewFiltersAdmin'
import { DeleteReviewButton } from '@/components/admin/DeleteReviewButton'

export const metadata: Metadata = { title: 'Reviews | PitchUp admin' }

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

const when = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Europe/Bucharest',
})

const REPORT_WORDS: Record<string, string> = {
  SPAM: 'spam',
  OFFENSIVE: 'offensive',
  FAKE: 'fake',
  IRRELEVANT: 'off-topic',
  OTHER: 'other',
}

/** Review moderation — E15-08: most reported first; delete with a reason. */
export default async function AdminReviewsPage({ searchParams }: Props) {
  const raw = await searchParams
  const pick = (k: string) =>
    typeof raw[k] === 'string' && raw[k] ? (raw[k] as string) : undefined
  const parsed = AdminReviewQuerySchema.safeParse({
    minReports: pick('minReports'),
    rating: pick('rating'),
    search: pick('search'),
    cursor: pick('cursor'),
  })
  const query = parsed.success ? parsed.data : AdminReviewQuerySchema.parse({})
  const page = await listReviews(query)
  const next = new URLSearchParams({
    minReports: String(query.minReports),
    ...(query.rating ? { rating: String(query.rating) } : {}),
    ...(query.search ? { search: query.search } : {}),
    cursor: page.nextCursor ?? '',
  })

  return (
    <>
      <h1 className="text-2xl font-bold text-neutral-900">Reviews</h1>
      <ReviewFiltersAdmin
        minReports={String(query.minReports)}
        rating={query.rating ? String(query.rating) : ''}
        search={query.search ?? ''}
      />
      {page.items.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-700">
          {query.minReports > 0 ? 'No reported reviews.' : 'No reviews match.'}
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {page.items.map(r => (
            <li key={r.id}>
              <article aria-labelledby={`rv-${r.id}`} className="rounded-xl bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 id={`rv-${r.id}`} className="font-semibold text-neutral-900">
                      {r.pitch.name} at {r.pitch.venue}
                    </h2>
                    <p className="text-xs text-neutral-700">
                      <span aria-label={`${r.rating} out of 5 stars`}>{'★'.repeat(r.rating)}</span>{' '}
                      · by{' '}
                      <Link
                        href={`/admin/users/${r.player.id}`}
                        className="text-primary-700 underline"
                      >
                        {r.player.name}
                      </Link>{' '}
                      · {when.format(new Date(r.createdAt))}
                    </p>
                  </div>
                  {r.reports > 0 && (
                    <span className="rounded-full bg-error-50 px-2.5 py-0.5 text-xs font-medium text-error-600">
                      {r.reports} {r.reports === 1 ? 'report' : 'reports'}
                      {r.flagReason
                        ? ` · ${REPORT_WORDS[r.flagReason] ?? r.flagReason.toLowerCase()}`
                        : ''}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm text-neutral-900">{r.text ?? <em>No text</em>}</p>
                {r.managerReply && (
                  <p className="mt-2 border-l-2 border-neutral-200 pl-3 text-sm text-neutral-700">
                    Venue: {r.managerReply}
                  </p>
                )}
                <DeleteReviewButton reviewId={r.id} pitch={r.pitch.name} />
              </article>
            </li>
          ))}
        </ul>
      )}
      {page.nextCursor && (
        <Link
          href={`/admin/reviews?${next}`}
          className="mt-4 inline-flex h-10 items-center rounded-md border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
        >
          Next page
        </Link>
      )}
    </>
  )
}
