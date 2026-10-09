import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { Wordmark } from '@/components/Wordmark'
import { VerifyEmailForm } from './VerifyEmailForm'

export const metadata: Metadata = {
  title: 'Verify your email · PitchUp',
}

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>
}) {
  const { email } = await searchParams

  // Nothing to verify without an address; send them back to sign in.
  if (!email) redirect('/login')

  return (
    <div className="mx-auto w-full max-w-[440px] px-6 py-12">
      <div className="flex justify-center">
        <Wordmark />
      </div>

      <h1 className="mt-10 text-center text-3xl font-bold text-neutral-900">Check your email</h1>
      <p className="mt-2 text-center text-base text-neutral-500">
        We sent a six-digit code to <span className="font-medium text-neutral-900">{email}</span>.
      </p>

      <VerifyEmailForm email={email} />
    </div>
  )
}
