/**
 * Mobile API client — ticket E02-12.
 *
 * Attaches the access token to every request and refreshes it transparently
 * on a 401, so no screen has to handle expiry itself.
 */
import axios, { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios'
import { API_BASE_URL } from '../config'
import { authEvents } from './authEvents'
import { tokenStorage } from './tokenStorage'

/** Marks a request that has already been retried, so a failed refresh
 *  cannot loop forever. */
interface RetriableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use(async config => {
  const token = await tokenStorage.getAccessToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

/**
 * In-flight refresh, shared by every request that 401s at once.
 *
 * Without this, five parallel calls on a cold start would each try to
 * refresh. The backend rotates refresh tokens and treats reuse as theft, so
 * the second request through would revoke every session the user has — a
 * forced logout caused by nothing but concurrency.
 */
let refreshInFlight: Promise<string | null> | null = null

async function performRefresh(): Promise<string | null> {
  const refreshToken = await tokenStorage.getRefreshToken()
  if (!refreshToken) return null

  try {
    // Deliberately a bare axios call: going through `api` would re-enter
    // these interceptors and recurse.
    const { data } = await axios.post(
      `${API_BASE_URL}/auth/mobile/refresh`,
      { refreshToken },
      { timeout: 15_000, headers: { 'Content-Type': 'application/json' } }
    )

    const next = data?.data
    if (!next?.accessToken || !next?.refreshToken) return null

    // Both tokens are stored. The server rotates the refresh token and
    // marks the old one replaced; keeping the old one would fail the next
    // refresh as suspected theft and log the user out everywhere.
    await tokenStorage.setTokens({
      accessToken: next.accessToken,
      refreshToken: next.refreshToken,
    })
    return next.accessToken
  } catch {
    return null
  }
}

api.interceptors.response.use(
  response => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined

    if (error.response?.status !== 401 || !original || original._retried) {
      return Promise.reject(error)
    }

    // The refresh endpoint itself returning 401 means the session is gone;
    // retrying would loop.
    if (original.url?.includes('/auth/mobile/refresh')) {
      await tokenStorage.clearTokens()
      authEvents.emitUnauthorized()
      return Promise.reject(error)
    }

    original._retried = true

    refreshInFlight ??= performRefresh().finally(() => {
      refreshInFlight = null
    })
    const accessToken = await refreshInFlight

    if (!accessToken) {
      await tokenStorage.clearTokens()
      authEvents.emitUnauthorized()
      return Promise.reject(error)
    }

    original.headers.Authorization = `Bearer ${accessToken}`
    return api(original)
  }
)

/** Shape every endpoint returns. Mirrors apps/web/src/lib/api/response.ts. */
export interface ApiEnvelope<T> {
  data: T | null
  error: { code: string; message: string; details?: unknown } | null
}

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details?: unknown,
    readonly status?: number
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * Unwraps the envelope and throws a typed ApiError on failure, so callers
 * get the data directly instead of checking two levels of nesting.
 */
export async function apiRequest<T>(config: AxiosRequestConfig): Promise<T> {
  try {
    const response = await api.request<ApiEnvelope<T>>(config)
    if (response.data.error) {
      throw new ApiError(
        response.data.error.code,
        response.data.error.message,
        response.data.error.details,
        response.status
      )
    }
    return response.data.data as T
  } catch (caught) {
    if (caught instanceof ApiError) throw caught

    const axiosError = caught as AxiosError<ApiEnvelope<unknown>>
    const body = axiosError.response?.data

    if (body?.error) {
      throw new ApiError(
        body.error.code,
        body.error.message,
        body.error.details,
        axiosError.response?.status
      )
    }

    // No envelope means the request never reached the API — a dropped
    // connection, DNS failure or timeout. Worth saying so plainly rather
    // than showing an axios message.
    throw new ApiError(
      'NETWORK_ERROR',
      'Could not reach PitchUp. Check your connection and try again.',
      undefined,
      axiosError.response?.status
    )
  }
}
