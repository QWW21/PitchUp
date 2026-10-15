import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth, signOut } from '@/auth'
import { DeleteAccountForm } from '@/components/profile/DeleteAccountForm'

export const metadata: Metadata = { title: 'Delete account | PitchUp' }

/** Delete account — E08-08. */
export default async function DeleteAccountPage() {
  const session = await auth()
  if (!session?.user) redirect('/login?callbackUrl=%2Fprofile%2Fdelete-account')

  async function signOutAction() {
    'use server'
    await signOut({ redirectTo: '/discover?accountDeleted=1' })
  }

  return (
    <>
      <h1 className="text-2xl font-bold text-neutral-900">Delete account</h1>
      {session.user.role === 'PLAYER' ? (
        <DeleteAccountForm signOutAction={signOutAction} />
      ) : (
        <p className="mt-4 rounded-md bg-neutral-100 p-3 text-sm text-neutral-700">
          Venue and admin accounts are closed through support, because a company or the platform
          depends on them.
        </p>
      )}
    </>
  )
}
