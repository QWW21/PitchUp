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
