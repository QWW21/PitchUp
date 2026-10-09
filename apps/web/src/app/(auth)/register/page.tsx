import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { auth } from '@/auth'
import { StepIndicator } from '@/components/ui/StepIndicator'
import { Wordmark } from '@/components/Wordmark'
import { RegisterForm } from './RegisterForm'

export const metadata: Metadata = {
  title: 'Create your manager account · PitchUp',
}

/** Steps 2-4 are built in E09. */
const STEPS = ['Account', 'Company info', 'Payments', 'Review'] as const

export default async function RegisterPage() {
  const session = await auth()
  if (session?.user) redirect('/dashboard')

  return (
    <div className="mx-auto w-full max-w-[640px] px-6 py-12">
      <div className="flex justify-center">
        <Wordmark />
      </div>

      <div className="mt-10">
        <StepIndicator steps={STEPS} current={1} />
      </div>

      <h1 className="mt-10 text-center text-3xl font-bold text-neutral-900">
        Create your manager account
      </h1>
      <p className="mt-2 text-center text-base text-neutral-500">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-primary-600 hover:text-primary-700">
          Sign in
        </Link>
      </p>

      <RegisterForm />
    </div>
  )
}
