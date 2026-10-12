/**
 * Auth session store — ticket E02-12.
 *
 * Single source of truth for who is logged in. Screens read from here rather
 * than hitting the network themselves; the store owns all token side-effects.
 */
import { create } from 'zustand'
import type { AuthUser } from '../lib/authApi'
import * as authApi from '../lib/authApi'
import { tokenStorage } from '../lib/tokenStorage'

type AuthStatus = 'unknown' | 'authenticated' | 'unauthenticated'

interface AuthState {
  /** Resolved once `checkSession` has run; avoids a flash of the login screen. */
  status: AuthStatus
  user: AuthUser | null

  /**
   * Called once on app start. Reads stored tokens; if present, validates them
   * by fetching /me. On failure clears tokens so the next launch starts clean.
   */
  checkSession: () => Promise<void>

  /** Stores the user returned by the login endpoint — no second /me call needed. */
  setUser: (user: AuthUser) => void

  /** Clears local tokens and server session, resets to unauthenticated. */
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>(set => ({
  status: 'unknown',
  user: null,

  async checkSession() {
    const token = await tokenStorage.getAccessToken()
    if (!token) {
      set({ status: 'unauthenticated' })
      return
    }
    try {
      const user = await authApi.fetchMe()
      set({ status: 'authenticated', user })
    } catch {
      // Tokens exist but /me failed (expired, revoked, network outage).
      // Clear them so the next launch does not loop through this path again.
      await tokenStorage.clearTokens()
      set({ status: 'unauthenticated', user: null })
    }
  },

  setUser(user) {
    set({ status: 'authenticated', user })
  },

  async logout() {
    await authApi.logout()
    set({ status: 'unauthenticated', user: null })
  },
}))
