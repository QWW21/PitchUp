/**
 * Location permission, GPS fix, and city detection — E03-02.
 *
 * The city comes from the nearest entry in CITIES rather than a reverse
 * geocoding call: the result has to be one of those cities anyway, this works
 * without network or an API key, and a suburb on the border (Florești)
 * resolves to the city it belongs to instead of to an unmatched locality.
 */
import { useCallback } from 'react'
import { PermissionsAndroid, Platform } from 'react-native'
import Geolocation from '@react-native-community/geolocation'
import { nearestCity } from '@pitchup/shared'
import { useDiscoverStore } from '../stores/discoverStore'

/**
 * - `blocked`: Android "don't ask again" — only the system settings can grant it now.
 * - `error`: permission granted but no fix, or no supported city near the fix.
 */
export type DetectResult = 'detected' | 'denied' | 'blocked' | 'error'

type PermissionResult = 'granted' | 'denied' | 'blocked'

// Permission prompts are the app's job, so the library must not show its own.
Geolocation.setRNConfiguration({ skipPermissionRequests: true, authorizationLevel: 'whenInUse' })

async function requestPermission(): Promise<PermissionResult> {
  if (Platform.OS === 'android') {
    const { ACCESS_FINE_LOCATION: FINE, ACCESS_COARSE_LOCATION: COARSE } =
      PermissionsAndroid.PERMISSIONS
    const result = await PermissionsAndroid.requestMultiple([FINE, COARSE])
    const values = [result[FINE], result[COARSE]]
    // Coarse alone is enough to pick a city.
    if (values.includes(PermissionsAndroid.RESULTS.GRANTED)) return 'granted'
    if (values.includes(PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN)) return 'blocked'
    return 'denied'
  }

  // iOS: "restricted" (parental controls) arrives as an error, like a denial.
  return new Promise(resolve =>
    Geolocation.requestAuthorization(
      () => resolve('granted'),
      () => resolve('denied')
    )
  )
}

function currentPosition(): Promise<{ lat: number; lng: number } | null> {
  return new Promise(resolve =>
    Geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      // A fix up to five minutes old is fine for choosing a city.
      { timeout: 10_000, maximumAge: 300_000, enableHighAccuracy: false }
    )
  )
}

export function useLocation() {
  const setCity = useDiscoverStore(s => s.setCity)
  const setCoords = useDiscoverStore(s => s.setCoords)

  const requestAndDetect = useCallback(async (): Promise<DetectResult> => {
    try {
      const permission = await requestPermission()
      if (permission !== 'granted') return permission

      const coords = await currentPosition()
      if (!coords) return 'error'
      setCoords(coords)

      const city = nearestCity(coords.lat, coords.lng)
      if (!city) return 'error'
      setCity(city.name)
      return 'detected'
    } catch {
      // Never let a platform quirk crash the Discover tab.
      return 'error'
    }
  }, [setCity, setCoords])

  return { requestAndDetect }
}
