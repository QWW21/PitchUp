/**
 * Push notifications — E08-10.
 *
 * Firebase Cloud Messaging gives the phone a token; the server keeps it
 * (POST /notifications/device-token) and sends to it (E13-02). Tapping a
 * push opens what it is about through `openNotification`, the same function
 * the in-app list uses (E08-09), so both always lead to the same place.
 */
import { PermissionsAndroid, Platform } from 'react-native'
import messaging from '@react-native-firebase/messaging'
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

type PushMessage = { data?: Record<string, unknown> } | null

function openMessage(nav: Navigator, message: PushMessage) {
  const data = message?.data
  if (data) openNotification(nav, typeof data.type === 'string' ? data.type : undefined, data)
}

/** Android 13+ and iOS ask the person first; older Android allows it outright. */
async function mayNotify(): Promise<boolean> {
  if (Platform.OS === 'android') {
    if (Number(Platform.Version) < 33) return true
    const answer = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
    )
    return answer === PermissionsAndroid.RESULTS.GRANTED
  }
  const status = await messaging().requestPermission()
  return (
    status === messaging.AuthorizationStatus.AUTHORIZED ||
    status === messaging.AuthorizationStatus.PROVISIONAL
  )
}

/**
 * Starts push for the signed-in person: asks permission, registers the token
 * (and every refresh of it), and opens the screen a tapped push is about,
 * including the push that launched the app. Returns a function that stops
 * listening. Without permission it does nothing; the in-app list still works.
 */
export async function startPush(nav: Navigator): Promise<() => void> {
  if (!(await mayNotify())) return () => undefined
  const platform = Platform.OS
  await registerPushToken(await messaging().getToken(), platform)
  const stopRefresh = messaging().onTokenRefresh(token => {
    registerPushToken(token, platform).catch(() => undefined)
  })
  const stopOpened = messaging().onNotificationOpenedApp(message => openMessage(nav, message))
  openMessage(nav, await messaging().getInitialNotification())
  return () => {
    stopRefresh()
    stopOpened()
  }
}

/**
 * On sign-out the phone's token is thrown away, so pushes meant for that
 * account stop arriving; the server drops the dead token at its next send.
 */
export async function stopPush(): Promise<void> {
  await messaging()
    .deleteToken()
    .catch(() => undefined)
}
