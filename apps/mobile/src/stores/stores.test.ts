import AsyncStorage from '@react-native-async-storage/async-storage'
import { SELECTED_CITY_KEY, effectiveSort, useDiscoverStore } from './discoverStore'
import { useAuthStore } from './authStore'
import * as authApi from '../lib/authApi'
import { tokenStorage } from '../lib/tokenStorage'

jest.mock('../lib/authApi')
jest.mock('../lib/tokenStorage', () => ({
  tokenStorage: {
    getAccessToken: jest.fn(),
    getRefreshToken: jest.fn(),
    setTokens: jest.fn(),
    clearTokens: jest.fn(),
  },
}))

describe('discoverStore', () => {
  beforeEach(async () => {
    await AsyncStorage.clear()
    useDiscoverStore.setState({ hydrated: false, selectedCity: null })
  })

  it('hydrates the saved city', async () => {
    await AsyncStorage.setItem(SELECTED_CITY_KEY, 'Iași')
    await useDiscoverStore.getState().hydrate()
    expect(useDiscoverStore.getState()).toMatchObject({ hydrated: true, selectedCity: 'Iași' })
  })

  it('ignores a saved city that is no longer supported', async () => {
    await AsyncStorage.setItem(SELECTED_CITY_KEY, 'Atlantis')
    await useDiscoverStore.getState().hydrate()
    expect(useDiscoverStore.getState()).toMatchObject({ hydrated: true, selectedCity: null })
  })

  it('persists a chosen city', async () => {
    useDiscoverStore.getState().setCity('Brașov')
    await new Promise<void>(r => setTimeout(r, 0))
    expect(await AsyncStorage.getItem(SELECTED_CITY_KEY)).toBe('Brașov')
  })

  it('resets filters to the defaults', () => {
    const { setFilters, resetFilters } = useDiscoverStore.getState()
    setFilters({ ...useDiscoverStore.getState().filters, openNow: true, surfaces: ['FUTSAL'] })
    resetFilters()
    expect(useDiscoverStore.getState().filters).toMatchObject({ openNow: false, surfaces: [] })
  })
})

describe('effectiveSort', () => {
  const coords = { lat: 46.77, lng: 23.59 }
  it('defaults to Nearest with a position and Top rated without', () => {
    expect(effectiveSort(null, coords)).toBe('distance')
    expect(effectiveSort(null, null)).toBe('rating')
  })
  it('falls back from Nearest when there is no position', () => {
    expect(effectiveSort('distance', null)).toBe('rating')
  })
  it('keeps any other explicit choice', () => {
    expect(effectiveSort('price', null)).toBe('price')
    expect(effectiveSort('newest', coords)).toBe('newest')
  })
})

describe('authStore.checkSession', () => {
  const tokens = jest.mocked(tokenStorage)
  const api = jest.mocked(authApi)

  beforeEach(() => {
    jest.clearAllMocks()
    useAuthStore.setState({ status: 'unknown', user: null })
  })

  it('is unauthenticated without a stored token, without calling the API', async () => {
    tokens.getAccessToken.mockResolvedValue(null)
    await useAuthStore.getState().checkSession()
    expect(useAuthStore.getState().status).toBe('unauthenticated')
    expect(api.fetchMe).not.toHaveBeenCalled()
  })

  it('is authenticated when /me answers', async () => {
    tokens.getAccessToken.mockResolvedValue('token')
    const user = { id: 'u1', email: 'p@x.ro', name: 'P', role: 'PLAYER' as const, trustScore: 100 }
    api.fetchMe.mockResolvedValue(user)
    await useAuthStore.getState().checkSession()
    expect(useAuthStore.getState()).toMatchObject({ status: 'authenticated', user })
  })

  it('clears the tokens when /me fails, so the next launch starts clean', async () => {
    tokens.getAccessToken.mockResolvedValue('token')
    api.fetchMe.mockRejectedValue(new Error('401'))
    await useAuthStore.getState().checkSession()
    expect(useAuthStore.getState().status).toBe('unauthenticated')
    expect(tokens.clearTokens).toHaveBeenCalled()
  })
})
