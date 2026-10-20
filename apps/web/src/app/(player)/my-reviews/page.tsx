import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Star } from 'lucide-react'
import { auth } from '@/auth'
import { listMyReviews } from '@/lib/reviews/mine'
import { MyReviewCard } from '@/components/reviews/MyReviewCard'
import { getT } from '@/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('myBookings.myReviews.title') }
}

type Props = { searchParams: Promise<{ updated?: string; deleted?: string }> }

/**
 * My Reviews — E07-08. Everything the player has reviewed, newest first, read
 * straight from the service behind GET /reviews/mine. Editing reuses the
 * booking's review form and comes back here.
 */
export default async function MyReviewsPage({ searchParams }: Props) {
  // The layout redirects too, but layouts and pages render in parallel.
  const session = await auth()
  if (!session?.user) redirect(`/login?callbackUrl=${encodeURIComponent('/my-reviews')}`)
  const reviews = await listMyReviews(session.user.id)
  const flags = await searchParams
  const t = await getT()

  return (
    <>
      <h1 className="text-2xl font-bold text-neutral-900">{t('myBookings.myReviews.heading')}</h1>
      <div className="mt-4 space-y-3">
        {flags.updated && (
          <p role="status" className="rounded-md bg-primary-50 p-3 text-sm text-primary-700">
            {t('myBookings.myReviews.updated')}
          </p>
        )}
        {flags.deleted && (
          <p role="status" className="rounded-md bg-primary-50 p-3 text-sm text-primary-700">
            {t('myBookings.myReviews.deleted')}
          </p>
        )}
        {reviews.length === 0 ? (
          <div className="flex flex-col items-center rounded-xl bg-white px-6 py-12 text-center shadow-sm">
            <Star className="h-12 w-12 text-neutral-300" aria-hidden="true" />
            <p className="mt-3 font-semibold text-neutral-900">{t('myBookings.myReviews.none')}</p>
            <p className="mt-1 text-sm text-neutral-700">{t('myBookings.myReviews.noneHint')}</p>
            <Link
              href="/discover"
              className="mt-4 rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
            >
              {t('myBookings.findPitch')}
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {reviews.map(r => (
              <li key={r.id}>
                <MyReviewCard review={r} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
