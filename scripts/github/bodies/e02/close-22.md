Implemented across 6db9aee and 0d3b1d2.

**Built:**

- `lib/tokenStorage.ts` — `react-native-keychain` wrapper. Uses `ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY` so background refresh can read tokens on a locked device, but they are never restored onto a different device. A failed read (corrupt entry, cancelled biometric prompt) is treated as "no token" rather than throwing, so a bad keychain cannot brick the launch path.
- `lib/apiClient.ts` — Axios instance with a request interceptor attaching `Authorization: Bearer`, and a response interceptor that refreshes once on 401 and retries the original request. Concurrent 401s share one refresh rather than each firing their own.
- `lib/authEvents.ts` — an unauthorised signal, so a refresh that exhausts its retry lands the user on Login without any screen needing to know.
- `lib/authApi.ts` — typed wrappers: register, login, verifyEmail, resendCode, forgotPassword, resetPassword, fetchMe, logout.
- `stores/authStore.ts` — Zustand; `checkSession()` validates stored tokens against `/me` on launch.
- `App.tsx` — `NavigationContainer` with AuthStack/AppStack driven by store status.

**Deviation — refresh rotates and the client stores both new tokens.** The ticket's sample keeps the original refresh token. Against this backend that is wrong: E02-08 added rotation with reuse detection, so replaying the old token would be read as theft and revoke the whole family, logging the user out everywhere.

**Deviation — key naming.** Keychain services are `ro.pitchup.accessToken` / `ro.pitchup.refreshToken`, not the `pitchup_access_token` in the ticket.

A defect found and fixed during the screen work: every path in `authApi.ts` carried a redundant `/api/v1` prefix that the base URL already included, so every call 404'd. Fixed in 7e5e894 and filed separately for the record.

**Not verified:** token contents have not been inspected on a device, and the refresh-on-401 path has not been exercised against a real expiring token — only the happy path was confirmed, on Android.
