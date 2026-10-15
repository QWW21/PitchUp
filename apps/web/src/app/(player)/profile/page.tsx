import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronRight, MapPin } from 'lucide-react'
import { TRUST_TIER_COLOURS, tierDescription, trustTier } from '@pitchup/shared'
import { auth } from '@/auth'
import { getProfile } from '@/lib/profile/account'
import { Avatar } from '@/components/profile/Avatar'
import { TrustScoreRing } from '@/components/profile/TrustScoreRing'

export const metadata: Metadata = { title: 'Profile | PitchUp' }

/** Profile overview — E08-08: who you are, your trust score, and shortcuts. */
export default async function ProfilePage() {
  // The layout redirects too, but layouts and pages render in parallel.
  const session = await auth()
  if (!session?.user) redirect('/login?callbackUrl=%2Fprofile')
  const p = await getProfile(session.user.id)
  const tier = trustTier(p.trustScore)

  return (
    <>
      <h1 className="text-2xl font-bold text-neutral-900">Profile</h1>

      <section
        aria-label="Your details"
        className="mt-4 flex flex-wrap items-center gap-4 rounded-xl bg-white p-4 shadow-sm"
      >
        <Avatar name={p.name} url={p.avatarUrl} />
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold text-neutral-900">{p.name}</p>
          <p className="truncate text-sm text-neutral-500">{p.email}</p>
          <p className="text-sm text-neutral-500">{p.phone}</p>
          {p.city && (
            <span className="mt-2 inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-700">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              {p.city}
            </span>
          )}
        </div>
        <Link
          href="/profile/settings"
          className="w-full shrink-0 rounded-md border text-center sm:ml-auto sm:w-auto sm:self-start border-neutral-200 px-3 py-1.5 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
        >
          Edit profile
        </Link>
      </section>

      <section
        aria-labelledby="trust-heading"
        className="mt-4 flex items-center gap-4 rounded-xl bg-white p-4 shadow-sm"
      >
        <div className="flex flex-col items-center">
          <TrustScoreRing score={p.trustScore} size={64} />
          {/* The tier colours are too light for text: a dot carries the colour. */}
          <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-neutral-700">
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: TRUST_TIER_COLOURS[tier.label] }}
            />
            {tier.label}
          </span>
        </div>
        <div>
          <h2 id="trust-heading" className="font-semibold text-neutral-900">
            Your trust score
          </h2>
          <p className="text-sm text-neutral-700">{tierDescription(tier)}</p>
          <Link
            href="/profile/trust-score"
            className="mt-1 inline-block text-sm font-medium text-primary-700 hover:underline"
          >
            View history →
          </Link>
        </div>
      </section>

      <nav
        aria-label="Your activity"
        className="mt-4 overflow-hidden rounded-xl bg-white shadow-sm"
      >
        {[
          { href: '/my-bookings', label: 'My bookings' },
          { href: '/my-reviews', label: 'My reviews' },
          { href: '/profile/payment-methods', label: 'Payment methods' },
        ].map(l => (
          <Link
            key={l.href}
            href={l.href}
            className="flex items-center justify-between border-b border-neutral-100 px-4 py-3 text-sm font-medium text-neutral-900 last:border-b-0 hover:bg-neutral-50"
          >
            {l.label}
            <ChevronRight className="h-4 w-4 text-neutral-500" aria-hidden="true" />
          </Link>
        ))}
      </nav>
    </>
  )
}
