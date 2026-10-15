import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { getProfile } from '@/lib/profile/account'
import { SettingsForm } from '@/components/profile/SettingsForm'

export const metadata: Metadata = { title: 'Account settings | PitchUp' }

/** Account settings — E08-08: name, phone, city and photo. */
export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user) redirect('/login?callbackUrl=%2Fprofile%2Fsettings')
  const profile = await getProfile(session.user.id)
  return (
    <>
      <h1 className="text-2xl font-bold text-neutral-900">Account settings</h1>
      <SettingsForm
        profile={profile}
        photosEnabled={!!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}
      />
    </>
  )
}
