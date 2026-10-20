import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { Wordmark } from '@/components/Wordmark'
import { BrandPanel } from '@/components/BrandPanel'
import { getT } from '@/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('auth.confirmed.title') }
}

export default async function RegistrationConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>
}) {
  const { email } = await searchParams
  if (!email) redirect('/login')
  const t = await getT()

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      <div className="flex min-h-screen items-center justify-center px-6 py-12 lg:min-h-0 lg:px-12">
        <div className="w-full max-w-[400px] text-center">
          <Wordmark />

          <div className="mt-10 flex justify-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-100 text-3xl">
              ✓
            </span>
          </div>

          <h1 className="mt-6 text-3xl font-bold text-neutral-900">
            {t('auth.confirmed.heading')}
          </h1>
          <p className="mt-3 text-base text-neutral-500">{t('auth.confirmed.body')}</p>

          <Link
            href={`/login?email=${encodeURIComponent(email)}`}
            className="mt-8 inline-flex w-full items-center justify-center rounded-lg bg-primary-600 px-6 py-3 text-base font-semibold text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            {t('auth.confirmed.goSignIn')}
          </Link>
        </div>
      </div>
      <BrandPanel />
    </div>
  )
}
