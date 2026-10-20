import type { Metadata } from 'next'
import Link from 'next/link'
import { AdminReviewQuerySchema } from '@pitchup/shared'
import { listReviews } from '@/lib/admin/reviews'
import { ReviewFiltersAdmin } from '@/components/admin/ReviewFiltersAdmin'
import { DeleteReviewButton } from '@/components/admin/DeleteReviewButton'
import { INTL_LOCALE } from '@pitchup/shared'
import { getLocale, getT } from '@/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('admin.reviews.title') }
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

/** Review moderation — E15-08: most reported first; delete with a reason. */
export default async function AdminReviewsPage({ searchParams }: Props) {
  const raw = await searchParams
  const t = await getT()
  const when = new Intl.DateTimeFormat(INTL_LOCALE[await getLocale()], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Bucharest',
  })
  const reportWord = (reason: string) => {
    const key = `admin.reviews.report.${reason}` as 'admin.reviews.report.SPAM'
    return t.has(key) ? t(key) : reason.toLowerCase()
  }
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
      <h1 className="text-2xl font-bold text-neutral-900">{t('admin.reviews.heading')}</h1>
      <ReviewFiltersAdmin
        minReports={String(query.minReports)}
        rating={query.rating ? String(query.rating) : ''}
        search={query.search ?? ''}
      />
      {page.items.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-700">
          {query.minReports > 0 ? t('admin.reviews.noReported') : t('admin.reviews.noneMatch')}
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {page.items.map(r => (
            <li key={r.id}>
              <article aria-labelledby={`rv-${r.id}`} className="rounded-xl bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 id={`rv-${r.id}`} className="font-semibold text-neutral-900">
                      {t('admin.reviews.at', { pitch: r.pitch.name, venue: r.pitch.venue })}
                    </h2>
                    <p className="text-xs text-neutral-700">
                      <span aria-label={t('admin.reviews.stars', { n: r.rating })}>
                        {'★'.repeat(r.rating)}
                      </span>{' '}
                      · {t('admin.reviews.by')}{' '}
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
                      {t('admin.reviews.reports', { count: r.reports })}
                      {r.flagReason ? ` · ${reportWord(r.flagReason)}` : ''}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm text-neutral-900">
                  {r.text ?? <em>{t('admin.reviews.noText')}</em>}
                </p>
                {r.managerReply && (
                  <p className="mt-2 border-l-2 border-neutral-200 pl-3 text-sm text-neutral-700">
                    {t('admin.reviews.venueReply', { reply: r.managerReply })}
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
          {t('admin.nextPage')}
        </Link>
      )}
    </>
  )
}
