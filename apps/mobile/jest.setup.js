/**
 * Native modules have no JS implementation under Jest; each is replaced once
 * here so tests import real app code unchanged.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)

jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default
)

jest.mock('react-native-keychain', () => ({
  ACCESSIBLE: { AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY' },
  setGenericPassword: jest.fn(async () => true),
  getGenericPassword: jest.fn(async () => false),
  resetGenericPassword: jest.fn(async () => true),
}))

// Icons render as a host element carrying their name, so tests can assert on it.
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => {
  const React = require('react')
  const { Text } = require('react-native')
  return ({ name, ...props }) =>
    React.createElement(Text, { ...props, testID: `icon-${name}` }, name)
})

jest.mock('@react-native-community/geolocation', () => ({
  setRNConfiguration: jest.fn(),
  requestAuthorization: jest.fn(),
  getCurrentPosition: jest.fn(),
}))

jest.mock('react-native-maps', () => {
  const React = require('react')
  const { View } = require('react-native')
  const MapView = React.forwardRef((props, ref) => React.createElement(View, { ...props, ref }))
  return {
    __esModule: true,
    default: MapView,
    Marker: View,
    PROVIDER_GOOGLE: 'google',
    PROVIDER_DEFAULT: undefined,
  }
})

// Stripe's own mock of its native SDK: hooks resolve, CardField renders nothing native.
jest.mock('@stripe/stripe-react-native', () => require('@stripe/stripe-react-native/jest/mock.js'))

// Firebase Cloud Messaging (push, E08-10). Tests reach for this mock to drive it.
jest.mock('@react-native-firebase/messaging', () => {
  const instance = {
    requestPermission: jest.fn(async () => 1),
    getToken: jest.fn(async () => 'fcm-token-from-jest-0001'),
    deleteToken: jest.fn(async () => undefined),
    onTokenRefresh: jest.fn(() => jest.fn()),
    onNotificationOpenedApp: jest.fn(() => jest.fn()),
    getInitialNotification: jest.fn(async () => null),
  }
  const messaging = () => instance
  messaging.AuthorizationStatus = { NOT_DETERMINED: -1, DENIED: 0, AUTHORIZED: 1, PROVISIONAL: 2 }
  messaging.instance = instance
  return { __esModule: true, default: messaging }
})

// Google sign-in (E02-07): the sheet answers with a fixed token unless a test says otherwise.
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(async () => true),
    signIn: jest.fn(async () => ({ type: 'success', data: { idToken: 'google-id-token-0001' } })),
    signOut: jest.fn(async () => null),
  },
  isSuccessResponse: response => response.type === 'success',
  isErrorWithCode: error => error != null && typeof error.code === 'string',
  statusCodes: { IN_PROGRESS: 'IN_PROGRESS', SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED' },
}))
