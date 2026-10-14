import type { Metadata } from 'next'
import { Suspense } from 'react'
import { DiscoverClient } from './DiscoverClient'

export const metadata: Metadata = { title: 'Discover pitches · PitchUp' }

/**
 * Player Discover — E03-08. Public: browsing needs no account. The page is a
 * shell; the client component owns state because it lives in the URL and in
 * the browser's location permission.
 */
export default function DiscoverPage() {
  return (
    // useSearchParams needs a Suspense boundary to render statically.
    <Suspense>
      <DiscoverClient />
    </Suspense>
  )
}
