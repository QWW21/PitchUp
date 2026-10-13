import type { Metadata } from 'next'
import { Wordmark } from '@/components/Wordmark'
import { BrandPanel } from '@/components/BrandPanel'
import { ForgotPasswordForm } from './ForgotPasswordForm'

export const metadata: Metadata = {
  title: 'Reset your password · PitchUp',
}

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      <div className="flex min-h-screen items-center justify-center px-6 py-12 lg:min-h-0 lg:px-12">
        <div className="w-full max-w-[400px]">
          <Wordmark />
          <h1 className="mt-8 text-3xl font-bold text-neutral-900">Reset your password</h1>
          <p className="mt-2 text-base text-neutral-500">
            Enter your email and we&apos;ll send you a reset link.
          </p>
          <ForgotPasswordForm />
        </div>
      </div>
      <BrandPanel />
    </div>
  )
}
