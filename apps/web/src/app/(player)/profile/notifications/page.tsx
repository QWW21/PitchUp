import type { Metadata } from 'next'
import { auth } from '@/auth'
import { getPreferences } from '@/lib/notifications/preferences'
import { NotificationSettings } from '@/components/notifications/NotificationSettings'
import { NotificationHistory } from '@/components/notifications/NotificationHistory'

export const metadata: Metadata = { title: 'Notifications | PitchUp' }

/** How to be told, and everything you were told — E13-10. */
export default async function NotificationsPage() {
  const session = await auth()
  if (!session?.user) return null
  const prefs = await getPreferences(session.user.id)
  return (
    <>
      <h1 className="text-2xl font-bold text-neutral-900">Notifications</h1>
      <NotificationSettings initial={prefs} />
      <NotificationHistory />
    </>
  )
}
