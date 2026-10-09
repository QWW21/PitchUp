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
