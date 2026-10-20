import type { Metadata } from 'next'
import { Wordmark } from '@/components/Wordmark'
import { BrandPanel } from '@/components/BrandPanel'
import { getT } from '@/i18n/server'
import { ForgotPasswordForm } from './ForgotPasswordForm'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('auth.forgot.title') }
}

export default async function ForgotPasswordPage() {
  const t = await getT()
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      <div className="flex min-h-screen items-center justify-center px-6 py-12 lg:min-h-0 lg:px-12">
        <div className="w-full max-w-[400px]">
          <Wordmark />
          <h1 className="mt-8 text-3xl font-bold text-neutral-900">{t('auth.forgot.heading')}</h1>
          <p className="mt-2 text-base text-neutral-500">{t('auth.forgot.intro')}</p>
          <ForgotPasswordForm />
        </div>
      </div>
      <BrandPanel />
    </div>
  )
}
