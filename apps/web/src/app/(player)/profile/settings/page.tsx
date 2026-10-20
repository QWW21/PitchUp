import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { getProfile } from '@/lib/profile/account'
import { SettingsForm } from '@/components/profile/SettingsForm'
import { getT } from '@/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('profile.settings.title') }
}

/** Account settings — E08-08: name, phone, city and photo. */
export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user) redirect('/login?callbackUrl=%2Fprofile%2Fsettings')
  const profile = await getProfile(session.user.id)
  const t = await getT()
  return (
    <>
      <h1 className="text-2xl font-bold text-neutral-900">{t('profile.settings.heading')}</h1>
      <SettingsForm
        profile={profile}
        photosEnabled={!!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}
      />
    </>
  )
}
