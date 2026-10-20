import { Platform } from 'react-native'

/**
 * API base URL.
 *
 * On a simulator, localhost is the simulator itself. iOS forwards localhost
 * to the host machine; the Android emulator does not, and reaches it at
 * 10.0.2.2 instead.
 */
const DEV_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost'

export const API_BASE_URL = __DEV__ ? `http://${DEV_HOST}:3000/api/v1` : 'https://pitchup.ro/api/v1'

/**
 * Google sign-in (E02-07). OAuth client IDs are public: they name the app to
 * Google, they don't unlock anything. The app asks for an ID token addressed
 * to the Web client, which is what the server checks.
 */
export const GOOGLE_WEB_CLIENT_ID =
  '902464703382-j55h7b9b54u722cv25djai11eor44tl8.apps.googleusercontent.com'
export const GOOGLE_IOS_CLIENT_ID =
  '902464703382-b80326fvgjrvgrrkm6smn55k30muel2c.apps.googleusercontent.com'

/**
 * Error monitoring: the pitchup-mobile project's DSN from Sentry. Public by
 * design (it only lets the app send events). Empty means monitoring is off.
 */
export const SENTRY_DSN =
  'https://8a2795e6e36eb4d99873642558f7e374@o4512287868649472.ingest.de.sentry.io/4512287884247120'
