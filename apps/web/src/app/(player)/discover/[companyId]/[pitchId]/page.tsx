import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { cache } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { bookingTrustGate, deriveTier, formatPitchSize } from '@pitchup/shared'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getPitchDetail } from '@/lib/venues/pitch'
import { RatingLine, SizeInfo, SurfaceChip } from '@/components/venue/bits'
import { PhotoGallery } from '@/components/venue/PhotoGallery'
import { AmenitiesGrid, PricingCard } from '@/components/venue/PitchInfo'
import { ExpandableText } from '@/components/venue/ExpandableText'
import { ReviewCard } from '@/components/venue/Reviews'
import { BookNowPanel, type BookingBlock } from '@/components/venue/BookNowPanel'
import { getLocale, getT } from '@/i18n/server'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ companyId: string; pitchId: string }> }

/** One query per request, shared by the metadata and the page. */
const loadPitch = cache((id: string) => getPitchDetail(id))

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const pitch = await loadPitch((await params).pitchId)
  const t = await getT()
  if (!pitch) return { title: t('venue.pitch.notFoundTitle') }
  const description =
    pitch.description?.slice(0, 155) ??
    t('venue.pitch.metaDescription', {
      size: t(`size.${pitch.size}`),
      company: pitch.company.name,
      price: pitch.hourlyRate,
    })
  return {
    title: `${pitch.name} — ${pitch.company.name} | PitchUp`,
    description,
    openGraph: {
      title: `${pitch.name} — ${pitch.company.name}`,
      description,
      ...(pitch.photos[0] ? { images: [pitch.photos[0].url] } : {}),
    },
  }
}

/** Pitch detail — E04-08. */
export default async function PitchPage({ params }: Props) {
  const { companyId, pitchId } = await params
  const pitch = await loadPitch(pitchId)
  if (!pitch) notFound()
  // A pitch reached under the wrong company still resolves, at its real address.
  if (pitch.company.id !== companyId) redirect(`/discover/${pitch.company.id}/${pitch.id}`)

  const session = await auth()
  const [t, locale] = [await getT(), await getLocale()]
  let block: BookingBlock = pitch.isBookable ? null : 'unavailable'
  let blockNote: string | undefined
  if (!block && session?.user) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { trustScore: true },
    })
    // PRD §9.1 and E12-06, enforced again by the booking API.
    const gate = user
      ? bookingTrustGate(
          {
            score: user.trustScore,
            pitchMinScore: pitch.minTrustScore,
            activeBookings: await prisma.booking.count({
              where: {
                playerId: session.user.id,
                status: { in: ['CONFIRMED', 'AWAITING_APPROVAL'] },
                endTime: { gt: new Date() },
              },
            }),
          },
          locale
        )
      : null
    if (gate) {
      block = 'restricted'
      blockNote = gate.message
    }
  }

  const companyPath = `/discover/${pitch.company.id}`

  // E07-10: rating rich results. Only once the rating is public (3+ reviews),
  // which is also Google's minimum. `<` is escaped so text cannot close the tag.
  const jsonLd =
    pitch.avgRating !== null
      ? JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'SportsActivityLocation',
          name: `${pitch.name} — ${pitch.company.name}`,
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: pitch.avgRating.toFixed(1),
            reviewCount: String(pitch.reviewCount),
            bestRating: '5',
            worstRating: '1',
          },
        }).replace(/</g, '\\u003c')
      : null

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 lg:px-6">
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />}
      <Link
        href={companyPath}
        className="inline-flex items-center gap-1 text-sm font-medium text-neutral-500 hover:text-neutral-900"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        {pitch.company.name}
      </Link>

      <div className="mt-4 grid grid-cols-1 gap-8 lg:grid-cols-[3fr_2fr]">
        <div className="min-w-0">
          <PhotoGallery photos={pitch.photos} alt={pitch.name} />
        </div>

        {/* Second on small screens, beside the gallery from lg up. */}
        <div className="lg:row-span-2">
          <BookNowPanel
            pitchId={pitch.id}
            hourlyRate={pitch.hourlyRate}
            signedIn={!!session?.user}
            block={block}
            blockNote={blockNote}
            minTier={
              pitch.minTrustScore > 0 ? t(`trust.tier.${deriveTier(pitch.minTrustScore)}`) : null
            }
            refundPolicy={pitch.company.refundPolicy}
            confirmsByHand={!pitch.company.autoApproveBookings}
          />
        </div>

        <div className="min-w-0 space-y-8">
          <header className="space-y-2">
            <h1 className="text-2xl font-bold text-neutral-900">{pitch.name}</h1>
            {!pitch.isActive && (
              <p className="inline-block rounded bg-neutral-200 px-2 py-0.5 text-xs font-medium text-neutral-600">
                {t('venue.pitch.notTaking')}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <SurfaceChip surface={pitch.surfaceType} />
              <span className="text-sm text-neutral-500">
                {formatPitchSize(
                  t(`size.${pitch.size}`),
                  pitch.widthMeters,
                  pitch.lengthMeters,
                  locale
                )}
              </span>
              <SizeInfo />
            </div>
            <RatingLine avgRating={pitch.avgRating} reviewCount={pitch.reviewCount} />
            <Link
              href={companyPath}
              className="flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900"
            >
              {pitch.company.name}
              <ChevronRight className="h-4 w-4 text-neutral-300" aria-hidden="true" />
            </Link>
          </header>

          {pitch.description && (
            <section>
              <h2 className="mb-3 text-base font-semibold text-neutral-900">
                {t('venue.pitch.about')}
              </h2>
              <ExpandableText text={pitch.description} />
            </section>
          )}

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">
              {t('venue.pitch.amenities')}
            </h2>
            <AmenitiesGrid amenities={pitch.amenities} />
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">
              {t('venue.pitch.pricing')}
            </h2>
            <PricingCard pitch={pitch} />
          </section>

          <section>
            <div className="mb-1 flex items-center justify-between gap-4">
              <h2 className="text-base font-semibold text-neutral-900">
                {t('venue.pitch.reviews')}
              </h2>
              <RatingLine avgRating={pitch.avgRating} reviewCount={pitch.reviewCount} />
            </div>
            {pitch.recentReviews.length === 0 ? (
              <p className="py-6 text-center text-sm text-neutral-500">{t('venue.reviews.none')}</p>
            ) : (
              <>
                {pitch.recentReviews.slice(0, 2).map(r => (
                  <ReviewCard key={r.id} review={r} compact />
                ))}
                <Link
                  href={`${companyPath}?tab=reviews&pitch=${pitch.id}`}
                  className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-primary-600 hover:underline"
                >
                  {t('venue.reviews.seeAll', { count: pitch.reviewCount })}
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}
