import type { Metadata } from 'next'
import { Suspense } from 'react'
import { DiscoverClient } from './DiscoverClient'
import { AccountDeletedNotice } from './AccountDeletedNotice'
import { getT } from '@/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('discover.title') }
}

/**
 * Player Discover — E03-08. Public: browsing needs no account. The page is a
 * shell; the client component owns state because it lives in the URL and in
 * the browser's location permission.
 */
export default function DiscoverPage() {
  return (
    // useSearchParams needs a Suspense boundary to render statically.
    <Suspense>
      <AccountDeletedNotice />
      <DiscoverClient />
    </Suspense>
  )
}
