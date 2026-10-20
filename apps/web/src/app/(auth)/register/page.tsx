import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { auth } from '@/auth'
import { StepIndicator } from '@/components/ui/StepIndicator'
import { Wordmark } from '@/components/Wordmark'
import { getT } from '@/i18n/server'
import { RegisterForm } from './RegisterForm'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('auth.register.title') }
}

export default async function RegisterPage() {
  const session = await auth()
  if (session?.user) redirect('/dashboard')
  const t = await getT()
  const steps = ([0, 1, 2, 3] as const).map(i => t(`auth.register.steps.${i}`))

  return (
    <div className="mx-auto w-full max-w-[640px] px-6 py-12">
      <div className="flex justify-center">
        <Wordmark />
      </div>

      <div className="mt-10">
        <StepIndicator steps={steps} current={1} />
      </div>

      <h1 className="mt-10 text-center text-3xl font-bold text-neutral-900">
        {t('auth.register.heading')}
      </h1>
      <p className="mt-2 text-center text-base text-neutral-500">
        {t('auth.register.haveAccount')}{' '}
        <Link href="/login" className="font-medium text-primary-600 hover:text-primary-700">
          {t('auth.register.signIn')}
        </Link>
      </p>

      <RegisterForm />
    </div>
  )
}
