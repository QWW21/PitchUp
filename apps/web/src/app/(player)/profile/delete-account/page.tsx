import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth, signOut } from '@/auth'
import { DeleteAccountForm } from '@/components/profile/DeleteAccountForm'
import { getT } from '@/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('profile.delete.title') }
}

/** Delete account — E08-08. */
export default async function DeleteAccountPage() {
  const session = await auth()
  if (!session?.user) redirect('/login?callbackUrl=%2Fprofile%2Fdelete-account')
  const t = await getT()

  async function signOutAction() {
    'use server'
    await signOut({ redirectTo: '/discover?accountDeleted=1' })
  }

  return (
    <>
      <h1 className="text-2xl font-bold text-neutral-900">{t('profile.delete.heading')}</h1>
      {session.user.role === 'PLAYER' ? (
        <DeleteAccountForm signOutAction={signOutAction} />
      ) : (
        <p className="mt-4 rounded-md bg-neutral-100 p-3 text-sm text-neutral-700">
          {t('profile.delete.staffOnly')}
        </p>
      )}
    </>
  )
}
