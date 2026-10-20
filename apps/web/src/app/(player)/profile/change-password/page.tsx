import type { Metadata } from 'next'
import { signOut } from '@/auth'
import { ChangePasswordForm } from '@/components/profile/ChangePasswordForm'
import { getT } from '@/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('profile.password.title') }
}

/** Change password — E08-08. Every session ends after it, this one included. */
export default async function ChangePasswordPage() {
  const t = await getT()
  async function signOutAction() {
    'use server'
    await signOut({ redirectTo: '/login?notice=password-changed' })
  }
  return (
    <>
      <h1 className="text-2xl font-bold text-neutral-900">{t('profile.password.heading')}</h1>
      <p className="mt-1 text-sm text-neutral-700">{t('profile.password.intro')}</p>
      <ChangePasswordForm signOutAction={signOutAction} />
    </>
  )
}
