/**
 * Auth API — ticket E02-12.
 *
 * Typed wrappers over every auth endpoint. Each function either returns the
 * payload directly or throws an ApiError that callers can inspect by `.code`.
 *
 * Paths are relative to API_BASE_URL which already ends in /api/v1.
 */
import type { GoogleSignInInput, RegisterPlayerInput, LoginInput } from '@pitchup/shared'
import { api, apiRequest, type ApiEnvelope } from './apiClient'
import { tokenStorage } from './tokenStorage'

export interface AuthUser {
  id: string
  email: string
  name: string
  role: 'PLAYER' | 'MANAGER' | 'ADMIN'
  /** From /me; absent on the login response. Drives "Account restricted" (E04-06). */
  trustScore?: number | null
}

export interface LoginResult {
  user: AuthUser
  accessToken: string
  refreshToken: string
}

export async function register(input: RegisterPlayerInput): Promise<{ message: string }> {
  return apiRequest({ method: 'POST', url: '/auth/register', data: input })
}

/**
 * Logs in, stores both tokens, and returns the user payload so the store
 * can hydrate immediately without a second round-trip to /me.
 */
export async function login(input: LoginInput): Promise<AuthUser> {
  const result = await apiRequest<LoginResult>({
    method: 'POST',
    url: '/auth/mobile/login',
    data: input,
  })
  await tokenStorage.setTokens({
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
  })
  return result.user
}

export type GoogleSignInOutcome =
  | { status: 'SIGNED_IN'; user: AuthUser }
  | { status: 'PROFILE_NEEDED'; email: string; name: string }

/**
 * Google sign-in (E02-07). A known address signs in and its tokens are
 * stored, as `login` does; a new one answers PROFILE_NEEDED, and the call is
 * repeated with `profile` once the person has filled it in.
 */
export async function googleSignIn(input: GoogleSignInInput): Promise<GoogleSignInOutcome> {
  const result = await apiRequest<
    | (LoginResult & { status: 'SIGNED_IN' })
    | { status: 'PROFILE_NEEDED'; email: string; name: string }
  >({ method: 'POST', url: '/auth/mobile/google', data: input })
  if (result.status === 'PROFILE_NEEDED') return result
  await tokenStorage.setTokens({
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
  })
  return { status: 'SIGNED_IN', user: result.user }
}

export async function verifyEmail(email: string, code: string): Promise<{ verified: true }> {
  return apiRequest({ method: 'POST', url: '/auth/verify-email', data: { email, code } })
}

export async function resendCode(
  email: string,
  channel: 'EMAIL' | 'PHONE'
): Promise<{ message: string }> {
  return apiRequest({ method: 'POST', url: '/auth/resend-code', data: { email, channel } })
}

export async function forgotPassword(email: string): Promise<{ message: string }> {
  return apiRequest({ method: 'POST', url: '/auth/forgot-password', data: { email } })
}

export async function resetPassword(token: string, password: string): Promise<{ message: string }> {
  return apiRequest({ method: 'POST', url: '/auth/reset-password', data: { token, password } })
}

/**
 * Fetches the authenticated user from /me. Called on app start when tokens
 * already exist in the keychain, so no login credentials are needed.
 */
export async function fetchMe(): Promise<AuthUser> {
  return apiRequest({ method: 'GET', url: '/me' })
}

export async function logout(): Promise<void> {
  try {
    await api.post<ApiEnvelope<void>>('/auth/logout')
  } catch {
    // Swallowed intentionally — local session is cleared regardless.
  }
  await tokenStorage.clearTokens()
}
