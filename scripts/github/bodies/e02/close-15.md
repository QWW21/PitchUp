Implemented in 7e5e894 as `LoginScreen.tsx`.

**Built:** email and password with a show/hide toggle driving `secureTextEntry`, `KeyboardAvoidingView` so inputs clear the keyboard, a loading state that disables the form and spins the button, and a rate-limit message distinct from the credential failure. On success it calls `authStore.setUser()`; `App.tsx` watches status and swaps to `AppNavigator`, so there is no imperative navigation. Tokens land in the Keychain via `tokenStorage`, not AsyncStorage.

**Deliberate deviation — there is no `EMAIL_NOT_VERIFIED` branch.** The ticket asks for a specific message plus a resend option for that case. E02-08 deliberately removed that distinction: answering differently for an unverified account is a user-enumeration oracle, and closing it was one of the six defects fixed in 38603d7. The server now returns `INVALID_CREDENTIALS` for an unverified account and re-sends the code itself, so the person holding the real password gets what they need by email while a prober learns nothing. The screen shows one message for every credential failure, which is correct against the current API. **The ticket's acceptance criterion is the thing that is wrong here, not the code.**

**Not built — the Apple Sign-In button.** There is a "Continue with Google" button that routes to the E02-07 placeholder; there is no Apple button and so nothing to hide behind `Platform.OS`. That belongs to E02-07, which stays open.

**Not verified:** staging (there is no staging environment yet), and Keychain contents have not been inspected on a device.
