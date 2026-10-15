import type { Metadata } from 'next'
import { signOut } from '@/auth'
import { ChangePasswordForm } from '@/components/profile/ChangePasswordForm'

export const metadata: Metadata = { title: 'Change password | PitchUp' }

/** Change password — E08-08. Every session ends after it, this one included. */
export default function ChangePasswordPage() {
  async function signOutAction() {
    'use server'
    await signOut({ redirectTo: '/login?notice=password-changed' })
  }
  return (
    <>
      <h1 className="text-2xl font-bold text-neutral-900">Change password</h1>
      <p className="mt-1 text-sm text-neutral-700">
        You&rsquo;ll be signed out everywhere and sign in again with the new password.
      </p>
      <ChangePasswordForm signOutAction={signOutAction} />
    </>
  )
}
