import Link from 'next/link'
import { getT } from '@/i18n/server'

export default async function VenueNotFound() {
  const t = await getT()
  return (
    <main className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-xl font-semibold text-neutral-900">{t('venue.company.notFound')}</h1>
      <p className="mt-2 text-sm text-neutral-500">{t('venue.company.notFoundBody')}</p>
      <Link
        href="/discover"
        className="mt-6 inline-block text-sm font-medium text-primary-600 hover:underline"
      >
        {t('venue.company.backToDiscover')}
      </Link>
    </main>
  )
}
