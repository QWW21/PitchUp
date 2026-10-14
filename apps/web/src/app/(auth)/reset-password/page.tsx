import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Wordmark } from '@/components/Wordmark'
import { BrandPanel } from '@/components/BrandPanel'
import { ResetPasswordForm } from './ResetPasswordForm'

export const metadata: Metadata = {
  title: 'Choose a new password · PitchUp',
}

/** Where the password-reset email lands: /reset-password?token=… (E02-11, #165). */
export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      <div className="flex min-h-screen items-center justify-center px-6 py-12 lg:min-h-0 lg:px-12">
        <div className="w-full max-w-[400px]">
          <Wordmark />
          <h1 className="mt-8 text-3xl font-bold text-neutral-900">Choose a new password</h1>
          <p className="mt-2 text-base text-neutral-500">
            At least 8 characters, with an uppercase letter and a number.
          </p>
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
