import { Suspense } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { auth } from '@/auth'
import { BrandPanel } from '@/components/BrandPanel'
import { Wordmark } from '@/components/Wordmark'
import { isGoogleSignInConfigured } from '@/lib/auth/google'
import { env } from '@/lib/env'
import { getT } from '@/i18n/server'
import { LoginForm } from './LoginForm'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('auth.login.title') }
}

export default async function LoginPage() {
  // Someone already signed in has no business on the login page.
  const session = await auth()
  if (session?.user) redirect('/dashboard')
  const t = await getT()

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      <div className="flex min-h-screen items-center justify-center px-6 py-12 lg:min-h-0 lg:px-12">
        <div className="w-full max-w-[400px]">
          <Wordmark />

          <span className="mt-6 inline-block rounded-full bg-primary-100 px-3 py-2 text-sm font-medium text-primary-700">
            {t('auth.login.portal')}
          </span>

          <h1 className="mt-2 text-3xl font-bold text-neutral-900">{t('auth.login.heading')}</h1>

          {/* useSearchParams needs a Suspense boundary, or the whole route
              opts out of static rendering. */}
          <Suspense fallback={<div className="mt-8 h-[280px]" />}>
            <LoginForm google={isGoogleSignInConfigured() && Boolean(env.GOOGLE_CLIENT_SECRET)} />
          </Suspense>

          <p className="mt-6 text-center text-base text-neutral-500">
            {t('auth.login.noAccount')}{' '}
            <Link href="/register" className="font-medium text-primary-600 hover:text-primary-700">
              {t('auth.login.registerCompany')}
            </Link>
          </p>
        </div>
      </div>

      <BrandPanel />
    </div>
  )
}
