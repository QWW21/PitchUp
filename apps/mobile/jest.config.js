/**
 * Mobile unit and component tests — T-08. No device or simulator: native
 * modules are mocked in jest.setup.js.
 *
 * Packages that ship untranspiled RN/ESM code must go through Babel. Under
 * pnpm they live at node_modules/.pnpm/<pkg>@<ver>/node_modules/<pkg>, so the
 * pattern lets `.pnpm/` through and then decides on the real package name.
 */
const transformed = [
  '\\.pnpm',
  'react-native',
  '@react-native',
  '@react-native-community',
  '@react-native-async-storage',
  '@react-navigation',
  'react-native-.*',
  '@tanstack',
  'zustand',
  'supercluster',
  'kdbush',
  '@pitchup',
].join('|')

module.exports = {
  preset: 'react-native',
  setupFiles: ['<rootDir>/jest.setup.js'],
  // toBeChecked, toBeDisabled, toHaveTextContent…
  setupFilesAfterEnv: ['@testing-library/react-native/extend-expect'],
  testMatch: ['<rootDir>/src/**/*.test.{ts,tsx}'],
  // The first render in a file pays for transforming React Native; on a busy
  // CI runner that alone can pass Jest's 5 s default.
  testTimeout: 20_000,
  transformIgnorePatterns: [`node_modules/(?!(${transformed})/)`],
}
