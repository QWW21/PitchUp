import { PermissionsAndroid, Platform } from 'react-native'
import Geolocation from '@react-native-community/geolocation'
import { act, renderHook } from '@testing-library/react-native'
import { useLocation } from './useLocation'
import { useDiscoverStore } from '../stores/discoverStore'

const geo = jest.mocked(Geolocation)

const at = (lat: number, lng: number) =>
  geo.getCurrentPosition.mockImplementation(success =>
    success({ coords: { latitude: lat, longitude: lng } } as Parameters<typeof success>[0])
  )

async function detect() {
  const { result } = renderHook(() => useLocation())
  let outcome = ''
  await act(async () => {
    outcome = await result.current.requestAndDetect()
  })
  return outcome
}

beforeEach(() => {
  jest.clearAllMocks()
  useDiscoverStore.setState({ selectedCity: null, userCoords: null })
})

describe('iOS', () => {
  beforeAll(() => {
    Platform.OS = 'ios'
  })

  it('granted + a position in Cluj → detected, city and coordinates stored', async () => {
    geo.requestAuthorization.mockImplementation(success => success?.())
    at(46.7476, 23.4904) // Florești, a suburb
    expect(await detect()).toBe('detected')
    expect(useDiscoverStore.getState()).toMatchObject({
      selectedCity: 'Cluj-Napoca',
      userCoords: { lat: 46.7476, lng: 23.4904 },
    })
  })

  it('denied (or restricted) → denied, nothing stored', async () => {
    geo.requestAuthorization.mockImplementation((_ok, fail) => fail?.({ code: 1 } as never))
    expect(await detect()).toBe('denied')
    expect(useDiscoverStore.getState().selectedCity).toBeNull()
  })

  it('a position far from any supported city → error, but coordinates kept', async () => {
    geo.requestAuthorization.mockImplementation(success => success?.())
    at(48.2082, 16.3738) // Vienna
    expect(await detect()).toBe('error')
    expect(useDiscoverStore.getState().selectedCity).toBeNull()
    expect(useDiscoverStore.getState().userCoords).not.toBeNull()
  })

  it('no fix within the timeout → error', async () => {
    geo.requestAuthorization.mockImplementation(success => success?.())
    geo.getCurrentPosition.mockImplementation((_ok, fail) => fail?.({ code: 3 } as never))
    expect(await detect()).toBe('error')
  })
})

describe('Android', () => {
  beforeAll(() => {
    Platform.OS = 'android'
  })
  const { ACCESS_FINE_LOCATION: FINE, ACCESS_COARSE_LOCATION: COARSE } =
    PermissionsAndroid.PERMISSIONS
  const { GRANTED, DENIED, NEVER_ASK_AGAIN } = PermissionsAndroid.RESULTS
  const answer = (fine: string, coarse: string) =>
    jest
      .spyOn(PermissionsAndroid, 'requestMultiple')
      .mockResolvedValue({ [FINE]: fine, [COARSE]: coarse } as never)

  it('coarse alone is enough', async () => {
    answer(DENIED, GRANTED)
    at(44.43, 26.1)
    expect(await detect()).toBe('detected')
    expect(useDiscoverStore.getState().selectedCity).toBe('București')
  })

  it('"don\'t ask again" → blocked, so the UI can offer Settings', async () => {
    answer(NEVER_ASK_AGAIN, NEVER_ASK_AGAIN)
    expect(await detect()).toBe('blocked')
  })

  it('a thrown native error never escapes', async () => {
    jest.spyOn(PermissionsAndroid, 'requestMultiple').mockRejectedValue(new Error('activity gone'))
    expect(await detect()).toBe('error')
  })
})
