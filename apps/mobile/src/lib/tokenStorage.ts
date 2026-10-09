/**
 * Token storage — ticket E02-12.
 *
 * Keychain on iOS, Keystore-backed storage on Android. Never AsyncStorage:
 * that is plain text on disk, readable by any process on a rooted or
 * jailbroken device and included in unencrypted backups.
 */
import * as Keychain from 'react-native-keychain'

const ACCESS_TOKEN_SERVICE = 'ro.pitchup.accessToken'
const REFRESH_TOKEN_SERVICE = 'ro.pitchup.refreshToken'

export interface TokenPair {
  accessToken: string
  refreshToken: string
}

async function write(service: string, value: string): Promise<void> {
  await Keychain.setGenericPassword(service, value, {
    service,
    // Tokens are needed by background refresh, so they must be readable
    // while the device is locked — but only after the first unlock since
    // boot, and never restored onto a different device.
    accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  })
}

async function read(service: string): Promise<string | null> {
  try {
    const result = await Keychain.getGenericPassword({ service })
    return result ? result.password : null
  } catch {
    // A read can fail on a corrupt keychain entry or a cancelled biometric
    // prompt. Treated as "no token" so the app falls back to sign-in
    // rather than crashing on launch.
    return null
  }
}

export const tokenStorage = {
  async setTokens({ accessToken, refreshToken }: TokenPair): Promise<void> {
    await Promise.all([
      write(ACCESS_TOKEN_SERVICE, accessToken),
      write(REFRESH_TOKEN_SERVICE, refreshToken),
    ])
  },

  getAccessToken: () => read(ACCESS_TOKEN_SERVICE),
  getRefreshToken: () => read(REFRESH_TOKEN_SERVICE),

  async clearTokens(): Promise<void> {
    await Promise.all([
      Keychain.resetGenericPassword({ service: ACCESS_TOKEN_SERVICE }),
      Keychain.resetGenericPassword({ service: REFRESH_TOKEN_SERVICE }),
    ])
  },
}
