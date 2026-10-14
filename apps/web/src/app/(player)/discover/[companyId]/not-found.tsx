import Link from 'next/link'

export default function VenueNotFound() {
  return (
    <main className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-xl font-semibold text-neutral-900">We couldn&rsquo;t find that venue</h1>
      <p className="mt-2 text-sm text-neutral-500">
        It may have been removed, or it is not taking bookings right now.
      </p>
      <Link
        href="/discover"
        className="mt-6 inline-block text-sm font-medium text-primary-600 hover:underline"
      >
        Back to Discover
      </Link>
    </main>
  )
}
