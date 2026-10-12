/**
 * Auth API — ticket E02-12.
 *
 * Typed wrappers over every auth endpoint. Each function either returns the
 * payload directly or throws an ApiError that callers can inspect by `.code`.
 */
import type { RegisterPlayerInput, LoginInput } from '@pitchup/shared'
import { apiRequest, ApiEnvelope } from './apiClient'
import { tokenStorage } from './tokenStorage'
import { api } from './apiClient'

export interface AuthUser {
  id: string
  email: string
  name: string
  role: 'PLAYER' | 'MANAGER' | 'ADMIN'
}

export interface LoginResult {
  user: AuthUser
  accessToken: string
  refreshToken: string
}

export async function register(input: RegisterPlayerInput): Promise<{ message: string }> {
  return apiRequest({ method: 'POST', url: '/api/v1/auth/register', data: input })
}

/**
 * Logs in, stores both tokens, and returns the user payload so the store
 * can hydrate immediately without a second round-trip to /me.
 */
export async function login(input: LoginInput): Promise<AuthUser> {
  const result = await apiRequest<LoginResult>({
    method: 'POST',
    url: '/api/v1/auth/mobile/login',
    data: input,
  })
  await tokenStorage.setTokens({
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
  })
  return result.user
}

export async function verifyEmail(email: string, code: string): Promise<{ verified: true }> {
  return apiRequest({ method: 'POST', url: '/api/v1/auth/verify-email', data: { email, code } })
}

export async function resendCode(
  email: string,
  channel: 'EMAIL' | 'PHONE'
): Promise<{ message: string }> {
  return apiRequest({
    method: 'POST',
    url: '/api/v1/auth/resend-code',
    data: { email, channel },
  })
}

export async function forgotPassword(email: string): Promise<{ message: string }> {
  return apiRequest({ method: 'POST', url: '/api/v1/auth/forgot-password', data: { email } })
}

export async function resetPassword(token: string, password: string): Promise<{ message: string }> {
  return apiRequest({
    method: 'POST',
    url: '/api/v1/auth/reset-password',
    data: { token, password },
  })
}

/**
 * Fetches the authenticated user from /me. Called on app start when tokens
 * already exist in the keychain, so no login credentials are needed.
 */
export async function fetchMe(): Promise<AuthUser> {
  return apiRequest({ method: 'GET', url: '/api/v1/me' })
}

export async function logout(): Promise<void> {
  try {
    // Best-effort: even if the network call fails we still clear local tokens.
    await api.post<ApiEnvelope<void>>('/api/v1/auth/logout')
  } catch {
    // Swallowed intentionally — local session is cleared regardless.
  }
  await tokenStorage.clearTokens()
}
