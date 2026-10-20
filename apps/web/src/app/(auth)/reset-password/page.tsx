import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Wordmark } from '@/components/Wordmark'
import { BrandPanel } from '@/components/BrandPanel'
import { getT } from '@/i18n/server'
import { ResetPasswordForm } from './ResetPasswordForm'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('auth.reset.title') }
}

/** Where the password-reset email lands: /reset-password?token=… (E02-11, #165). */
export default async function ResetPasswordPage() {
  const t = await getT()
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      <div className="flex min-h-screen items-center justify-center px-6 py-12 lg:min-h-0 lg:px-12">
        <div className="w-full max-w-[400px]">
          <Wordmark />
          <h1 className="mt-8 text-3xl font-bold text-neutral-900">{t('auth.reset.heading')}</h1>
          <p className="mt-2 text-base text-neutral-500">{t('auth.reset.rules')}</p>
          {/* The form reads the token from the URL, which needs a Suspense boundary. */}
          <Suspense>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
      <BrandPanel />
    </div>
  )
}
