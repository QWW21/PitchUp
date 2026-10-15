/**
 * Push notifications — E08-10, partly.
 *
 * Blocked on credentials, as agreed: receiving pushes needs
 * @react-native-firebase/messaging and a Firebase project's config files
 * (google-services.json, GoogleService-Info.plist), which only the owner
 * can create. Everything that does not depend on Firebase is here, so wiring
 * it in later is a few lines:
 *
 *   const token = await messaging().getToken()          // after permission
 *   await registerPushToken(token, Platform.OS)
 *   messaging().onTokenRefresh(t => registerPushToken(t, Platform.OS))
 *   messaging().onNotificationOpenedApp(m => openNotification(nav, m.data?.type, m.data))
 *   messaging().getInitialNotification().then(m => m && openNotification(nav, m.data?.type, m.data))
 *
 * The same `openNotification` is used when a notification is tapped in the
 * in-app list (E08-09), so a push and the list always lead to the same place.
 */
import { notificationTarget } from '@pitchup/shared'
import { profileApi } from './profileApi'

/** The part of a navigator this needs: easy to fake in tests. */
export interface Navigator {
  navigate: (screen: string, params?: object) => void
}

/** Opens what the notification is about. Returns false when there is nowhere to go. */
export function openNotification(
  nav: Navigator,
  type: string | undefined,
  data: Record<string, unknown> | null | undefined
): boolean {
  const target = type ? notificationTarget(type, data) : null
  if (!target) return false
  if ('params' in target) nav.navigate(target.screen, target.params)
  else nav.navigate(target.screen)
  return true
}

/** Tells the server this phone can receive pushes. Safe to call on every launch. */
export async function registerPushToken(token: string, platform: string): Promise<void> {
  if (platform !== 'ios' && platform !== 'android') return
  await profileApi.registerDevice(token, platform)
}
