import Link from 'next/link'

/**
 * Placeholder so Discover's card links land somewhere. The real company
 * detail page is E04 (Player: Pitch Detail).
 */
export default function CompanyDetailPlaceholder() {
  return (
    <main className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-xl font-semibold text-neutral-900">Company details are coming soon</h1>
      <p className="mt-2 text-sm text-neutral-500">This page is built in E04.</p>
      <Link
        href="/discover"
        className="mt-6 inline-block text-sm font-medium text-primary-600 hover:underline"
      >
        Back to Discover
      </Link>
    </main>
  )
}
