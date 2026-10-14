import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { api, apiRequest, ApiError } from './apiClient'
import { authEvents } from './authEvents'
import { tokenStorage } from './tokenStorage'

jest.mock('./tokenStorage', () => ({
  tokenStorage: {
    getAccessToken: jest.fn(),
    getRefreshToken: jest.fn(),
    setTokens: jest.fn(),
    clearTokens: jest.fn(),
  },
}))

const tokens = jest.mocked(tokenStorage)
let currentAccess = 'old'

/** A fake server: 401 for the old token, the envelope for the new one. */
function serve(config: InternalAxiosRequestConfig) {
  const auth = String(config.headers.Authorization ?? '')
  if (auth === 'Bearer old') {
    const response = {
      status: 401,
      statusText: '',
      headers: {},
      config,
      data: { data: null, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
    }
    return Promise.reject(new AxiosError('401', 'ERR_BAD_REQUEST', config, null, response))
  }
  return Promise.resolve({
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
    data: { data: { ok: config.url }, error: null },
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  currentAccess = 'old'
  tokens.getAccessToken.mockImplementation(async () => currentAccess)
  tokens.getRefreshToken.mockResolvedValue('refresh-1')
  tokens.setTokens.mockImplementation(async ({ accessToken }) => {
    currentAccess = accessToken
  })
  api.defaults.adapter = serve
})

it('attaches the access token', async () => {
  currentAccess = 'new'
  await expect(apiRequest({ url: '/me' })).resolves.toEqual({ ok: '/me' })
})

it('refreshes once on a 401 and retries, storing both rotated tokens', async () => {
  const post = jest.spyOn(axios, 'post').mockResolvedValue({
    data: { data: { accessToken: 'new', refreshToken: 'refresh-2' } },
  })
  await expect(apiRequest({ url: '/me' })).resolves.toEqual({ ok: '/me' })
  expect(post).toHaveBeenCalledTimes(1)
  expect(tokens.setTokens).toHaveBeenCalledWith({ accessToken: 'new', refreshToken: 'refresh-2' })
})

it('shares one refresh between concurrent 401s (no reuse-detection logout)', async () => {
  const post = jest
    .spyOn(axios, 'post')
    .mockImplementation(
      () =>
        new Promise(resolve =>
          setTimeout(
            () => resolve({ data: { data: { accessToken: 'new', refreshToken: 'refresh-2' } } }),
            10
          )
        )
    )
  const results = await Promise.all([
    apiRequest({ url: '/a' }),
    apiRequest({ url: '/b' }),
    apiRequest({ url: '/c' }),
  ])
  expect(results).toEqual([{ ok: '/a' }, { ok: '/b' }, { ok: '/c' }])
  expect(post).toHaveBeenCalledTimes(1)
})

it('signs out when the refresh fails', async () => {
  jest.spyOn(axios, 'post').mockRejectedValue(new Error('refresh refused'))
  const listener = jest.fn()
  const off = authEvents.onUnauthorized(listener)
  await expect(apiRequest({ url: '/me' })).rejects.toBeInstanceOf(ApiError)
  expect(tokens.clearTokens).toHaveBeenCalled()
  expect(listener).toHaveBeenCalledTimes(1)
  off()
})

it('turns a dropped connection into a readable NETWORK_ERROR', async () => {
  currentAccess = 'new'
  api.defaults.adapter = config =>
    Promise.reject(new AxiosError('Network Error', 'ERR_NETWORK', config))
  await expect(apiRequest({ url: '/me' })).rejects.toMatchObject({ code: 'NETWORK_ERROR' })
})
